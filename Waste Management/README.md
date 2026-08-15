# Safaai Sarathi

**AI-powered civic waste management.** Citizen reporting · live vehicle tracking · hotspot prediction · route optimisation.

Built to `safaai-sarathi-implementation-plan.md`. Four fully isolated portals on one backend, no Firebase, no Supabase, no MongoDB.

> **Running and verified end to end.** Build log, verification table and next steps: [PROJECT_STATUS.md](./PROJECT_STATUS.md).
> The previous NIRMAL build is still in `server/` and `ai-service/`; it is unused by this app and can be deleted.

---

## What makes it different

Existing portals (Swachhata-MoHUA and the standard ULB complaint systems) accept a complaint as a form and wait. Safaai Sarathi runs a **triage layer** before anything reaches a human queue:

1. **Classify** — the photo is categorised with a confidence score.
2. **Deduplicate** — a nearby report of the same category within 24h is merged; the citizen is told "5 people also reported this".
3. **Score** — urgency (severity + SLA) and fraud likelihood are computed from real signals.
4. **Route** — dead animal, medical waste, burning waste and sewage overflow **bypass the queue** and page the ward officer with a 30-minute escalation clock.

Confidence below 70% never auto-approves — it is flagged **Review Needed** for a human.

---

## Stack

| Layer | Technology |
| --- | --- |
| Web (all 4 portals) | React + Vite + TypeScript + Tailwind |
| Languages | English / Hindi / Gujarati, dependency-free i18n |
| Backend | Node.js + Express |
| Database | PostgreSQL (Prisma ORM) |
| Realtime | Socket.io (Redis adapter optional) |
| Maps | Leaflet + OpenStreetMap |
| Charts | Recharts |
| 3D intro | react-three-fiber |
| Auth | Custom — Argon2id, JWT + rotating refresh, Google OIDC, TOTP 2FA |
| AI | Self-hosted service: classification, duplicate similarity, hotspot forecast, fraud scoring |
| Routing | Built-in Node solver (OSRM / OR-Tools swappable) |

### PostGIS note

PostGIS is **not installed** on this machine and enabling it needs admin rights. Geometry is stored as
plain `latitude`/`longitude` doubles plus a pre-computed bbox on wards; all distance, nearest-truck
and point-in-ward maths runs in `api/src/lib/geo.js`. The column layout is deliberately
PostGIS-shaped, so switching to `geography(Point,4326)` + GiST indexes later changes the storage
layer only — no query surface changes.

---

## Repository layout

```
api/     Express + Prisma + Socket.io          → port 5100
ai/      Inference service (4 models)          → port 8100
web/     React app, all four portals           → port 5273
server/, ai-service/   ← previous NIRMAL build, unused
```

Ports 5000, 8000 and 5173 are occupied by other apps on this machine, hence 5100 / 8100 / 5273.

---

## Running it

### 1. Configure the database

PostgreSQL 17 is on **5433** (the instance on 5432 uses a different password). Put the password for the `postgres` role into `api/.env`:

```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5433/waste_management?schema=public"
```

### 2. Install, create the schema, seed

```bash
npm run install:all
npm run db:push      # creates the waste_management database and every table
npm run seed         # Gandhinagar, 8 wards, staff, fleet, 45 days of complaints
```

Deterministic — the same city, the same accounts and the same 45-day history on every run.

> **Re-run `npm run seed` on the morning of a demo.** Routes are stored against a calendar date, so
> after midnight the simulator finds none: no moving trucks, no driver route, and an empty tracking
> card on the citizen home screen. Re-seeding takes about a minute.

### 3. Run

```bash
npm run dev          # AI service + API + web together
```

| | URL |
| --- | --- |
| App | http://localhost:5273 |
| API health | http://localhost:5100/api/health |
| AI health | http://localhost:8100/health |

---

## Demo accounts

Password for every seeded account: **`safaai@2026`**

| Portal | Login page | Account |
| --- | --- | --- |
| Citizen | `/login` | `citizen1@safaai.gov.in` |
| Driver | `/driver/login` | `driver1@safaai.gov.in` (or OTP on `9700000001`) |
| Ward Officer | `/officer/login` | `officer1@safaai.gov.in` |
| Super Admin | `/admin/login` | `admin@safaai.gov.in` |

Each login screen lists its own accounts as one-tap buttons. In development, driver OTP codes and
email verification links are printed to the API console rather than sent.

---

## Portal isolation

This is not one app with four menus. Each portal is a separate authentication domain:

- Its **own login route** — no shared screen with a role dropdown.
- Its **own JWT audience**. A citizen token hitting `/api/officer/*` gets **403 PORTAL_MISMATCH**, not a redirect.
- Its **own localStorage key**, so a judge can be signed into all four in one browser without collisions.
- Officer and driver accounts are **provisioned by an admin** — no public signup for staff roles.
- Admins may enter the officer console (city-wide oversight is their job). Nothing else crosses.

---

## Live GPS tracking

```
Driver device  ──driver:location──►  Socket.io  ──►  vehicle_locations (history)
                                          │
                                          ├── vehicles.lastLat/lastLng (denormalised)
                                          │
                                          └──truck:update──►  ward:<id> · city · truck:<id>
                                                                    │
                            Officer dashboard ◄──────────────────────┤
                            Citizen tracking one truck ◄─────────────┘
```

- The citizen joins **only** their own truck's room, so the payload does not grow with the fleet.
- Marker movement is interpolated over ~1.8s with `requestAnimationFrame` and rotated to the reported
  heading, which is what produces the "Google Maps" feel instead of a jumping pin.
- The route polyline colours the traversed portion grey and the remaining portion green, computed by
  snapping the live position onto the line.
- The web driver build queues fixes while offline and replays them via `/driver/location/batch`.

---

## Swapping in the real models

| Stand-in | Replace by |
| --- | --- |
| Waste classifier | `npm i onnxruntime-node sharp`, set `ONNX_MODEL_PATH`, implement `runOnnx()` in `ai/src/models.js` |
| Duplicate similarity | Real CLIP embeddings behind the same `/vision/embed` + `/vision/similarity` contract |
| Route solver | Set `ROUTING_SERVICE_URL` to an OSRM + OR-Tools service |
| Socket scaling | Set `REDIS_URL` — the Redis adapter attaches automatically |
| Rate limiting | Same `REDIS_URL` switches the store from memory to Redis |
| File storage | `STORAGE_DRIVER=minio` / `cloudinary` — only `persist()` changes |
| Notifications | Expo Push / Web Push at `dispatchExternal()` in `notification.service.js` |

---

## Honest note on the AI

There are **no trained weights in this repository**.

- **Classification** and **duplicate similarity** are documented deterministic stand-ins. Scene
  composition comes from the image digest — but capture quality (resolution from JPEG/PNG headers,
  EXIF presence, Shannon entropy, detail density) is genuinely measured from the uploaded bytes and
  does drive the confidence value, so a blurry photo really does score below the auto-approve gate.
- **Hotspot forecasting** and **fraud scoring** are real computations over real features, not
  stand-ins. The forecast is a seasonal-naive baseline with recency weighting — a legitimate
  baseline that LightGBM would have to beat, and it is labelled as a baseline in the API response.

Every response carries an `engine` field (`stub` vs `onnxruntime`), and the Super Admin's **AI Model
Health** page shows it. Don't claim a trained YOLOv8 in the pitch until one is actually loaded.

---

## Languages

**English · हिन्दी · ગુજરાતી**

A globe switcher sits in the top bar of every screen — the landing page, all four login screens,
register, and inside all four portals. Someone who cannot read English needs to be able to change the
language *before* signing in, not after, so it is never hidden behind auth.

- Options are listed in their own script, so they are recognisable without reading English.
- The choice persists locally, is detected from the browser on a first visit, and is adopted from the
  account on sign-in.
- Changing it in the citizen Profile also writes it to the server, so notifications and the IVR line
  use the same language.
- Missing translations fall back to English **per key**, never to a raw key, and are logged once in
  development so the gaps are findable.

No i18n dependency — `lib/i18n.tsx` is about 100 lines, because a municipality should not be paying
for a bundle to show its own language.

**Currently English only:** the officer and admin analytics tables, audit log and compliance export.
That is deliberate — the data in them (ward codes, model versions, action names) is English anyway, so
a half-translated table reads worse than a consistent one. The keys exist in `locales/en.ts`.

---

## Responsive design

Every screen is built mobile-first and verified at 360 / 768 / 1024 / 1440 px.

- **Citizen and driver** get a mobile-native shell: bottom tab bar, 44px minimum touch targets,
  bottom-sheet modals, safe-area insets.
- **Officer and admin** get a desktop console: sidebar, multi-column layouts, dense tables — which
  collapse into a drawer plus stacked cards below `md`, so a table never forces the page sideways.
- Fluid type via `clamp()`, `dvh` not `vh`, `prefers-reduced-motion` honoured on every animation,
  and light / true-AMOLED-dark themes sharing one token layer.
