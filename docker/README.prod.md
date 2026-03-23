# Production Docker (Backend + Redis)

Runs backend and Redis on your server. MongoDB (Atlas) stays in the cloud. Authentication is handled by Supabase (hosted). Expose backend via Cloudflare Tunnel.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Your Server (Docker)                                           │
│  ┌──────────┐  ┌──────────┐                                     │
│  │ Backend  │  │  Redis   │                                     │
│  │  :3001   │  │ (internal)│                                    │
│  └────┬─────┘  └────┬─────┘                                    │
│       │             │                                            │
│       └─────────────┘                                            │
│          billpromax-network                                      │
└──────────────┬──────────────────────────────────────────────────┘
               │
  Cloudflare Tunnel (localhost:3001)
               │
┌──────────────┼──────────────────────────────────────────────────┐
│  Internet    ▼                                                   │
│  https://api.yourdomain.com                                      │
└─────────────────────────────────────────────────────────────────┘

External services:
  • Supabase Auth (hosted) — user login, JWT issuance, OAuth
  • MongoDB Atlas — application database
```

## Setup

### 1. Backend env

```bash
cd bill-pro-max-backend-v2
cp .env.production.example .env.production
# Edit: MONGODB_URI (Atlas), SUPABASE_* keys, CORS_ORIGIN, etc.
```

### 2. Cloudflare Tunnel

1. Install `cloudflared`
2. Create a tunnel and route:
   - `api.yourdomain.com` → `http://localhost:3001`
3. Set `CORS_ORIGIN` and `FRONTEND_URL` in `.env.production`

### 3. Start

```bash
cd docker
docker compose -f docker-compose.prod.yml up -d
```

## Verify

```bash
curl http://localhost:3001/health
```

## Notes

- **Redis** is not exposed; only backend uses it for job queues.
- **Supabase Auth** is fully hosted — no auth server to manage in Docker.
- Backend verifies Supabase JWTs locally using JWKS public key (cached, no per-request API calls to Supabase).

## Troubleshooting

**Backend startup:**
- Backend connects to MongoDB Atlas on startup. Ensure `MONGODB_URI` is correct.
- Logs: `docker logs billpromax-backend`
