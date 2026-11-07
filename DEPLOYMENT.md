# Production Deployment Guide (Vercel & Supabase)

This guide walks you through deploying **P2P Shield Chat** to production on **Vercel** with **Supabase** backend services.

---

## 1. Supabase Production Setup

### 1.1 Create Supabase Project
1. Log in to [supabase.com](https://supabase.com) and create a new project.
2. Note your **Project URL** and **Anon Key** from **Project Settings** -> **API**.

### 1.2 Run Database Migrations
1. Open the Supabase **SQL Editor**.
2. Copy the entire contents of `supabase/migrations/20261107_init_p2p_schema.sql`.
3. Paste into the SQL editor and execute.
4. Verify that Row Level Security (RLS) is active on:
   - `profiles`
   - `public_keys`
   - `contact_requests`
   - `contacts`
   - `groups`
   - `group_members`
5. Note: Confirm that NO message or conversation tables exist.

### 1.3 Enable Realtime Publications
Verify under **Database** -> **Replication** that `contact_requests`, `contacts`, and `group_members` are published to `supabase_realtime`.

### 1.4 Configure Google OAuth
1. In [Google Cloud Console](https://console.cloud.google.com/):
   - Go to **APIs & Services** -> **Credentials**.
   - Create an **OAuth 2.0 Client ID** (Web application).
   - Add Authorized redirect URI:
     ```
     https://<your-supabase-project-id>.supabase.co/auth/v1/callback
     ```
2. In Supabase Dashboard -> **Authentication** -> **Providers** -> **Google**:
   - Enable Google authentication.
   - Enter your Google Client ID and Google Client Secret.
3. In Supabase Dashboard -> **Authentication** -> **URL Configuration**:
   - Add your production domain: `https://<your-app>.vercel.app`.

---

## 2. Deploying to Vercel

### 2.1 Connect Repository to Vercel
1. Push your repository to GitHub.
2. Log in to [vercel.com](https://vercel.com) and click **Add New...** -> **Project**.
3. Import your `CHAT` repository.

### 2.2 Configure Build Settings & Environment Variables
- **Framework Preset**: Vite
- **Root Directory**: `./`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

Add the following Environment Variables in the Vercel dashboard:

| Variable Name | Description | Example Value |
|---|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL | `https://xyzproject.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Your public Supabase anon key | `eyJhbGciOi...` |
| `VITE_STUN_SERVERS` | STUN servers (strictly NO TURN) | `stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302` |
| `VITE_MAX_FILE_SIZE_MB` | Max P2P file chunk size | `50` |

### 2.3 Single-Page App (SPA) Routing on Vercel
Create a `vercel.json` file in the root directory if routing rewrites are needed:
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

### 2.4 Deploy
Click **Deploy**. Vercel will build the TypeScript project, bundle the assets, generate the PWA service worker and manifest, and provide you with a live HTTPS URL.

---

## 3. Production HTTPS & PWA Verification

- **HTTPS Requirement**: WebRTC `getUserMedia` (camera/mic) and the Service Worker API require HTTPS in production browsers. Vercel provides automatic SSL certificates for all deployments.
- **PWA Installation**: When visiting your Vercel URL in Chrome, Edge, or Safari, the install prompt will appear in the address bar or application header ("Install App").
