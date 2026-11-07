# Security & Cryptographic Architecture

P2P Shield Chat was architected from the ground up to prevent server-side interception or surveillance of user communications.

---

## 1. Cryptographic Key Lifecycle

### 1.1 Key Generation (Device-Bound)
- When a user initializes the application, an **ECDH (Elliptic Curve Diffie-Hellman) P-256** keypair is generated via the browser's native W3C Web Cryptography API (`crypto.subtle.generateKey`).
- **Private Key Isolation**: The private key is non-extractable or stored strictly within the client device's IndexedDB (`P2PChatLocalDB`). **It is never transmitted to Supabase, any API, or any third party.**
- **Public Key Registration**: The public key is exported as a standard JSON Web Key (JWK) and published to the Supabase `public_keys` table.

### 1.2 Session Secret Derivation (ECDH)
- When User A establishes a direct P2P data connection with User B:
  $$\text{SharedKey}_{A,B} = \text{ECDH}(\text{PrivateKey}_A, \text{PublicKey}_B)$$
- User B independently derives the identical shared key:
  $$\text{SharedKey}_{B,A} = \text{ECDH}(\text{PrivateKey}_B, \text{PublicKey}_A)$$
- This derives a 256-bit symmetric key (`AES-GCM`, 256 bits).
- The derived key resides solely in client JavaScript memory during the active session.

### 1.3 Payload Encryption (AES-256-GCM)
- Every text message and binary file chunk sent over `RTCDataChannel` is encrypted using `AES-GCM`:
  - **Cipher**: AES-GCM 256-bit
  - **IV**: Fresh 12-byte cryptographically secure random value (`crypto.getRandomValues(new Uint8Array(12))`) per packet.
  - **Authentication Tag**: Embedded within the GCM ciphertext to detect tampering.
- Even in the theoretical event of transport-level inspection, application-level AES-256-GCM ensures absolute confidentiality.

---

## 2. Server Architectural Boundary & Zero Storage

| Component | Handled by Server | Stored on Server | Relayed by Server |
|---|---|---|---|
| **Google Auth** | Yes (Supabase Auth) | Yes (Auth UID) | No |
| **Public Profiles** | Yes (PostgreSQL) | Yes (Display name, Public ID) | No |
| **Contact Requests** | Yes (PostgreSQL) | Yes (Relationship IDs) | No |
| **Group Metadata** | Yes (PostgreSQL) | Yes (Group name, Members) | No |
| **Online Presence** | Yes (Realtime) | Ephemeral in-memory | No |
| **WebRTC Signaling** | Yes (Realtime Broadcast) | Ephemeral (zero storage) | Temporary broadcast |
| **Chat Messages** | **NO** | **NO** (Zero database table) | **NO** (Direct P2P DataChannel) |
| **Files & Media** | **NO** | **NO** (Zero storage buckets) | **NO** (Direct P2P DataChannel) |
| **Voice Audio** | **NO** | **NO** | **NO** (Direct WebRTC MediaStream) |
| **Video Streams** | **NO** | **NO** | **NO** (Direct WebRTC MediaStream) |
| **Private Keys** | **NO** | **NO** | **NO** (Kept in client IndexedDB) |

---

## 3. STUN vs. TURN Security Rationale

### Why TURN Servers Are Strictly Prohibited:
TURN (Traversal Using Relays around NAT) introduces an intermediary server that receives, decrypts/re-encrypts transport packets, and forwards all user traffic when direct connections fail. While standard WebRTC uses DTLS, running a relay server presents significant privacy risks:
- Bandwidth metadata leaks (traffic analysis, packet sizes, durations, IP addresses).
- Potential for centralized interception if the relay server is compromised.
- Misleads users about the decentralized nature of the application.

### STUN-Only Policy:
P2P Shield Chat uses Google STUN servers (`stun:stun.l.google.com:19302`) solely for NAT address discovery:
- STUN servers only inform the client of its public-facing IP address and port mapping.
- STUN servers **never receive or relay communication payload data**.
- If two users are behind symmetric NATs or corporate firewalls that prevent direct connectivity, the application clearly reports the restriction rather than silently compromising privacy via a relay.
