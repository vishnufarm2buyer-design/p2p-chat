import { describe, it, expect } from 'vitest';
import { securityService } from '../src/services/security';

describe('SecurityService & Safety Number Fingerprint', () => {
  it('should calculate a 60-digit Signal-compatible Safety Number with 12 blocks of 5 digits', async () => {
    const keyA = JSON.stringify({ kty: 'EC', crv: 'P-256', x: 'abc123456789', y: 'def987654321' });
    const keyB = JSON.stringify({ kty: 'EC', crv: 'P-256', x: 'xyz123456789', y: 'uvw987654321' });

    const fingerprint = await securityService.calculateSafetyNumber(keyA, keyB);

    // Formatted as 12 groups of 5 digits separated by spaces
    const parts = fingerprint.split(' ');
    expect(parts.length).toBe(12);
    for (const part of parts) {
      expect(part.length).toBe(5);
      expect(/^\d{5}$/.test(part)).toBe(true);
    }

    // Commutative check: order of keyA and keyB should yield identical fingerprint
    const commutativeFingerprint = await securityService.calculateSafetyNumber(keyB, keyA);
    expect(commutativeFingerprint).toBe(fingerprint);
  });
});
