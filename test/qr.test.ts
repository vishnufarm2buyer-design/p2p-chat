import { describe, it, expect } from 'vitest';
import { qrService } from '../src/services/qr';

describe('Permanent QR Code Identity System', () => {
  it('formats permanent URI with p2pchat://user/ scheme', () => {
    const publicId = 'p2p_9f8e7d6c5b';
    const uri = qrService.getPermanentUri(publicId);
    expect(uri).toBe('p2pchat://user/p2p_9f8e7d6c5b');
  });

  it('generates a valid base64 data URL for QR codes', async () => {
    const publicId = 'p2p_test_user_123';
    const dataUrl = await qrService.generateQrDataUrl(publicId);
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('correctly parses native p2pchat scheme', () => {
    const raw = 'p2pchat://user/p2p_abcdef1234';
    const parsed = qrService.parseQrContent(raw);
    expect(parsed).toBe('p2p_abcdef1234');
  });

  it('correctly parses web URL fallback format', () => {
    const webUrl = 'https://chat.example.com/?contact=p2p_5544332211';
    const parsed = qrService.parseQrContent(webUrl);
    expect(parsed).toBe('p2p_5544332211');
  });

  it('returns raw ID if scanned directly without scheme', () => {
    const directId = 'p2p_0123456789';
    const parsed = qrService.parseQrContent(directId);
    expect(parsed).toBe('p2p_0123456789');
  });

  it('rejects invalid scanned payloads', () => {
    expect(qrService.parseQrContent('https://google.com')).toBeNull();
    expect(qrService.parseQrContent('random-garbage')).toBeNull();
    expect(qrService.parseQrContent('')).toBeNull();
  });
});
