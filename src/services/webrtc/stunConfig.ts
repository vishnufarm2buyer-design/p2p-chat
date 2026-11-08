// ============================================================================
// STUN-ONLY WebRTC Configuration
// STRICT ARCHITECTURAL RULE:
// TURN servers are strictly prohibited. Only STUN is used for NAT discovery.
// No TURN fallback, no relays, no commercial coturn or TURN credentials.
// ============================================================================

export const DEFAULT_STUN_SERVERS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302',
  'stun:stun3.l.google.com:19302',
  'stun:stun4.l.google.com:19302',
  'stun:stun.cloudflare.com:3478'
];

/**
 * Validates that an RTCConfiguration adheres strictly to the STUN-only rule.
 * Throws an error if any TURN server is detected.
 */
export function validateStunOnlyConfig(config: RTCConfiguration): RTCConfiguration {
  if (!config.iceServers) {
    return {
      iceServers: DEFAULT_STUN_SERVERS.map(urls => ({ urls }))
    };
  }

  for (const server of config.iceServers) {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    for (const url of urls) {
      if (typeof url === 'string') {
        const lower = url.toLowerCase();
        if (lower.startsWith('turn:') || lower.startsWith('turns:')) {
          throw new Error(
            `VIOLATION OF PRIVACY ARCHITECTURE: TURN server '${url}' is strictly prohibited in P2P Shield Chat. Only STUN is allowed.`
          );
        }
      }
    }
  }

  return config;
}

/**
 * Creates a verified STUN-only WebRTC RTCPeerConnection configuration.
 */
export function createStunOnlyRtcConfiguration(): RTCConfiguration {
  const envServers = import.meta.env.VITE_STUN_SERVERS as string | undefined;
  const stunList = envServers 
    ? envServers.split(',').map(s => s.trim()).filter(Boolean)
    : DEFAULT_STUN_SERVERS;

  // Filter out any accidental turn: entries
  const cleanStuns = stunList.filter(url => 
    !url.toLowerCase().startsWith('turn:') && !url.toLowerCase().startsWith('turns:')
  );

  const config: RTCConfiguration = {
    iceServers: cleanStuns.map(urls => ({ urls })),
    iceCandidatePoolSize: 4
  };

  return validateStunOnlyConfig(config);
}
