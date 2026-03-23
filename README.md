# BillProMax Backend V2

A Node.js/Express backend for scaffolding rental business management, featuring Supabase authentication, MongoDB data storage, and an in-house billing engine.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [File Structure](#file-structure)
- [Getting Started](#getting-started)
- [Authentication](#authentication)
- [Database Schema](#database-schema)
- [Billing Engine](#billing-engine)
- [Background Jobs](#background-jobs)
- [API Endpoints](#api-endpoints)
- [Docker Guide](#docker-guide)
- [Debugging](#debugging)
- [Development Guide](#development-guide)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                   FRONTEND (React SPA)                               │
└───────────────────────────────────────┬─────────────────────────────────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    │                                       │
                    ▼                                       ▼
┌───────────────────────────────┐           ┌───────────────────────────────┐
│       SUPABASE AUTH           │           │    EXPRESS BACKEND (V2)       │
│   (Hosted Auth Service)       │           │    Port: 3001                 │
│                               │           │                               │
│   • Login / Sign Up           │  JWKS     │  ┌─────────────────────────┐  │
│   • Google OAuth              │  Verify   │  │    Middleware Layer     │  │
│   • Token Issuance (ES256)    │◄──────────│  │  • Supabase JWT Auth    │  │
│   • Auto Token Refresh        │           │  │  • RBAC                 │  │
│                               │           │  │  • Business Scope       │  │
└───────────────────────────────┘           │  │  • Validation (Zod)     │  │
                                            │  └─────────────────────────┘  │
                                            │              │                │
                                            │              ▼                │
                                            │  ┌─────────────────────────┐  │
                                            │  │    Service Layer        │  │
                                            │  │  • PartyService         │  │
                                            │  │  • InventoryService     │  │
                                            │  │  • ChallanService       │  │
                                            │  │  • BillingService       │  │
                                            │  │  • PaymentService       │  │
                                            │  │  • NotificationService  │  │
                                            │  └─────────────────────────┘  │
                                            │              │                │
                                            │              ▼                │
                                            │  ┌─────────────────────────┐  │
                                            │  │   Repository Layer      │  │
                                            │  │  (Data Access)          │  │
                                            │  └─────────────────────────┘  │
                                            └──────────────┬────────────────┘
                                                           │
                        ┌──────────────────────────────────┼──────────────────────────┐
                        │                                  │                          │
                        ▼                                  ▼                          ▼
          ┌──────────────────────┐           ┌──────────────────────┐    ┌──────────────────────┐
          │       MongoDB        │           │        Redis         │    │   Bull Job Queues    │
          │  (Application DB)    │           │  (Queue Backend)     │    │                      │
          │                      │           │                      │    │   • Billing Jobs     │
          │   Collections:       │           │   • Job Storage      │    │   • Notification Jobs│
          │   • businesses       │           │   • Job State        │    │   • Reminder Jobs    │
          │   • parties          │           │                      │    │                      │
          │   • inventory        │           └──────────────────────┘    └──────────────────────┘
          │   • challans         │
          │   • bills            │
          │   • payments         │
          │   • purchases        │
          └──────────────────────┘
```

### Request Flow

```
HTTP Request
     │
     ▼
┌─────────────────┐
│  Express App    │
│  (server.ts)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Security       │────▶│  Auth           │────▶│  Validation     │
│  (helmet, cors) │     │ (supabaseAuth)  │     │  (Zod schemas)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                         │
         ┌───────────────────────────────────────────────┘
         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  RBAC           │────▶│  Business Scope │────▶│  Controller     │
│  (permissions)  │     │  (multi-tenant) │     │  (request handler)
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                         │
         ┌───────────────────────────────────────────────┘
         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Service        │────▶│  Repository     │────▶│  MongoDB        │
│  (business logic)     │  (data access)  │     │  (database)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 18+ |
| Framework | Express.js |
| Language | TypeScript |
| Database | MongoDB (Mongoose ODM) |
| Authentication | Supabase Auth (JWT/JWKS, ES256) |
| Job Queue | Bull (Redis-backed) |
| PDF Generation | @react-pdf/renderer |
| Email | Resend |
| Validation | Zod |
| Logging | Winston |

---

## File Structure

```
bill-pro-max-backend-v2/
├── docker/                           # Docker configuration
│   ├── docker-compose.yml            # Dev services (MongoDB, Redis)
│   └── docker-compose.prod.yml       # Production services
│
├── src/
│   ├── server.ts                     # ENTRY POINT - Express server setup
│   │
│   ├── config/                       # Configuration files
│   │   ├── index.ts                  # App config (ports, env vars)
│   │   ├── database.ts               # MongoDB connection
│   │   └── supabase.ts               # Supabase settings
│   │
│   ├── middleware/                   # Request processing
│   │   ├── supabaseAuth.ts           # JWT validation (JWKS, ES256)
│   │   ├── rbac.ts                   # Role-based access control
│   │   ├── businessScope.ts          # Multi-tenant isolation
│   │   ├── validation.ts             # Zod schema validation
│   │   └── errorHandler.ts           # Centralized error handling
│   │
│   ├── models/                       # Mongoose schemas
│   │   ├── Business.ts               # Business entity
│   │   ├── Party.ts                  # Clients/Suppliers + Agreements
│   │   ├── Inventory.ts              # Rental items
│   │   ├── Challan.ts                # Delivery/Return documents
│   │   ├── Bill.ts                   # Invoices
│   │   ├── Payment.ts                # Payment records
│   │   └── Purchase.ts               # Supplier purchases
│   │
│   ├── repositories/                 # Data access layer
│   │   ├── BaseRepository.ts         # Generic CRUD operations
│   │   └── [Entity]Repository.ts     # Entity-specific queries
│   │
│   ├── services/                     # Business logic
│   │   ├── PartyService.ts           # Client/Supplier operations
│   │   ├── InventoryService.ts       # Stock management
│   │   ├── ChallanService.ts         # Delivery/Return handling
│   │   ├── BillingService.ts         # Bill generation
│   │   ├── PaymentService.ts         # Payment processing
│   │   └── NotificationService.ts    # Email/WhatsApp
│   │
│   ├── billing/                      # In-house billing engine
│   │   ├── BillingCalculator.ts      # CORE: Rental calculations
│   │   ├── InvoiceGenerator.ts       # PDF generation
│   │   └── utils/
│   │       ├── dateUtils.ts          # Date calculations
│   │       └── mathUtils.ts          # Financial math
│   │
│   ├── jobs/                         # Background jobs (Bull)
│   │   ├── scheduler.ts              # Job queue setup & schedules
│   │   ├── billingJob.ts             # Monthly billing, overdue checks
│   │   ├── notificationJob.ts        # Email/WhatsApp sending
│   │   └── reminderJob.ts            # Payment reminders
│   │
│   ├── routes/                       # API routes
│   │   └── v1/
│   │       ├── index.ts              # Route aggregation
│   │       └── [entity].ts           # Entity routes
│   │
│   ├── controllers/                  # HTTP request handlers
│   │   └── [Entity]Controller.ts     # One per entity
│   │
│   ├── templates/                    # PDF templates
│   │   ├── invoice.tsx               # Invoice PDF (React-PDF)
│   │   └── challan.tsx               # Challan PDF
│   │
│   ├── types/                        # TypeScript types
│   │   ├── domain.ts                 # Core domain interfaces
│   │   └── api.ts                    # API schemas (Zod)
│   │
│   └── utils/
│       ├── logger.ts                 # Winston logging
│       └── helpers.ts                # Utility functions
│
├── .env.example                      # Environment variables template
├── package.json                      # Dependencies
└── tsconfig.json                     # TypeScript config
```

### Important Files by Task

| Task | Files to Edit |
|------|---------------|
| Add new API endpoint | `src/routes/v1/*.ts`, `src/controllers/*.ts` |
| Change business logic | `src/services/*.ts` |
| Modify billing calculations | `src/billing/BillingCalculator.ts` |
| Add new data fields | `src/models/*.ts` |
| Change authentication/permissions | `src/middleware/rbac.ts`, `supabaseAuth.ts` |
| Configure Docker services | `docker/docker-compose.yml` |
| Add environment variables | `.env`, `src/config/index.ts` |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Docker & Docker Compose (for MongoDB and Redis)
- npm or yarn
- Supabase project (free tier works)

### Quick Start

```bash
# 1. Start infrastructure services (MongoDB, Redis)
cd docker
docker-compose up -d

# 2. Copy environment file
cd ..
cp .env.example .env
# Fill in your Supabase keys (from Supabase dashboard > Settings > API)

# 3. Install dependencies
npm install

# 4. Start development server
npm run dev
```

### Verify Installation

```bash
# Check backend health
curl http://localhost:3001/health
```

---

## Authentication

### Flow Diagram

```
  ┌─────────┐                    ┌──────────┐                    ┌─────────────┐
  │ Browser │                    │ Supabase │                    │   Backend   │
  └────┬────┘                    └────┬─────┘                    └──────┬──────┘
       │                              │                                 │
       │  1. User signs in            │                                 │
       │  (email/password or Google)  │                                 │
       │──────────────────────────────>                                 │
       │                              │                                 │
       │  2. JWT Token (ES256)        │                                 │
       │<─────────────────────────────│                                 │
       │                              │                                 │
       │  3. API Request with         │                                 │
       │     Authorization: Bearer    │                                 │
       │──────────────────────────────────────────────────────────────────>
       │                              │                                 │
       │                              │  4. Verify JWT locally          │
       │                              │     (JWKS public key, cached)   │
       │                              │                                 │
       │  5. API Response             │                                 │
       │<─────────────────────────────────────────────────────────────────
```

Token verification is **local** — no network call to Supabase per request. The JWKS public key is fetched once and cached for 1 hour.

### JWT Token Structure

```json
{
  "sub": "user-uuid",
  "email": "john@example.com",
  "user_metadata": {
    "firstName": "John",
    "lastName": "Doe",
    "full_name": "John Doe"
  },
  "role": "authenticated"
}
```

### Role Hierarchy

```
owner
  └── manager
        └── staff
              └── viewer

accountant
  └── viewer

client-portal (external clients)
```

### Permission Matrix

| Role | Business | Party | Inventory | Challan | Bill | Payment | Report |
|------|----------|-------|-----------|---------|------|---------|--------|
| owner | manage | manage | manage | manage | manage | manage | manage |
| manager | read | manage | manage | manage | create/read | create/read | read |
| staff | - | read | read | create/read/update | read | - | - |
| accountant | - | read | read | read | manage | manage | read |
| viewer | - | read | read | read | read | read | read |
| client-portal | - | - | - | read (own) | read (own) | read (own) | - |

---

## Database Schema

### Entity Relationships

```
Business (1) ──────────────────────┐
     │                             │ owns
     │ has many                    ▼
     ▼                     ┌───────────────┐
┌──────────┐               │   Inventory   │
│  Party   │──references───│   (items)     │
│          │               └───────────────┘
│          │                       ▲
│ Contains │                       │ items in
│    ▼     │                       │
│Agreement │               ┌───────────────┐
│(embedded)│──────────────▶│    Challan    │
└──────────┘               │ (delivery/    │
     ▲                     │  return)      │
     │ partyId             └───────────────┘
     │                             │
     │                             │ generates
     │                             ▼
     │                     ┌───────────────┐
     └─────────────────────│     Bill      │
                           │  (invoice)    │
                           └───────────────┘
                                   │
                                   │ linked to
                                   ▼
                           ┌───────────────┐
                           │   Payment     │
                           └───────────────┘
```

### Multi-Tenant Isolation

Every document contains a `businessId` field. All queries automatically filter by it:

```typescript
// Example from PartyRepository
async findClients(businessId: string): Promise<IParty[]> {
  return this.model.find({
    businessId,          // Always filter by tenant
    roles: 'client',
    isActive: true
  });
}
```

### Embedded Documents

Agreements are embedded within Party documents:

```javascript
{
  "_id": "party-123",
  "businessId": "business-456",
  "name": "ABC Construction",
  "roles": ["client"],
  "agreements": [           // Embedded array
    {
      "agreementId": "AGR-001",
      "startDate": "2025-01-01",
      "terms": { "billingCycle": "monthly", "paymentDueDays": 15 },
      "rates": [
        { "itemId": "inventory-id", "ratePerDay": 50 }
      ]
    }
  ]
}
```

---

## Billing Engine

### Calculation Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              BillingService.generateBill()                       │
│                                                                                  │
│   1. Get Party with active Agreement                                            │
│   2. Get Delivery Challans for billing period                                   │
│   3. Get Return Challans for billing period                                     │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           BillingCalculator.calculatePeriodBilling()             │
│                                                                                  │
│   For each item in delivery challans:                                           │
│                                                                                  │
│   Delivery Date: Jan 5                                                          │
│   Return Date: Jan 20 (or billing period end if not returned)                   │
│   Rental Days: 15 days                                                          │
│                                                                                  │
│   Formula: Quantity × Rate per Day × Rental Days                                │
│            10 items × ₹50/day × 15 days = ₹7,500                                │
│                                                                                  │
│   Subtotal + Tax (18% GST) - Discount = Total Amount                            │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           InvoiceGenerator.generateInvoicePdf()                  │
│                                                                                  │
│   Uses @react-pdf/renderer with React components                                 │
│   Templates: src/templates/invoice.tsx, challan.tsx                             │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Key Files

- `src/billing/BillingCalculator.ts` - Core calculation logic
- `src/billing/InvoiceGenerator.ts` - PDF generation
- `src/services/BillingService.ts` - Orchestrates billing operations
- `src/templates/invoice.tsx` - Invoice PDF template

---

## Background Jobs

### Queue Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                   Bull Queues                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐  │
│   │   billingQueue      │   │  notificationQueue  │   │   reminderQueue     │  │
│   │                     │   │                     │   │                     │  │
│   │  • Monthly billing  │   │  • Invoice emails   │   │  • Payment due      │  │
│   │  • Overdue check    │   │  • Payment reminder │   │    reminders        │  │
│   │  • PDF generation   │   │  • WhatsApp msgs    │   │                     │  │
│   └─────────────────────┘   └─────────────────────┘   └─────────────────────┘  │
│              │                        │                        │               │
│              └────────────────────────┼────────────────────────┘               │
│                                       │                                         │
│                                       ▼                                         │
│                              ┌─────────────────┐                               │
│                              │      Redis      │                               │
│                              │  (Job Storage)  │                               │
│                              └─────────────────┘                               │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Scheduled Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| Monthly Billing | 1st of month, 00:00 | Generate bills for all active agreements |
| Overdue Check | Daily, 09:00 | Mark overdue bills, send notices |
| Payment Due Check | Daily, 10:00 | Send payment reminders |

### Job Files

- `src/jobs/scheduler.ts` - Queue setup and cron schedules
- `src/jobs/billingJob.ts` - Billing job processors
- `src/jobs/notificationJob.ts` - Email/WhatsApp processors
- `src/jobs/reminderJob.ts` - Reminder processors

---

## API Endpoints

### Base URL

```
http://localhost:3001/api/v1
```

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/businesses` | List user's businesses |
| GET | `/businesses/:id` | Get business details |
| GET | `/businesses/:id/parties` | List parties (clients/suppliers) |
| POST | `/businesses/:id/parties` | Create party |
| GET | `/businesses/:id/inventory` | List inventory items |
| POST | `/businesses/:id/inventory` | Add inventory item |
| GET | `/businesses/:id/challans` | List challans |
| POST | `/businesses/:id/challans` | Create challan |
| PATCH | `/businesses/:id/challans/:challanId/confirm` | Confirm challan |
| GET | `/businesses/:id/bills` | List bills |
| POST | `/businesses/:id/bills/generate` | Generate bill |
| GET | `/businesses/:id/bills/:billId/pdf` | Download bill PDF |
| GET | `/businesses/:id/payments` | List payments |
| POST | `/businesses/:id/payments` | Record payment |
| GET | `/businesses/:id/reports/summary` | Get business summary |

### Authentication

All endpoints (except `/health`) require:

```
Authorization: Bearer <supabase_jwt_token>
```

---

## Docker Guide

### Services

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Docker Compose Services                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌─────────────────────┐     ┌─────────────────────┐                           │
│   │   mongodb           │     │   redis             │                           │
│   │   Port: 27017       │     │   Port: 6379        │                           │
│   │                     │     │                     │                           │
│   │   Stores:           │     │   Stores:           │                           │
│   │   • App data        │     │   • Job queues      │                           │
│   │   • Parties         │     │   • Job state       │                           │
│   │   • Bills           │     │                     │                           │
│   └─────────────────────┘     └─────────────────────┘                           │
│                                                                                 │
│   Network: billpromax-network (Docker bridge)                                   │
│                                                                                 │
│   Auth: Supabase (hosted, no Docker service needed)                             │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Common Commands

```bash
# Navigate to docker directory
cd docker

# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View running containers
docker ps

# View logs (follow mode)
docker logs billpromax-mongodb -f
docker logs billpromax-redis -f

# Restart a specific service
docker-compose restart mongodb

# Check service health
docker-compose ps

# View resource usage
docker stats

# Access MongoDB shell
docker exec -it billpromax-mongodb mongosh -u billpromax -p password

# Access Redis CLI
docker exec -it billpromax-redis redis-cli

# Remove all data and start fresh
docker-compose down -v   # -v removes volumes (data)
docker-compose up -d
```

### Monitoring

```bash
# Check if services are healthy
docker inspect billpromax-mongodb --format='{{.State.Health.Status}}'
# Output: healthy

# View network connections
docker network inspect billpromax-network
```

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Can't connect to MongoDB | Check if container is running: `docker ps` |
| Redis connection refused | Ensure Redis container is up |
| Port already in use | Stop other services or change ports in docker-compose.yml |

---

## Debugging

### Log Levels

```typescript
// Development: Colored console output
// Production: JSON format + file logs in logs/

logger.error('Critical error', { error })     // Always shown
logger.warn('Warning message', { context })   // Always shown
logger.info('General info', { data })         // Production default
logger.debug('Detailed debug', { details })   // Development only
```

### Common Debug Scenarios

**1. Authentication Issues:**

```bash
# Test token validation
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/v1/businesses

# Look for logs:
# "User authenticated" (success)
# "JWT verification failed" / "Token has expired" (failure)
# "JWKS public key cached successfully" (startup)
```

**2. Database Issues:**

```bash
# Check MongoDB connection
docker exec billpromax-mongodb mongosh --eval "db.adminCommand('ping')"

# Query collections
docker exec -it billpromax-mongodb mongosh billpromax
> db.parties.find({ businessId: ObjectId("...") })
```

**3. Background Job Issues:**

```bash
# Check Redis
docker exec billpromax-redis redis-cli ping

# Monitor in logs:
# "Billing job completed" / "Billing job failed"
```

**4. Add Debug Logging:**

```typescript
import { logger } from '../utils/logger';

async createParty(data) {
  logger.debug('Creating party', { data });

  try {
    const party = await this.repository.create(data);
    logger.info('Party created', { partyId: party._id });
    return party;
  } catch (error) {
    logger.error('Failed to create party', { error, data });
    throw error;
  }
}
```

---

## Development Guide

### Scripts

```bash
npm run dev       # Start with hot reload (nodemon)
npm run build     # Compile TypeScript
npm run start     # Run compiled code
npm run lint      # Run ESLint
npm run format    # Format with Prettier
npm run test      # Run tests
```

### Adding a New Entity

1. **Create Model** (`src/models/NewEntity.ts`)
2. **Create Repository** (`src/repositories/NewEntityRepository.ts`)
3. **Create Service** (`src/services/NewEntityService.ts`)
4. **Create Controller** (`src/controllers/NewEntityController.ts`)
5. **Create Routes** (`src/routes/v1/newEntity.ts`)
6. **Add to v1 Router** (`src/routes/v1/index.ts`)

### Environment Variables

See `.env.example` for all available configuration options:

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3000 |
| NODE_ENV | Environment | development |
| MONGODB_URI | MongoDB connection | mongodb://localhost:27017 |
| REDIS_URL | Redis connection | redis://localhost:6379 |
| SUPABASE_URL | Supabase project URL | - |
| SUPABASE_ANON_KEY | Supabase anonymous key | - |
| SUPABASE_JWT_SECRET | Supabase JWT secret | - |
| RESEND_API_KEY | Email service key | - |

---

---

## Production Deployment

### Server + Cloudflare Tunnel (Backend + Redis)

For hosting on your own server with MongoDB Atlas:

```bash
cd docker
# 1. Configure ../.env.production (MONGODB_URI, SUPABASE_*, CORS_ORIGIN)
# 2. Expose via Cloudflare Tunnel: api.* → localhost:3001
docker compose -f docker-compose.prod.yml up -d
```

See `docker/README.prod.md` for full setup.

### Dockerfile

The repo includes a multi-stage `Dockerfile`:

```bash
# Build the image
docker build -t billpromax-backend .

# Run the container
docker run -p 3001:3001 --env-file .env billpromax-backend
```

### Deployment Targets

| Platform | Method |
|----------|--------|
| Render.com | Connect GitHub repo, auto-deploys on push |
| Docker/VPS | `docker build` + `docker run` |
| Local production test | `docker/docker-compose.prod.yml` (Backend + Redis, Cloudflare Tunnel) |

### Production Environment Variables

In addition to the dev variables, set these for production:

| Variable | Example | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Enables production optimizations |
| `CORS_ORIGIN` | `https://app.billpromax.com` | Frontend domain (not `*`) |
| `RATE_LIMIT_MAX` | `500` | Max requests per 15 min per IP |
| `MONGODB_URI` | `mongodb+srv://...` | MongoDB Atlas connection string |
| `REDIS_URL` | See below | Redis for Bull queues and bulk bill generation |
| `SUPABASE_URL` | `https://xxx.supabase.co` | Supabase project URL |
| `SUPABASE_ANON_KEY` | `eyJ...` | From Supabase dashboard |
| `SUPABASE_JWT_SECRET` | `...` | From Supabase dashboard |

### Redis in Production

Redis is required for background jobs (monthly billing, overdue checks) and async bill generation (single + bulk). Options:

**1. Managed Redis (recommended)**

- **Upstash** (serverless): Create a Redis database at [upstash.com](https://upstash.com). Use the TLS URL in `REDIS_URL`:
  ```
  REDIS_URL=rediss://default:YOUR_PASSWORD@YOUR_ENDPOINT.upstash.io:6379
  ```
- **Redis Cloud** / **AWS ElastiCache** / **Azure Cache**: Use the connection string from your provider.

**2. Self-hosted Redis (Docker)**

If running the backend in Docker alongside Redis:

```bash
# Add Redis to your production docker-compose
services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data
```

Then set `REDIS_URL=redis://redis:6379` (use service name if Redis is in the same Docker network) or `redis://host.docker.internal:6379` if the backend runs on the host.

**3. Development (local Docker)**

```bash
cd docker
docker-compose up -d   # Starts MongoDB, Redis
```

Set `REDIS_URL=redis://localhost:6379` in `.env`.

### Health Check

```bash
curl https://api.billpromax.com/health
```

---

## License

Private - All rights reserved.
