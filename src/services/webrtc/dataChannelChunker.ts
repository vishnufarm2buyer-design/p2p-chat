// ============================================================================
// Direct Peer-to-Peer Chunked File & Media Transfer via RTCDataChannel
// Handles chunking, backpressure control, progress reporting, and reassembly.
// ZERO cloud relay or file storage. Files travel directly browser-to-browser.
// ============================================================================

export const CHUNK_SIZE = 16384; // 16 KB safe chunk size across Chrome, Safari, Firefox
export const HIGH_WATERMARK = 65536; // 64 KB backpressure threshold

export interface ActiveFileTransfer {
  fileId: string;
  name: string;
  size: number;
  mimeType: string;
  totalChunks: number;
  chunksReceived: Map<number, ArrayBuffer>;
  progress: number;
  isSending: boolean;
  cancelled: boolean;
}

export type TransferProgressCallback = (
  fileId: string, 
  percent: number, 
  bytesTransferred: number, 
  totalBytes: number
) => void;

class DataChannelChunker {
  private incomingTransfers: Map<string, ActiveFileTransfer> = new Map();
  private outgoingTransfers: Map<string, ActiveFileTransfer> = new Map();

  /**
   * Sends a File/Blob directly over RTCDataChannel in chunks with backpressure management.
   */
  async sendFile(
    file: File | Blob,
    metadata: { fileId: string; fileName: string; mimeType: string },
    dataChannel: RTCDataChannel,
    encryptChunk?: (chunk: ArrayBuffer) => Promise<{ ciphertext: string; iv: string }>,
    onProgress?: TransferProgressCallback
  ): Promise<void> {
    if (dataChannel.readyState !== 'open') {
      throw new Error('RTCDataChannel is not open for file transfer');
    }

    const totalBytes = file.size;
    const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE);

    const transfer: ActiveFileTransfer = {
      fileId: metadata.fileId,
      name: metadata.fileName,
      size: totalBytes,
      mimeType: metadata.mimeType,
      totalChunks,
      chunksReceived: new Map(),
      progress: 0,
      isSending: true,
      cancelled: false
    };

    this.outgoingTransfers.set(metadata.fileId, transfer);

    // 1. Send FILE_START packet
    dataChannel.send(JSON.stringify({
      type: 'FILE_START',
      id: metadata.fileId,
      timestamp: Date.now(),
      fileMeta: {
        fileId: metadata.fileId,
        fileName: metadata.fileName,
        fileSize: totalBytes,
        mimeType: metadata.mimeType,
        totalChunks
      }
    }));

    // Configure low watermark for backpressure
    dataChannel.bufferedAmountLowThreshold = HIGH_WATERMARK / 2;

    const fileBuffer = await file.arrayBuffer();

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      if (transfer.cancelled) {
        dataChannel.send(JSON.stringify({
          type: 'FILE_CANCEL',
          id: metadata.fileId,
          timestamp: Date.now()
        }));
        this.outgoingTransfers.delete(metadata.fileId);
        throw new Error('File transfer was cancelled by user');
      }

      // Check backpressure
      if (dataChannel.bufferedAmount > HIGH_WATERMARK) {
        await new Promise<void>(resolve => {
          const handler = () => {
            dataChannel.removeEventListener('bufferedamountlow', handler);
            resolve();
          };
          dataChannel.addEventListener('bufferedamountlow', handler);
        });
      }

      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, totalBytes);
      const rawChunk = fileBuffer.slice(start, end);

      if (encryptChunk) {
        const encrypted = await encryptChunk(rawChunk);
        dataChannel.send(JSON.stringify({
          type: 'FILE_CHUNK',
          id: metadata.fileId,
          timestamp: Date.now(),
          chunkMeta: {
            fileId: metadata.fileId,
            chunkIndex,
            totalChunks
          },
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv
        }));
      } else {
        // Fallback or binary payload header (12-byte id + 4-byte chunk index)
        // We use JSON packet structure for uniform encryption & compatibility
        const base64Chunk = this.arrayBufferToBase64(rawChunk);
        dataChannel.send(JSON.stringify({
          type: 'FILE_CHUNK',
          id: metadata.fileId,
          timestamp: Date.now(),
          chunkMeta: {
            fileId: metadata.fileId,
            chunkIndex,
            totalChunks
          },
          ciphertext: base64Chunk
        }));
      }

      const currentBytes = end;
      const percent = Math.round((currentBytes / totalBytes) * 100);
      transfer.progress = percent;
      onProgress?.(metadata.fileId, percent, currentBytes, totalBytes);
    }

    // 2. Send FILE_END packet
    dataChannel.send(JSON.stringify({
      type: 'FILE_END',
      id: metadata.fileId,
      timestamp: Date.now()
    }));

    this.outgoingTransfers.delete(metadata.fileId);
  }

  /**
   * Initializes incoming transfer upon receiving FILE_START packet.
   */
  initIncomingTransfer(meta: {
    fileId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    totalChunks: number;
  }): void {
    this.incomingTransfers.set(meta.fileId, {
      fileId: meta.fileId,
      name: meta.fileName,
      size: meta.fileSize,
      mimeType: meta.mimeType,
      totalChunks: meta.totalChunks,
      chunksReceived: new Map(),
      progress: 0,
      isSending: false,
      cancelled: false
    });
  }

  /**
   * Handles incoming chunk, stores it, and reports progress.
   */
  handleIncomingChunk(
    fileId: string,
    chunkIndex: number,
    chunkData: ArrayBuffer,
    onProgress?: TransferProgressCallback
  ): void {
    const transfer = this.incomingTransfers.get(fileId);
    if (!transfer || transfer.cancelled) return;

    transfer.chunksReceived.set(chunkIndex, chunkData);

    const receivedCount = transfer.chunksReceived.size;
    const percent = Math.round((receivedCount / transfer.totalChunks) * 100);
    transfer.progress = percent;

    const estimatedBytes = Math.min(receivedCount * CHUNK_SIZE, transfer.size);
    onProgress?.(fileId, percent, estimatedBytes, transfer.size);
  }

  /**
   * Finalizes incoming transfer, reassembles chunks into a Blob, and frees memory.
   */
  finalizeIncomingTransfer(fileId: string): { blob: Blob; name: string; mimeType: string } | null {
    const transfer = this.incomingTransfers.get(fileId);
    if (!transfer) return null;

    const parts: ArrayBuffer[] = [];
    for (let i = 0; i < transfer.totalChunks; i++) {
      const part = transfer.chunksReceived.get(i);
      if (!part) {
        console.error(`Missing chunk ${i} for file ${fileId}`);
        this.incomingTransfers.delete(fileId);
        return null;
      }
      parts.push(part);
    }

    const blob = new Blob(parts, { type: transfer.mimeType || 'application/octet-stream' });
    const result = {
      blob,
      name: transfer.name,
      mimeType: transfer.mimeType
    };

    this.incomingTransfers.delete(fileId);
    return result;
  }

  /**
   * Cancels a file transfer in flight.
   */
  cancelTransfer(fileId: string): void {
    const outgoing = this.outgoingTransfers.get(fileId);
    if (outgoing) {
      outgoing.cancelled = true;
      this.outgoingTransfers.delete(fileId);
    }
    const incoming = this.incomingTransfers.get(fileId);
    if (incoming) {
      incoming.cancelled = true;
      this.incomingTransfers.delete(fileId);
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}

export const chunkerService = new DataChannelChunker();
