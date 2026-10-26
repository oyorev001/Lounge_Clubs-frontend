# Oyo State Lounge & Clubs Compliance Portal — Frontend

React frontend for the Oyo State lounge, bar and club compliance system.
Owners register establishments and pay the annual levy; officers review,
assign tiers, inspect and enforce; the public verifies certificates via QR.

## Roles & surfaces

- **Public** — landing page, tier table, certificate verification (`/verify/[token]`)
- **BusinessOwner** (`/dashboard`) — establishments + documents, levies, bank-transfer payments, certificate downloads, fines, notifications
- **Officer / Admin / Enforcement / Finance / DG** (`/admin`) — application review & tier assignment, tiers CRUD, levy generation, defaulters, inspections, fines, certificates, audit log, dashboard stats

## Tech stack

- Vite + React 19 + TypeScript
- TanStack Router (file-based) + TanStack Query
- Tailwind CSS v4 + shadcn/ui
- Backend: `LoungeClubsApi` (.NET 10) — set `VITE_API_URL` in `.env` (see `.env.example`)

## Run

```bash
npm install
cp .env.example .env    # VITE_API_URL=http://localhost:5001
npm run dev             # http://localhost:8080
```

Deploy: Netlify-ready — `netlify.toml` builds with `npm run build`, publishes `dist/`, SPA fallback included.
