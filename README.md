# P2P Shield Chat - Complete Privacy-Focused Peer-to-Peer Messenger (Installable PWA)

> **"The server connects people; their devices communicate."**

P2P Shield Chat is a complete, production-oriented, decentralized online messaging Progressive Web App (PWA) where users communicate directly with one another through encrypted WebRTC peer-to-peer connections.

---

## 1. Architectural Principles & Non-Negotiables

### What the Server Does:
- **Google OAuth Authentication** via Supabase Auth.
- **Account Identity & Public Profiles** (Permanent unique public user ID, Display Name).
- **Public Identity Key Registry** (Public ECDH keys for application E2EE).
- **Contact Relationships & Requests** (Pending, Accepted, Rejected).
- **Group Membership Metadata** (Participant roster for mesh discovery).
- **Online Presence Tracking** via Supabase Realtime Presence.
- **Ephemeral WebRTC Signaling** (Temporary SDP offers, answers, and ICE candidates via ephemeral broadcast channels).

### What the Server STRICTLY Does NOT Do:
- **ZERO Chat Message Storage**: No `messages` or `conversations` tables exist in PostgreSQL.
- **ZERO Media or File Storage**: No Supabase Storage buckets or cloud media services.
- **ZERO Server-Side Message Relaying**: Messages travel directly browser-to-browser via `RTCDataChannel`.
- **ZERO TURN Relay Servers**: Only public STUN is used for NAT discovery. Relays are strictly prohibited to protect privacy.
- **ZERO Gmail Address Exposure or Directory Search**: Email addresses are never exposed to other peers and cannot be searched. Users connect solely via permanent account QR codes or unique public IDs.

---

## 2. Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide React icons.
- **PWA**: `vite-plugin-pwa`, Web App Manifest, Service Worker (static asset caching only, zero chat caching).
- **Peer-to-Peer & Media**: WebRTC (`RTCPeerConnection`, `RTCDataChannel`, `MediaStream`).
- **NAT Discovery**: STUN servers only (`stun:stun.l.google.com:19302`). Strictly NO TURN.
- **Local Storage**: IndexedDB powered by `Dexie.js` for device-bound conversation history.
- **Cryptography**: W3C Web Cryptography API (`SubtleCrypto`): ECDH (P-256) Key Agreement + AES-256-GCM (256-bit) direct payload encryption with unique 12-byte IVs.
- **Backend / Identity**: Supabase (PostgreSQL, Row Level Security, Supabase Auth, Realtime Broadcast & Presence).
- **QR Codes**: `qrcode` library for permanent SVG/PNG generation, `html5-qrcode` for camera/image scanning.

---

## 3. Core Features

### 3.1 Google Authentication & Permanent Identity
- Sign in securely using your Google account via Supabase Auth.
- Every user receives a permanent unique public ID (e.g., `p2p_a1b2c3d4e5`).
- Profile picture is stored **locally on the user's device** in IndexedDB and exchanged directly peer-to-peer over WebRTC, never uploaded to the cloud.
- Display names can be edited at any time without invalidating the user's permanent ID or QR code.

### 3.2 Permanent Identity QR Code
- Automatically generated for every registered account with format: `p2pchat://user/<UNIQUE_PUBLIC_ID>`.
- Does not contain private keys, passwords, or emails.
- Built-in live camera QR scanner and image upload scanner.
- One-click QR PNG image download and Web Share API support.

### 3.3 Contact Management
- Search is restricted strictly to your existing accepted contacts.
- Contact requests require explicit recipient approval.
- Bidirectional contact status synchronization in real time.

### 3.4 One-to-One Peer-to-Peer Chat
- Automatic signaling via ephemeral Supabase Realtime broadcast channels (`p2p:signal:<userA>:<userB>`).
- Direct communication via `RTCDataChannel`.
- Real-time typing indicators.
- Local chat history stored safely in browser IndexedDB.
- Offline behavior honesty: If a contact is offline, the interface explains that a direct P2P connection requires both peers to be online.

### 3.5 Group Messaging (Full Mesh Topology)
- Host-coordinated peer-to-peer full mesh architecture.
- For $N$ members, every participant connects directly to $N - 1$ peers ($N \times (N - 1) / 2$ connections).
- The host creator coordinates initial discovery announcements but **never relays chat messages or files**.
- Optimized for small groups (up to 5 participants) with real-time peer status monitoring for each participant.

### 3.6 Direct File, Image & Video Sharing
- Files up to 50MB transfer directly through chunked `RTCDataChannel` binary packets (16KB chunks).
- Backpressure control via `bufferedAmount` and `bufferedamountlow` event listener.
- Full application-level AES-256-GCM encryption for each chunk.
- Real-time progress bar, cancellation support, and inline image/video previews.

### 3.7 Voice & Video Calling
- Direct browser-to-browser WebRTC `MediaStream` (audio and video tracks).
- Responsive call overlay with Picture-in-Picture (PIP) local preview.
- Call duration timer, mute/unmute microphone, and camera toggle.
- Synthetic Web Audio API ringtone on incoming call dialog.

### 3.8 Network & STUN Diagnostics
- Live WebRTC ICE candidate inspector.
- Verifies that only `host` (local network) and `srflx` (NAT reflexive via STUN) candidates are discovered, proving zero TURN relay usage.

---

## 4. Setup & Installation Instructions

### 4.1 Prerequisites
- Node.js v18 or higher (v20+ recommended).
- A Supabase account (free tier works great).
- A Google Cloud Console project for Google OAuth credentials.

### 4.2 Clone & Install Dependencies
```bash
git clone <your-repo-url>
cd CHAT
npm install
```

### 4.3 Configure Environment Variables
Copy the `.env.example` file to `.env`:
```bash
cp .env.example .env
```
Fill in your Supabase project URL and public Anon key:
```ini
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_STUN_SERVERS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
VITE_MAX_FILE_SIZE_MB=50
```

### 4.4 Set Up the Database Schema in Supabase
1. Open your Supabase Dashboard -> **SQL Editor**.
2. Open `supabase/migrations/20261107_init_p2p_schema.sql` from this repository.
3. Paste and run the entire SQL migration.
4. Verify that the following tables are created:
   - `profiles`
   - `public_keys`
   - `contact_requests`
   - `contacts`
   - `groups`
   - `group_members`
5. Verify that **Realtime** is enabled for `contact_requests`, `contacts`, and `group_members`.

### 4.5 Configure Google OAuth in Supabase
1. Go to Google Cloud Console -> **APIs & Services** -> **Credentials**.
2. Create an **OAuth 2.0 Client ID** (Web application).
3. Set Authorized redirect URI to:
   ```
   https://<your-project-id>.supabase.co/auth/v1/callback
   ```
4. Copy the Client ID and Client Secret into Supabase:
   - Supabase Dashboard -> **Authentication** -> **Providers** -> **Google**.
   - Enable Google provider, paste Client ID and Client Secret, and Save.
5. In Supabase **Authentication** -> **URL Configuration**, set:
   - **Site URL**: `http://localhost:5173` (for development) or `https://your-domain.vercel.app` (for production).
   - Add both local and production URLs to **Redirect URLs**.

---

## 5. Development & Testing

### 5.1 Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 5.2 Run Automated Tests
```bash
npm test
```
Runs 15 automated unit and integration tests verifying:
- Cryptographic key agreement (ECDH P-256 + AES-256-GCM)
- STUN-only enforcement and TURN rejection
- Permanent QR formatting and parsing
- Chunked file transfer and reassembly
- Local IndexedDB persistence and deletion

### 5.3 Production Build
```bash
npm run build
```

---

## 6. How to Test Direct P2P Communication Between Two Users

To test genuine browser-to-browser peer-to-peer messaging:

1. **Option A (Single Computer):**
   - Open [http://localhost:5173](http://localhost:5173) in **Google Chrome** (Normal Profile).
   - Open [http://localhost:5173](http://localhost:5173) in a **Second Browser / Incognito Window / Firefox / Edge**.
   - User A copies their Permanent Public ID (or shows their QR code).
   - User B clicks **+ Add Contact**, enters User A's ID, and clicks **Send Contact Request**.
   - User A sees the notification badge, opens **Contact Requests**, and clicks **Accept**.
   - Both users now appear in each other's contact list with an **Online** status.
   - Click on the contact to open the chat:
     - Notice the status transition: *Signaling...* -> *Establishing P2P...* -> *Direct P2P Connected (E2EE)*.
     - Send a text message: delivered directly via `RTCDataChannel`.
     - Send an image/PDF: transferred in encrypted chunks.
     - Click the **Phone** or **Video** icon: initiates direct media calling with live camera/microphone streams.

2. **Option B (Two Separate Devices / Mobile & Desktop):**
   - Deploy to Vercel (or run via local network IP with HTTPS).
   - User A on Phone displays their Permanent QR code.
   - User B on Laptop clicks **Add Contact** -> **Scan Permanent QR** and scans User A's phone screen.
   - Accept the contact request and chat directly device-to-device.

---

## 7. Known Limitations & Honest Disclosures

1. **Offline Messaging is Not Supported by Design**: Because chat messages are never stored on a server, messages cannot be delivered while a recipient is offline. Both users must have an active session to communicate.
2. **Symmetric NAT / Strict Enterprise Firewalls**: Without TURN relay fallbacks, direct WebRTC connections cannot traverse double-symmetric NATs or restrictive corporate firewalls. The application will honestly report connection failure rather than routing through an intermediary.
3. **PWA Background Execution**: Browsers suspend WebRTC connections when tabs are killed or put to sleep on mobile devices. Reconnection is attempted automatically when the tab is reopened.
