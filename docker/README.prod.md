# Production Docker (Backend + Keycloak + Redis)

Runs backend, Keycloak, and Redis on your server. MongoDB (Atlas) and Keycloak DB (Neon) stay in the cloud. Expose backend and Keycloak via Cloudflare Tunnel.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Your Server (Docker)                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                       │
│  │ Backend  │  │ Keycloak │  │  Redis   │                       │
│  │  :3001   │  │  :8080   │  │ (internal)│                      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                        │
│       │             │             │                              │
│       └─────────────┼─────────────┘                              │
│                     │  billpromax-network                        │
└─────────────────────┼───────────────────────────────────────────┘
                      │
         Cloudflare Tunnel (localhost:3001, localhost:8080)
                      │
┌─────────────────────┼───────────────────────────────────────────┐
│  Internet           ▼                                            │
│  https://api.yourdomain.com  https://auth.yourdomain.com         │
└─────────────────────────────────────────────────────────────────┘
```

## Setup

### 1. Backend env

```bash
cd bill-pro-max-backend-v2
cp .env.production.example .env.production
# Edit: MONGODB_URI (Atlas), JWT_ISSUER (public Keycloak URL), CORS_ORIGIN, etc.
```

### 2. Docker env (Keycloak)

```bash
cd docker
cp .env.example .env   # or merge with existing .env
# Ensure: KC_DB_* (Neon), KC_HOSTNAME (public Keycloak hostname)
```

### 3. Realm redirect URIs

In `keycloak/realm-export.json`, add your public frontend URL to `redirectUris` and `webOrigins` for the `billpromax-frontend` client.

### 4. Cloudflare Tunnel

1. Install `cloudflared`
2. Create a tunnel and route:
   - `api.yourdomain.com` → `http://localhost:3001`
   - `auth.yourdomain.com` → `http://localhost:8080`
3. Set `KC_HOSTNAME=auth.yourdomain.com` in `docker/.env`
4. Set `JWT_ISSUER=https://auth.yourdomain.com/realms/billpromax` in `.env.production`

### 5. Start

```bash
cd docker
docker compose -f docker-compose.prod.yml up -d
```

## Verify

```bash
curl http://localhost:3001/health
curl http://localhost:8080/health/ready
```

## Notes

- **Redis** is not exposed; only backend uses it.
- **Keycloak** uses `KC_PROXY=edge` for Cloudflare.
- **JWT_ISSUER** must match the public Keycloak URL (tokens are issued to the browser at that URL).
- **Keycloak** runs with `start-dev` for faster boot with Neon (serverless cold start). For strict production, change to `start --import-realm` in docker-compose.prod.yml.

## Troubleshooting

**Keycloak / Backend startup:**
- Backend starts when Keycloak container is running (no health check; image lacks curl/wget).
- Keycloak typically ready in ~30s. Auth may fail briefly if requests hit before Keycloak is up.
- Logs: `docker logs billpromax-keycloak`
