# Safaai Sarathi — Build Status

> Read this first in a new session.

- **Plan:** `C:\Users\hayan\Downloads\safaai-sarathi-implementation-plan.md`
- **Root:** `D:\Cllg\Projects\Waste Management`
- **Last updated:** 2026-08-14 — running and verified end to end

---

## 1. Running

**Database: PostgreSQL 17 on port 5433** (not 5432 — that instance has a different password).
`api/.env` is already configured.

```bash
npm run install:all   # once
npm run db:push       # once — creates waste_management + all 17 tables
npm run seed          # Gandhinagar demo data (safe to re-run)
npm run dev           # AI + API + web
```

---

## 2. Verified end to end

| Check | Result |
| --- | --- |
| DB connect | ✅ postgres 17.5, database `waste_management` |
| `db push` | ✅ 17 tables created |
| Seed | ✅ 8 Gandhinagar wards · 4 officers · 8 drivers+vehicles · 24 citizens · 1420 complaints over 45 days · 7 routes |
| API health | ✅ argon2id · AI reachable · escalation running · simulator driving 7 trucks |
| 4 separate logins | ✅ citizen / driver / officer / admin all 200 |
| **Portal isolation** | ✅ citizen token → `/officer/*` = **403 PORTAL_MISMATCH**; officer → `/admin/*` = 403; admin → `/officer/*` = 200 (by design) |
| Citizen home | ✅ 3 active, live truck card "GJ 05 AD 1000 ETA 5min" |
| AI classify | ✅ real JPEG parsing, confidence 0.507 → correctly **not** auto-approved |
| Complaint submit | ✅ ward attributed by point-in-polygon, photo stored, credits awarded |
| **Duplicate merge** | ✅ second report 15 m away merged at 0.835 similarity |
| Officer verify → assign | ✅ status transitions + audit entries written |
| Citizen live track | ✅ scoped to one truck room, ETA 3 min |
| **Photo proof enforced** | ✅ resolve without a photo = **400 rejected** |
| Resolve with photo | ✅ RESOLVED, timeline `PENDING>VERIFIED>ASSIGNED>RESOLVED`, proof visible to citizen |
| Live GPS | ✅ driver position changed between two reads |
| Auto-escalation | ✅ fired unprompted — SS-SOS1 → L1 officer, overdue → L2 admin |
| Audit log | ✅ `complaint_assign`, `complaint_verify` recorded |
| Hotspot forecast | ✅ served by the AI service (`lightgbm-hotspot-v1`) |
| Model health | ✅ 433 samples, 0.866 human agreement, engine reported as `stub` |
| Compliance export | ✅ 8 ward rows + CSV |
| Web typecheck / build | ✅ zero errors; code-split per portal |
| Server logs | ✅ no 500s, no unhandled errors |
| Languages | ✅ English / हिन्दी / ગુજરાતી — 558 keys, 439 translated per language |

**Not verified:** the visual/responsive pass — the Chrome extension was not connected, so no
screenshots were taken. Layouts are built mobile-first and the build is clean, but check them by eye
at 360 / 768 / 1024 / 1440 px.

---

## 3. Environment facts for this machine

1. **Ports 5000, 8000, 5173 are taken** by other apps. This project uses **API 5100, AI 8100, web 5273**.
2. **Use PostgreSQL on port 5433** (17.5) — that is the instance whose `postgres` password we have. The 5432 instance rejects it.
3. **PostGIS is not installed** and installing needs admin rights → geometry is lat/lng doubles + bbox, maths in `api/src/lib/geo.js`.
4. **No Docker, no Python, no Redis.** Everything runs on Node; Redis paths degrade to in-process automatically.
5. **No admin rights** — `net start MongoDB` failed with *System error 5* earlier, same constraint applies to installing PostGIS.
6. Background services started with `(cmd &)` do survive the bash call; `run_in_background` is cleaner. An AI service instance may still be listening on 8100 from this session.

---

## 4. What was built

### `api/` — Express + Prisma + Socket.io
```
prisma/schema.prisma      17 models, 9 enums (plan §8 plus what the page map implies)
src/config/               env.js, constants.js (categories, portals, credit rules)
src/lib/                  prisma.js, geo.js (PostGIS replacement), password.js (Argon2id),
                          tokens.js (JWT + rotating refresh), google.js (raw OIDC)
src/middleware/           auth.js (portal isolation), error.js, rateLimit.js, upload.js, audit.js
src/services/             auth, complaint (the Triage AI Agent), ai (model client),
                          tracking (GPS ingest), routing (2-opt + Or-opt solver),
                          escalation (SLA watcher), analytics, notification, simulator
src/routes/               auth (4 login domains), citizen, driver, officer, admin, public
src/seed/                 city.js (Gandhinagar ward geometry), seed.js
```

### `ai/` — inference service
```
src/models.js         classify · embed/similarity · forecast · fraudScore
src/imageFeatures.js  JPEG/PNG/WebP dimensions, EXIF parser, Shannon entropy, detail density
src/index.js          /health /vision/classify /vision/embed /vision/similarity
                      /vision/features /fraud/score /hotspot/predict
```

### `web/` — React, four portals
```
src/lib/          api.ts (per-portal axios + refresh), auth.tsx (RequireRole), socket.ts,
                  format.ts, i18n.tsx (locale provider + useT)
src/locales/      en.ts · hi.ts · gu.ts
src/components/   ui.tsx (design system + LanguageSwitcher), shells.tsx (MobileShell +
                  ConsoleShell), map/Map.tsx
src/pages/        Splash (3D intro), Landing, Login (parameterised per portal), Register
src/portals/citizen/   Home, NewReport, EmergencyReport, MyComplaints, ComplaintDetail,
                       TrackTruck, Rewards, Directory, Profile
src/portals/driver/    DriverPortal (background GPS), DriverRoute, DriverStops, DriverSummary, DriverSos
src/portals/officer/   Dashboard, ComplaintQueue, Emergencies, Hotspots, Fleet, Escalations, Analytics
src/portals/admin/     Dashboard, MasterFleet, UserManagement, CityAnalytics,
                       ComplianceExport, AuditLog, ModelHealth, WardSettings
```

Every page from the plan's §2 role map exists.

---

## 5. Plan coverage

| Plan section | Status |
| --- | --- |
| §2.1 Citizen portal (12 pages) | ✅ all built |
| §2.2 Driver portal (8 pages) | ✅ all built |
| §2.3 Ward Officer portal (9 pages) | ✅ all built |
| §2.4 Super Admin portal (9 pages) | ✅ all built |
| §3 Portal isolation | ✅ separate logins, JWT audience check, per-portal storage, admin-only provisioning |
| §4 Live GPS | ✅ socket rooms, interpolated rotated marker, traversed/remaining polyline, offline queue |
| §5 Tech stack | ✅ as specified, except React Native (see §6 below) |
| §6 Custom auth | ✅ Argon2id, rotating refresh w/ reuse detection, Google OIDC, TOTP 2FA, rate limits, zod, audit log |
| §7 AI models | ⚠️ hotspot + fraud are real; classifier + duplicate are documented stand-ins |
| §8 Database schema | ✅ every table, PostGIS-shaped without PostGIS |
| §9 UI/UX | ✅ 3D intro, light + AMOLED dark, mobile-native vs desktop console |
| §10 Build priority | ✅ items 1-6 built; item 7 (voice/IVR) is explainer-only, as the plan suggests |
| Multilingual (§2.1 profile language, §7 IVR languages) | ✅ English / Hindi / Gujarati switcher on every screen; officer & admin analytics tables still English |

---

## 6. Deliberate deviations (decided with you)

1. **Responsive web for all four portals instead of React Native apps.** You chose this; the plan's
   Expo apps are not built. The citizen/driver web builds are installable PWAs with a service worker,
   and the driver build queues GPS offline — but browser background GPS is genuinely weaker than
   `expo-location`'s background task, and that limitation is real, not papered over.
2. **Plain Postgres instead of PostGIS**, for the admin-rights reason above.
3. **NIRMAL was not deleted.** You declined the archive command, so `server/` and `ai-service/` are
   untouched and unused. Delete them whenever you like; nothing in the new app references them.

---

## 7. Build log — what was done

### Session 1 (NIRMAL, superseded)
Built a MongoDB/Express/Socket.IO backend and AI service for a different product (NIRMAL, Indore,
SIH). Seeded and working, then superseded when the plan changed. Its code is still in `server/` and
`ai-service/`, unused.

### Session 2 (Safaai Sarathi — this build)

**Pivot decisions taken with you:** replace NIRMAL entirely · responsive web for all four portals
instead of React Native · plain Postgres + app-side geo instead of PostGIS.

1. **Scaffolded** `api/`, `ai/`, `web/` alongside the untouched NIRMAL folders; rewrote the root
   `package.json` (old NIRMAL scripts kept under `nirmal:*`).
2. **Database** — wrote `prisma/schema.prisma`: 17 models, 9 enums, covering every table in plan §8
   plus what the page map implies (complaint events, ward officers, OTP codes, SOS alerts, hotspot
   predictions, emergency contacts, model-health samples).
3. **Geo without PostGIS** — `api/src/lib/geo.js` replaces `ST_DWithin`, `ST_Contains` and the `<->`
   KNN operator. Ward lookup is a bbox pre-filter in SQL followed by an exact ray-cast, which is the
   same two-phase strategy a GiST index uses internally.
4. **Auth (plan §6)** — Argon2id via `@node-rs/argon2` with a scrypt fallback; 15-minute access
   tokens carrying a portal `aud` claim; refresh tokens stored hashed, rotated on every use, with
   token-reuse detection that revokes the whole family; raw Google OIDC (no Firebase); TOTP 2FA;
   Redis-optional rate limiting; zod validation; audit-log middleware.
5. **Portal isolation (plan §3)** — four separate login endpoints, `requirePortal()` middleware
   checking the token audience against the API namespace, per-portal localStorage keys on the client,
   and `RequireRole` route guards mirroring the server.
6. **Triage AI Agent (plan §1)** — `complaint.service.js` runs classify → deduplicate → score →
   route on intake. Emergencies bypass the queue and page the ward officer; anything under 70%
   confidence is flagged for human review instead of auto-approving.
7. **Live GPS (plan §4)** — one ingest path shared by the socket channel and REST; history written to
   `vehicle_locations`; `truck:update` broadcast to ward / city / truck rooms; route progress computed
   by snapping the live position onto the polyline.
8. **Escalation engine** — a 60-second sweep rather than per-complaint timers, so a restart cannot
   silently drop a pending escalation. L1 → ward officer, L2 → super admin.
9. **Routing** — nearest-neighbour → 2-opt → Or-opt, with emergencies locked to the front of the
   tour. OSRM/OR-Tools swap in behind the same contract.
10. **AI service** — four models behind one HTTP boundary, plus a pure-JS image feature extractor
    (JPEG/PNG/WebP dimensions, EXIF parser, Shannon entropy, detail density).
11. **Web** — design tokens for light + true-AMOLED dark, `MobileShell` (bottom tabs, sheets) for
    citizen/driver and `ConsoleShell` (sidebar, dense tables) for officer/admin, a react-three-fiber
    3D intro, a Leaflet layer with an interpolated heading-rotated truck marker, and all 38 pages
    from the plan's §2 role map.
12. **Ran it** — created the database, seeded, booted all three services, and walked the full
    lifecycle (see §2). Fixed one real defect found in testing: the seed resolved 98% of complaints,
    leaving the officer queue nearly empty, two drivers without routes and the citizen truck-tracker
    card blank. Reworked it to keep a realistic open backlog, guarantee a route per non-maintenance
    truck, give each demo citizen a trackable assigned complaint, seed two live emergencies, and vary
    AI-vs-officer category agreement so Model Health isn't a flat 100%.

**Defects found and fixed during the build:** an unquoted `pulse-ring` key that broke the Tailwind
config parse; missing `vite/client` and `node` type references; a dynamic Tailwind class
(`bg-${accent}`) that JIT cannot see; `h-4.5`/`w-4.5` utilities that are not in Tailwind's default
scale and were silently doing nothing; and the seed backlog problem above.

### Session 3 — city change, auth redesign, languages

1. **Surat → Gandhinagar** everywhere: eight real ward areas (Sector 1–7 / 8–13 / 16–21 / 22–30,
   Sargasan, Kudasan, Vavol, Pethapur) at Gandhinagar's population scale, the lettered Ch/Gh/K roads,
   plates moved from GJ 05 to **GJ 18**, helplines to the **079** STD code, SMC → GMC. All six map
   instances re-centred on **23.2156, 72.6369**, and ward polygons regenerated at a ~2 km cell size
   so the city fits instead of sprawling like a metro.
2. **Login pages redesigned.** Full-bleed photo background (converted 2.5 MB PNG → 331 KB JPEG),
   sharp copy anchored hard left and dissolved into a blurred copy of itself with a five-stop mask so
   there is no visible seam. Brand copy moved onto the photo with no card, which is what lets it align
   on the same left edge as the logo. Form card made translucent with a heavy backdrop blur.
   Page locked to exactly one viewport — the form was compacted (inline icon+title, chip-style demo
   accounts, tighter spacing) so nothing scrolls at normal screen heights.
3. **Copy rewritten per portal** — the login panels talked about software architecture ("Four
   portals. One backend. Zero cross-access."); they now speak to what each role actually does.
4. **Landing footer** — removed the AI-billing line, made it deep green, everything left-aligned,
   and cut its height by about a third.
5. **Languages (English / हिन्दी / ગુજરાતી).** Dependency-free i18n: `lib/i18n.tsx` provides the
   locale context and `useT()`; `locales/{en,hi,gu}.ts` hold 558 keys with per-key fallback to
   English. A globe switcher sits in every shell and on every auth screen — a resident who cannot read
   English has to be able to change it *before* signing in. Locale persists, is detected from the
   browser on a first visit, is adopted from the account on sign-in, and writing it in Profile updates
   the server record so notifications and the IVR line agree.

---

## 8. Next steps

1. **Visual/responsive pass** — the only thing not verified. Check all four portals at
   360 / 768 / 1024 / 1440 px.
2. Rehearse the demo path in the UI (it is proven at the API layer, see §2).
3. Optional depth, in the plan's own priority order: WhatsApp bot (Groq), real YOLOv8 weights,
   voice/IVR, Expo native apps.

---

## 9. Known loose ends

- [ ] Visual/responsive QA not done — Chrome extension was not connected, no screenshots taken.
- [ ] **Officer and admin analytics screens are still English** — chart axes, table headers, audit
      log, compliance export (~119 of 558 keys). Deliberate: the underlying data there (ward codes,
      model versions, action names like `complaint_assign`) is English anyway, so a half-translated
      table reads worse than a consistent one. The keys exist in `en.ts` if you want them filled.
- [ ] **Re-run `npm run seed` on the morning of a demo.** Routes are stored against a calendar date,
      so after midnight the simulator finds none — no moving trucks, no driver route, empty tracking
      card. Re-seeding takes about a minute and rebuilds the same city deterministically.
- [ ] Classifier and duplicate-similarity models are documented stand-ins; hotspot and fraud are real.
- [ ] Municipal phone numbers in the seed are demo placeholders on the correct 079 STD code; the
      national 100 / 101 / 108 numbers are genuine. Swap the GMC ones before any real deployment.
- [ ] Google sign-in is wired but disabled until `GOOGLE_CLIENT_ID` / `SECRET` are set.
- [ ] Email (verification, reset) and driver OTP codes log to the API console instead of sending —
      no SMTP or SMS gateway configured.
- [ ] WhatsApp bot and voice/IVR are presented in the UI as roadmap, not implemented.
- [ ] No `docker-compose.yml` (no Docker on this machine); no ESLint config (TS strict is on and passing).
- [ ] Not a git repository — run `git init` when ready.
- [ ] `server/` and `ai-service/` (NIRMAL) can be deleted; nothing references them.
- [ ] `web/dist/` from the test build can be deleted or ignored.
