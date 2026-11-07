import QRCode from 'qrcode';

// ============================================================================
// Permanent QR Code System
// Format: p2pchat://user/<UNIQUE_PUBLIC_USER_ID>
// STRICT PRIVACY RULE: Never embed email, auth tokens, or private keys.
// The QR code is tied permanently to the user's public identity ID and does NOT
// change upon editing display names or avatars.
// ============================================================================

export const QR_URI_SCHEME = 'p2pchat://user/';

export class QRService {
  /**
   * Generates a permanent URI for a user's unique public ID.
   */
  getPermanentUri(publicId: string): string {
    return `${QR_URI_SCHEME}${publicId.trim()}`;
  }

  /**
   * Generates a Data URL (base64 PNG) of the permanent QR code.
   */
  async generateQrDataUrl(publicId: string): Promise<string> {
    const uri = this.getPermanentUri(publicId);
    return await QRCode.toDataURL(uri, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0284c7', // Sky / Cyan primary
        light: '#030712' // Dark slate background
      },
      errorCorrectionLevel: 'M'
    });
  }

  /**
   * Generates an SVG string of the permanent QR code.
   */
  async generateQrSvg(publicId: string): Promise<string> {
    const uri = this.getPermanentUri(publicId);
    return await QRCode.toString(uri, {
      type: 'svg',
      margin: 2,
      color: {
        dark: '#38bdf8',
        light: 'transparent'
      }
    });
  }

  /**
   * Parses scanned QR code text and extracts the public user ID.
   * Supports both `p2pchat://user/<id>` and fallback query param `?contact=<id>`.
   */
  parseQrContent(scannedText: string): string | null {
    if (!scannedText) return null;
    const trimmed = scannedText.trim();

    if (trimmed.startsWith(QR_URI_SCHEME)) {
      return trimmed.replace(QR_URI_SCHEME, '').trim();
    }

    // Also support web URL format if scanned via external camera app: https://domain/?contact=p2p_xxx
    try {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const url = new URL(trimmed);
        const contactParam = url.searchParams.get('contact') || url.searchParams.get('add');
        if (contactParam && contactParam.startsWith('p2p_')) {
          return contactParam;
        }
      }
    } catch (_) {}

    // Direct public ID (e.g. pasted or typed)
    if (trimmed.startsWith('p2p_')) {
      return trimmed;
    }

    return null;
  }

  /**
   * Triggers browser download of the QR code image.
   */
  downloadQrCode(dataUrl: string, publicId: string): void {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `p2p-identity-${publicId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export const qrService = new QRService();
