import { describe, it, expect } from 'vitest';
import { 
  validateStunOnlyConfig, 
  createStunOnlyRtcConfiguration 
} from '../src/services/webrtc/stunConfig';

describe('STUN-Only WebRTC Enforcement (Rule 2.2)', () => {
  it('allows valid Google STUN configurations', () => {
    const config = createStunOnlyRtcConfiguration();
    expect(config.iceServers).toBeDefined();

    for (const server of config.iceServers!) {
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
      for (const url of urls) {
        expect(url.startsWith('stun:')).toBe(true);
        expect(url.startsWith('turn:')).toBe(false);
        expect(url.startsWith('turns:')).toBe(false);
      }
    }
  });

  it('strictly throws an exception if any TURN server is introduced', () => {
    const illegalConfig: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'turn:relay.example.com:3478' }
      ]
    };

    expect(() => validateStunOnlyConfig(illegalConfig)).toThrow(
      /VIOLATION OF PRIVACY ARCHITECTURE/
    );
  });

  it('strictly throws an exception if TURNS is introduced', () => {
    const illegalConfig: RTCConfiguration = {
      iceServers: [
        { urls: ['turns:relay.example.com:5349'] }
      ]
    };

    expect(() => validateStunOnlyConfig(illegalConfig)).toThrow(
      /VIOLATION OF PRIVACY ARCHITECTURE/
    );
  });
});
