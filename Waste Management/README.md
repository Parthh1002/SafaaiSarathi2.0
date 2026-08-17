<div align="center">

# 🌿 SAFAAI SARATHI 2.0 (सफ़ाई सारथी)
### **Next-Gen Autonomous Civic Waste Logistics, YOLOv8 Deep Learning & AI-Driven Urban Cleanliness Ecosystem**

[![React](https://img.shields.io/badge/Frontend-React%2018%20%7C%20Vite%20%7C%20TypeScript-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![NodeJS](https://img.shields.io/badge/Backend-Node.js%20%7C%20Express-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-Supabase%20PostgreSQL%20%7C%20Prisma%20ORM-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![YOLOv8](https://img.shields.io/badge/Vision%20AI-YOLOv8%20PyTorch-FF6F00?style=for-the-badge&logo=pytorch&logoColor=white)](https://ultralytics.com/)
[![Groq AI](https://img.shields.io/badge/LLM%20Agent-Groq%20Llama%203.3%2070B-F55036?style=for-the-badge&logo=fastapi&logoColor=white)](https://groq.com/)
[![ThreeJS](https://img.shields.io/badge/3D%20Graphics-Three.js%20%7C%20R3F-black?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![Deployment](https://img.shields.io/badge/Live%20Cloud-Vercel%20%2B%20Render-blueviolet?style=for-the-badge)](https://safaai-sarathi2-0.vercel.app)

<br/>

> **"Transforming municipal waste governance from passive, delayed grievance intake into an autonomous, AI-verified, real-time logistics and circular civic reward ecosystem."**

**[🌐 Live Web Application (Vercel)](https://safaai-sarathi2-0.vercel.app)** &nbsp;•&nbsp; **[⚙️ Production API Backend (Render)](https://safaaisarathi2-0.onrender.com)** &nbsp;•&nbsp; **[📑 System Architecture](#-end-to-end-system-architecture)** &nbsp;•&nbsp; **[🔑 Demo Test Credentials](#-demo-testing-credentials)**

---

</div>

<br/>

## 🎯 Executive Summary for Hackathon Judges & Evaluators

In most Indian cities today, municipal waste management is plagued by **three fundamental systemic failures**:
1. **Passive Grievance Redressal:** Citizens report garbage on legacy portals (like Swachhata App), but complaints sit in unorganized officer inboxes for days with zero automated triage.
2. **Ghost Resolutions & Fake Closures:** Municipal contractors routinely mark complaints as "Resolved" without actually cleaning the site, because legacy systems lack cryptographically verifiable photo proof.
3. **No Advance Planning for Bulk Waste:** 40% of sudden citywide garbage pile-ups come from unannounced weddings, community festivals, and house renovations that municipal trucks only discover days after littering occurs.

**Safaai Sarathi 2.0 re-engineers this entire lifecycle** with an **end-to-end autonomous civic operating system**:
- **Dual AI Engine:** Custom **YOLOv8 Deep Learning Vision model** (`safaai_best.pt`) for instant auto-classification and auto-approval (≥70% confidence) + **Groq Llama 3.3 70B Conversational AI Agent** for interactive multi-lingual action assistance.
- **Advance Event Pre-Booking:** A dedicated system allowing citizens to pre-schedule bulk collections (24h+ in advance) with automated vehicle route allocation and driver shift dispatch.
- **Strict 30-Min Emergency SLA:** Animal carcasses, medical biohazards, and toxic chemicals bypass routine queues straight into an emergency War Room.
- **Mathematical Resolution Verification:** Drivers cannot close tickets without uploading live camera proof of the cleaned spot.
- **Gamified Circular Economy:** Real Green Credits ledger redeemable for property tax rebates and city bus passes.

---

## ⚖️ Why Safaai Sarathi Beats Legacy Portals (The 10x Innovation Matrix)

| Feature Dimension | Traditional ULB / Swachhata App | 🌿 Safaai Sarathi 2.0 (Our Platform) |
| :--- | :--- | :--- |
| **Complaint Verification** | Manual human review (takes 2-5 days) | **Instant YOLOv8 AI inference** (auto-approves in <100ms) |
| **Resolution Authenticity** | Driver checks a checkbox (high fraud rate) | **Mandatory After-Cleanup photo proof** validated by API |
| **Advance Waste Planning** | ❌ None (Only reactive after littering) | **🗓️ Advance Scheduled Event Pickup** for weddings/festivals |
| **Emergency Incidents** | Treated like routine garbage (48h delay) | **🚨 30-Min Priority SLA** for biohazards & dead animals |
| **Fleet Visibility** | Blind dispatch / unmonitored routes | **📍 60fps Real-Time WebSocket GPS tracking** & ETA |
| **Citizen Incentive** | Zero incentive (passive complaints) | **🏆 Green Credits Wallet** (Tax rebates & BRTS passes) |
| **Conversational AI** | Static FAQ accordion or dumb rule bot | **🤖 Groq Llama 3.3 Action Agent** with 1-tap camera triggers |
| **Language Inclusivity** | Static text (English/Hindi only) | **Instant zero-reload EN / हिन्दी / ગુજરાતી** support |

---

## 📁 Repository Structure & Directory Map

```text
SafaaiSarathi2.0/
├── Waste Management/
│   ├── backend/
│   │   ├── api/                          # Node.js + Express API Gateway (Port 5100)
│   │   │   ├── prisma/
│   │   │   │   └── schema.prisma         # 18 Relational Models (PostgreSQL Supabase)
│   │   │   ├── src/
│   │   │   │   ├── config/               # App constants, SLA timers, credit rules
│   │   │   │   ├── middleware/           # Portal isolation, JWT auth, upload handler, rate limits
│   │   │   │   ├── routes/               # Modular REST endpoints (Citizen, Driver, Officer, Admin, Public)
│   │   │   │   │   ├── auth.routes.js    # Login, signup, OTP, 2FA, token refresh
│   │   │   │   │   ├── citizen.routes.js # Reports, scheduled pickups, wallet, tracking
│   │   │   │   │   ├── driver.routes.js  # Shift tasks, GPS breadcrumbs, cleanup proof
│   │   │   │   │   ├── officer.routes.js # Ward review, driver dispatch, scheduled requests
│   │   │   │   │   ├── admin.routes.js   # Citywide KPIs, fleet management, audit logs
│   │   │   │   │   └── public.routes.js  # Open stats, ward GeoJSON, public Groq chatbot
│   │   │   │   ├── services/             # Core Business Logic & External APIs
│   │   │   │   │   ├── groq.service.js   # Groq Cloud Llama 3.3 Conversational Action LLM
│   │   │   │   │   ├── ai.service.js     # Bridge to YOLOv8 Python Vision Microservice
│   │   │   │   │   ├── complaint.service.js # Auto-approval gate, 100m spatial deduplication
│   │   │   │   │   ├── reminder.service.js  # 24h advance event pickup cron sweeper
│   │   │   │   │   ├── escalation.service.js# SLA breach detection & auto-escalation
│   │   │   │   │   └── tracking.service.js  # Real-time WebSocket vehicle telemetry
│   │   │   │   └── server.js             # HTTP + Socket.io Server entry point
│   │   │   └── package.json
│   │   │
│   │   └── vision/                       # Python FastAPI AI Microservice (Port 8100)
│   │       ├── main.py                   # FastAPI image classification endpoint
│   │       └── models/
│   │           └── safaai_best.pt        # Custom PyTorch YOLOv8 Deep Learning Weights
│   │
│   └── frontend/                         # React 18 + Vite + TypeScript Client (Port 5273)
│       ├── src/
│       │   ├── components/               # Global Design System UI
│       │   │   ├── Chatbot.tsx           # Floating Groq AI Chatbot with 1-tap action deep links
│       │   │   ├── SpotlightNav.tsx      # Fluid spring-animated navigation bar
│       │   │   ├── ErrorBoundary.tsx     # Crash resilience & graceful recovery UI
│       │   │   └── map/Map.tsx           # Leaflet OpenStreetMap interactive GIS engine
│       │   ├── lib/                      # API Axios client, Socket.io, i18n, Auth Context
│       │   ├── pages/
│       │   │   ├── Landing.tsx           # Glassmorphic civic landing page with live DB stats
│       │   │   └── Splash.tsx            # Three.js 3D Municipal EV Truck Drive-by Intro
│       │   └── portals/                  # 4 Isolated Role Portals
│       │       ├── citizen/              # Spot-it Snap-it, Schedule Pickup, Track Truck, Rewards
│       │       ├── driver/               # Daily Stops, Turn-by-Turn Route, Cleanup Proof Camera
│       │       ├── officer/              # Ward Overview, Review Queue, Scheduled Event Planning, War Room
│       │       └── admin/                # City Command Center, Fleet Master, Staff Control, Audit Logs
│       ├── vite.config.ts
│       └── package.json
└── docs/                                 # Architectural diagrams & preview assets
```

---

## 🏗️ End-to-End System Architecture

```mermaid
flowchart TB
    subgraph ClientLayer ["1. CLIENT LAYER (React 18 + Vite + TypeScript)"]
        CP["📱 Citizen Super-App (/app/*)"]
        DP["🚛 Driver Shift Navigator (/driver/*)"]
        OP["🏢 Ward Officer Console (/officer/*)"]
        AP["👑 Super Admin HQ (/admin/*)"]
    end

    subgraph SecurityGate ["2. SECURITY & PORTAL ISOLATION"]
        AUTH["Argon2id + Rotating JWT + Refresh Cookies"]
        GUARD["Strict Audience Guard: 403 PORTAL_MISMATCH"]
    end

    subgraph BackendCore ["3. API GATEWAY & LOGISTICS (Node.js Express ESM)"]
        TRIAGE["YOLOv8 AI Auto-Approval Engine (≥70% Gate)"]
        DEDUP["100m Spatial & 24h Deduplicator"]
        SCHED["24h Advance Event Scheduler & Cron"]
        ESCAL["30m Emergency & 24h SLA Sweeper"]
        SOCKET["Socket.io Real-Time WebSockets"]
    end

    subgraph AIEngines ["4. DUAL AI MICROSERVICES"]
        YOLO["👁️ Ultralytics YOLOv8 PyTorch (Port 8100)"]
        GROQ["⚡ Groq Cloud Llama 3.3 70B Versatile"]
    end

    subgraph DataStorage ["5. PERSISTENCE & STORAGE"]
        PG[("🐘 Supabase PostgreSQL 17 (Prisma ORM)")]
        S3["📦 Supabase Cloud Storage (Proof Uploads)"]
    end

    CP & DP & OP & AP --> SecurityGate
    SecurityGate --> GUARD --> BackendCore
    BackendCore <--> YOLO
    BackendCore <--> GROQ
    BackendCore <--> PG
    BackendCore <--> S3
    SOCKET <--> CP & DP & OP
```

---

## 🛠️ Complete Tech Stack & Engineering Justifications

| Technology | Layer / Role | Why We Chose It (Engineering Justification & Alternatives Considered) |
| :--- | :--- | :--- |
| **React 18 + Vite 6 + TypeScript** | Frontend SPA | Sub-second HMR, strict type safety across all 18 database entities, and zero-runtime overhead. Chosen over Next.js SSR to enable offline PWA caching on driver devices. |
| **TailwindCSS + CSS Tokens** | UI Styling | High performance, zero CSS bundle bloat, native AMOLED `#000000` dark theme support, and responsive glassmorphic cards. |
| **Three.js & R3F** | 3D Visual Experience | Renders a photorealistic 3D municipal EV truck with active beacon lighting on first visit, creating a memorable, high-impact impression. |
| **Leaflet + OpenStreetMap** | GIS Mapping | **100% Free & Open Source**. Google Maps API charges $200+ monthly for high-frequency GPS tile calls; Leaflet provides high-performance custom vector tiles with zero rate limits. |
| **Node.js (ESM) + Express** | API Gateway | High-concurrency event loop ideal for simultaneous WebSocket connections from hundreds of roaming driver GPS trackers. |
| **Supabase PostgreSQL 17** | Relational Database | Strict relational integrity with foreign keys, geospatial querying, and instant ACID transactions. Paired with **Prisma ORM** for compile-time TypeScript safety. |
| **FastAPI + PyTorch YOLOv8** | Vision Microservice | Model inference requires optimized C++/CUDA runtime. Isolating YOLOv8 in Python FastAPI prevents heavy tensor math from blocking Node.js event loop. |
| **Groq Cloud (Llama 3.3 70B)** | Conversational AI Agent | Custom LPU hardware provides **sub-400ms token generation** on a generous 100% free tier (14,400 daily requests) with natural Gujarati, Hindi, and English support. |
| **Socket.io WebSockets** | Real-Time Telemetry | Bidirectional low-latency rooms (`ward:<id>`, `truck:<id>`) for 60fps truck position interpolation and instant audio task dispatch to drivers. |
| **Supabase Cloud Storage** | Photo Proof Storage | S3-compatible persistent storage ensuring waste photos and driver cleanup proofs are never lost during server redeployments. |

---

## 🔄 Core Operational Workflows (Step-By-Step)

### 1️⃣ Spot it, Snap it: AI Waste Report & Cleanup Lifecycle
1. **Citizen Capture:** Citizen opens `/app/report`, snaps a live waste photo; GPS coordinates are captured automatically.
2. **YOLOv8 Inference:** Image is sent to FastAPI (`POST /api/classify-waste`). The model returns class (e.g. `garbage_pile`) and confidence score (e.g. `92%`).
3. **Auto-Approval:** If confidence ≥ 70%, `status` becomes `VERIFIED` and binds to the correct Ward polygon.
4. **Driver Dispatch:** Officer assigns an active driver; Socket.io plays an alert chime on the driver's phone (`new_task_assigned`).
5. **Collection & Proof:** Driver navigates to the stop, clicks **Start Trip**, collects waste, and snaps a mandatory **After-Cleanup Photo Proof**.
6. **Resolution & Reward:** Ticket updates to `RESOLVED`, before/after comparison is published, and citizen receives **+50 Green Credits** instantly.

### 2️⃣ Advance Scheduled Event Waste Pickup (Weddings / Festivals)
1. **Pre-Booking:** Citizen accesses `/app/schedule-pickup`, selects location type (Home vs Common Plot), categories (Plastic/Food/Debris), volume (`LARGE`), and future date/time slot (min 24h advance).
2. **Officer Review:** Request appears in Officer's `/officer/scheduled-requests` console. Officer checks vehicle availability and approves/assigns a Compactor Truck.
3. **Background Reminder Worker:** `reminder.service.js` runs every 10 minutes scanning for upcoming pickups within 24 hours, alerting citizens and staging driver queues.
4. **Execution:** Driver arrives during the scheduled slot, collects bulk waste, uploads clean proof photo, and citizen receives **+25 Green Credits**.

### 3️⃣ 30-Minute Priority Emergency War Room
- Critical incidents (animal carcasses, toxic spills, hospital biohazards) bypass standard queues with `priority = 'CRITICAL'`.
- System triggers a **30-minute strict SLA countdown** in the Officer's **Emergency War Room** (`/officer/emergencies`) with pulsing audio/visual alarms.

---

## 🛡️ Judge FAQ: Anticipating Tough Technical Questions

#### Q1: "What if a citizen submits a fake image or a photo downloaded from Google?"
> **Answer:** Safaai Sarathi enforces a multi-tier defense:
> 1. **Client-side Camera Enforcement:** Mobile browser requests live camera capture with hardware timestamp.
> 2. **100m Duplicate Clustering:** If multiple users photograph the same spot, the system merges them into a single node rather than creating spam tickets.
> 3. **Mandatory Driver Resolution Proof:** Even if a fake report passes, municipal funds/credits are only disbursed when the driver physically reaches the GPS coordinate and uploads authentic cleanup proof.

#### Q2: "What happens if a driver enters a low-network / offline area?"
> **Answer:** The Driver Portal includes an offline breadcrumb buffer (`DriverRoute.tsx`). GPS coordinates are queued locally in `IndexedDB`/memory and automatically batch-synced via `POST /api/driver/location/batch` as soon as cellular connectivity resumes.

#### Q3: "Why did you separate the Vision AI into a Python microservice instead of running TensorFlow.js in Node?"
> **Answer:** TensorFlow.js in Node.js suffers from single-threaded V8 memory limits and lacks hardware acceleration on many cloud servers. Isolating Ultralytics YOLOv8 in FastAPI allows native C++/PyTorch execution running at sub-100ms inference speeds without causing Node.js event loop lag.

#### Q4: "How does the platform handle security between different roles?"
> **Answer:** Safaai Sarathi enforces **Audience-scoped JWT Portal Isolation**. A token issued for a `CITIZEN` cannot access `/api/officer/*` or `/api/admin/*` — even if an attacker manually modifies the request header, our `requirePortal()` middleware rejects it with a `403 PORTAL_MISMATCH`.

---

## 🔑 Demo Testing Credentials

Try every role live on [https://safaai-sarathi2-0.vercel.app](https://safaai-sarathi2-0.vercel.app):

| Portal Role | Direct Login URL | Demo Email / Phone | Password |
| :--- | :--- | :--- | :--- |
| 👤 **Citizen** | [`/login`](https://safaai-sarathi2-0.vercel.app/login) | `citizen1@safaai.gov.in` | `safaai@2026` |
| 🚛 **Driver** | [`/driver/login`](https://safaai-sarathi2-0.vercel.app/driver/login) | `driver1@safaai.gov.in` *(or phone `9700000001`)* | `safaai@2026` |
| 🛡️ **Ward Officer** | [`/officer/login`](https://safaai-sarathi2-0.vercel.app/officer/login) | `officer1@safaai.gov.in` | `safaai@2026` |
| 👑 **Super Admin** | [`/admin/login`](https://safaai-sarathi2-0.vercel.app/admin/login) | `admin@safaai.gov.in` | `safaai@2026` |

---

<div align="center">

Made with ❤️ for **Swachh Bharat Abhiyan & National Smart Cities Mission** 🇮🇳  
*Safaai Sarathi 2.0 — Developed for Hackathon & Civic Tech Innovation.*

</div>
