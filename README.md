<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Inter&weight=800&size=48&pause=1000&color=16A34A&center=true&vCenter=true&width=800&height=100&lines=Safaai+Sarathi+2.0;Autonomous+Waste+Logistics;AI-Driven+Urban+Cleanliness" alt="Typing SVG" />

**An Autonomous, AI-Driven Ecosystem for Next-Gen Municipal Waste Management & Civic Grievance Triage**

[![React](https://img.shields.io/badge/Frontend-React%2018%20%7C%20Vite%20%7C%20TypeScript-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![NodeJS](https://img.shields.io/badge/Backend-Node.js%20%7C%20Express-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20%7C%20Prisma%20ORM-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![ThreeJS](https://img.shields.io/badge/3D%20Graphics-Three.js%20%7C%20R3F-black?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![AI-Powered](https://img.shields.io/badge/AI%20Engine-Computer%20Vision%20%7C%20LightGBM-FF6F00?style=for-the-badge&logo=scikitlearn&logoColor=white)](https://github.com/)
[![License](https://img.shields.io/badge/Govt.%20Of%20India-Civic%20Tech-orange?style=for-the-badge)](https://swachhbharat.mygov.in/)

<br/>

> *"Transforming Municipal Waste Management from Passive Grievance Redressal into Proactive, Real-time AI Triage & Dynamic Fleet Logistics."*

[🌐 Live Deployment (Vercel)](https://safaai-sarathi2-0.vercel.app) &nbsp;•&nbsp; [⚙️ API Backend (Render)](https://safaaisarathi2-0.onrender.com) &nbsp;•&nbsp; [📑 System Architecture](#-end-to-end-system-architecture)

</div>

---

<br/>

## 🌟 The Problem We Are Solving

Traditional municipal portals are essentially simple form dropboxes: citizens upload a complaint, it sits in an unread, unstructured database, and takes weeks to be manually sorted and attended to. **Safaai Sarathi 2.0** completely re-engineers civic operations with a proactive, **Intelligent Autonomous Triage Layer**.

### 🏆 Hackathon Winning Features
- **🤖 Zero Fake Complaints (AI Fraud Shield):** Analyzes EXIF metadata, camera lens characteristics, Shannon entropy, and location authenticity to prevent duplicate or downloaded spam images.
- **⚡ Instant Emergency Escalation:** Medical waste, dead animals, and chemical hazards bypass human delay with an automated **30-minute SLA countdown timer**.
- **🔗 Smart Duplicate Merging:** When 10 citizens photograph the same overflowing bin, it merges them into a single high-priority ticket using ResNet visual embeddings and spatial radii.
- **📸 Mandatory Photo-Proof Resolution:** A driver cannot close a ticket by simply clicking a checkbox. The API mathematically blocks resolution unless an authentic post-cleanup photo is provided.
- **📍 Rotated & Interpolated Live GPS Tracking:** Google Maps-style 60 FPS smooth truck movement on custom Leaflet vector maps.

<br/>

## 🎬 Real Application Previews & Showcase

<div align="center">

### 1️⃣ Full-Width 3D Drive-by Intro & Official Civic Landing Page
| 🚛 Full-Screen 3D Heavy Municipal Truck Intro | 🏛️ Official Landing Page (Glassmorphism & Live Database Stats) |
| :---: | :---: |
| <img src="./docs/assets/01_splash_intro.png" width="490" alt="3D Intro Screen" /> | <img src="./docs/assets/landing_hero_live.png" width="490" alt="Landing Page" /> |
| *Real-time Three.js 6x4 heavy municipal EV truck with active beacon, road lighting & dynamic drive-by motion* | *Live Gandhinagar database stats, Government of India tricolor strip, and glassmorphic quick-report hero* |

<br/>

### 2️⃣ Citizen Super-App: Live Vehicle Tracking & Gamified Green Credits
| 📍 Real-Time Interpolated Truck Tracking & ETA | 🏆 Gamified Green Credits & Reward Claiming |
| :---: | :---: |
| <img src="./docs/assets/citizen_live_tracking.png" width="490" alt="Citizen Live Tracking" /> | <img src="./docs/assets/citizen_green_credits.png" width="490" alt="Citizen Green Credits" /> |
| *Live WebSocket heading-rotated GPS truck position, distance in metres & accurate 1-minute arrival ETA* | *Gamified civic reward system: +5 report, +15 verified. Seamless voucher clipboard claiming.* |

<br/>

### 3️⃣ Driver Navigator & Officer Inspection Console
| 🚛 Driver Turn-by-Turn Route & SOS Triage | 🛡️ Ward Officer Live Queue & Photo Proof Validation |
| :---: | :---: |
| <img src="./docs/assets/05_driver_dashboard.png" width="490" alt="Driver Dashboard" /> | <img src="./docs/assets/06_officer_dashboard.png" width="490" alt="Officer Console" /> |
| *Optimized pickup stops with VRP Or-Opt solver, battery/capacity telemetry, and instant 1-tap SOS triage* | *Point-in-polygon ward triage, 30-min SLA countdown timer, and mathematically enforced photo-proof resolution* |

</div>

<br/>

---

## 🛠️ Tech Stack & Powered By

We built this platform using an industry-standard, fully typed ecosystem:

<div align="center">
  <img src="https://skillicons.dev/icons?i=react,typescript,vite,tailwind,threejs,nodejs,express,postgres,prisma,docker,github,vercel&perline=12" alt="Tech Stack Icons" />
</div>

<br/>

| Domain | Technology / Library | Role & Justification |
| :--- | :--- | :--- |
| **Frontend Framework** | `React 18`, `TypeScript`, `Vite` | Ultra-fast client-side SPA with high type safety and sub-second builds. |
| **Styling & UI** | `Tailwind CSS`, `Framer Motion` | True light/dark theme variables, pure `#000` AMOLED mode & animated micro-interactions. |
| **3D Graphics** | `Three.js`, `@react-three/fiber` | Full-screen 3D dynamic driving truck intro with physics. |
| **Mapping & Spatial** | `Leaflet`, `React-Leaflet` | Real-time interpolated GPS markers, ward boundary polygons & pathing. |
| **Backend API** | `Node.js`, `Express.js` | High-concurrency event-driven architecture. |
| **Database & ORM** | `Prisma ORM`, `PostgreSQL 17` | Relational integrity with 17 schema models & strict audit logging. |

<br/>

---

## 🧠 AI Agents, Machine Learning Models & Algorithms

Safaai Sarathi operates a dedicated micro-service hosting specialized AI models:

```mermaid
graph TD
    A[📸 Citizen Captures Waste Photo] --> B[🧠 AI Vision Classifier: Category & Confidence]
    B --> C{Spatial & Temporal Deduplication}
    C -->|Duplicate Found within 24h & 50m| D[🔗 Merges into Existing Ticket + Notifies Citizens]
    C -->|Unique Issue| E[🚨 AI Urgency & Fraud Scoring]
    E -->|Hazard / Bio / Emergency| F[⚡ Bypass Queue: 30-min Auto Escalation to Ward Officer]
    E -->|Confidence > 70%| G[🤖 Auto-Verified & Added to Optimized Driver Route]
    E -->|Confidence < 70%| H[🛡️ Human-in-the-Loop Review Queue]
```

### Specialized Models
- **👁️ Vision Waste Classifier (PyTorch/CNN):** 9-Class Waste Classification (Piles, Overflowing Bins, Medical, Bio-Waste).
- **🧬 Duplicate Similarity Embedder:** Cosine similarity on 512-dim visual feature vectors using a ResNet Backbone + Haversine spatial radius.
- **🔮 Hotspot Predictor:** LightGBM Gradient Boosted Decision Trees trained on 45-day temporal civic data.
- **🗺️ Fleet Routing Solver:** TSP & VRP Solver with Nearest-Neighbor, 2-Opt edge swaps & Emergency locking.

<br/>

---

## 🏗️ End-to-End System Architecture

```mermaid
flowchart TB
    subgraph Client Layer [Frontend Client Layer - React 18 + Vite + TypeScript]
        CP[Citizen Web / Mobile PWA]
        DP[Driver Fleet Navigator]
        OP[Officer Inspection Console]
        AP[Super Admin Command Center]
    end

    subgraph Gateway [API Gateway & Auth Domain]
        AUTH[Argon2id + Rotating JWT + Google OIDC]
        ISO[Strict Portal Isolation Middleware]
    end

    subgraph Core [Express.js Core Microservices]
        TRIAGE[AI Complaint Triage Engine]
        ROUTE[VRP Fleet Route Optimizer]
        GPS[Real-time WebSocket Tracking Engine]
        ESCALATE[Autonomous SLA Escalation Sweeper]
    end

    subgraph Data [Data Persistence & Spatial Indexing]
        PG[(PostgreSQL 17 Database via Prisma)]
        GEO[Ray-casting Point-in-Polygon Engine]
    end

    subgraph AIService [AI Inference Microservice - FastAPI]
        CLASS[Vision Classifier]
        SIM[Duplicate Detector]
        PRED[LightGBM Hotspot Engine]
    end

    CP & DP & OP & AP --> Gateway
    Gateway --> ISO --> Core
    Core <--> Data
    Core <--> AIService
```

<br/>

---

## 🔐 Strict 4-Domain Portal Isolation

Safaai Sarathi is **not** a single dashboard with a role dropdown. Each portal is an **independent, isolated security silo**:

| Portal | Role | Access Policy & Isolation Rules |
| :--- | :--- | :--- |
| **Citizen Portal** | `CITIZEN` | Public self-signup, Google OAuth, self-ticket tracking, Green Credits wallet. |
| **Driver Portal** | `DRIVER` | Admin-provisioned, phone OTP login, offline GPS sync, turn-by-turn route. |
| **Ward Officer** | `OFFICER` | Admin-provisioned, TOTP 2FA, scoped exclusively to assigned municipal ward. |
| **Super Admin** | `ADMIN` | City-wide oversight, fleet management, model health monitoring, audit trail. |

> 🔒 *A Citizen JWT token attempting to hit `/api/officer/*` or `/api/admin/*` receives an immediate `403 PORTAL_MISMATCH` rejection.*

<br/>

---

## 🚀 Quickstart & Local Setup

### 1️⃣ Clone & Install Dependencies
```bash
git clone https://github.com/Parthh1002/SafaaiSarathi2.0.git
cd "SafaaiSarathi2.0/Waste Management"
npm run install:all
```

### 2️⃣ Configure Environment Variables
Create `.env` in `backend/api/` and `frontend/`:
```env
# backend/api/.env
PORT=5100
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5433/waste_management?schema=public"
JWT_ACCESS_SECRET="safaai_super_secret_access_key"
```

### 3️⃣ Database Migration & Deterministic Seeding
```bash
npm run db:push     # Creates all 17 tables with relations
npm run seed        # Seeds Gandhinagar city, 8 wards, fleet, 45-day history
```

### 4️⃣ Launch Full Stack Development Servers
```bash
npm run dev         # Concurrently launches Web (5273) + API (5100) + AI (8100)
```

<br/>

---

<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Inter&weight=600&size=20&pause=2000&color=22C55E&center=true&vCenter=true&width=600&height=50&lines=Made+with+❤️+for+Swachh+Bharat+Abhiyan;Empowering+Citizens.+Optimizing+Cities." alt="Typing SVG Footer" />

*Safaai Sarathi 2.0 — Built to empower citizens, drivers, and municipal administrators.* 🇮🇳

</div>
