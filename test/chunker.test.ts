import { describe, it, expect } from 'vitest';
import { chunkerService, CHUNK_SIZE } from '../src/services/webrtc/dataChannelChunker';

describe('DataChannel Chunked Transfer & Reassembly', () => {
  it('correctly chunks, accumulates, and reassembles binary files', async () => {
    const fileId = 'test_file_' + Date.now();
    const testSize = 45000; // ~45 KB (requires 3 chunks with 16KB CHUNK_SIZE)
    const testData = new Uint8Array(testSize);
    for (let i = 0; i < testSize; i++) {
      testData[i] = i % 256;
    }

    const totalChunks = Math.ceil(testSize / CHUNK_SIZE);
    expect(totalChunks).toBe(3);

    // 1. Initialize incoming transfer
    chunkerService.initIncomingTransfer({
      fileId,
      fileName: 'test-document.pdf',
      fileSize: testSize,
      mimeType: 'application/pdf',
      totalChunks
    });

    // 2. Feed chunks in simulated order
    for (let c = 0; c < totalChunks; c++) {
      const start = c * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, testSize);
      const chunkSlice = testData.slice(start, end).buffer;

      chunkerService.handleIncomingChunk(fileId, c, chunkSlice);
    }

    // 3. Finalize
    const finalized = chunkerService.finalizeIncomingTransfer(fileId);
    expect(finalized).not.toBeNull();
    expect(finalized?.name).toBe('test-document.pdf');
    expect(finalized?.mimeType).toBe('application/pdf');
    expect(finalized?.blob.size).toBe(testSize);

    // Verify bit-for-bit integrity of reassembled arrayBuffer
    const reassembledBuf = await finalized!.blob.arrayBuffer();
    expect(new Uint8Array(reassembledBuf)).toEqual(testData);
  });
});
