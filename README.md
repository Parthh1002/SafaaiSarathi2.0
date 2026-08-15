<div align="center">

# 🌿 Safaai Sarathi 2.0 (सफ़ाई सारथी)
### **Next-Gen Autonomous Civic Waste Logistics & AI-Driven Urban Cleanliness Ecosystem**

[![React](https://img.shields.io/badge/Frontend-React%2018%20%7C%20Vite%20%7C%20TypeScript-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![NodeJS](https://img.shields.io/badge/Backend-Node.js%20%7C%20Express-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20%7C%20Prisma%20ORM-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![ThreeJS](https://img.shields.io/badge/3D%20Graphics-Three.js%20%7C%20R3F-black?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![AI-Powered](https://img.shields.io/badge/AI%20Engine-Computer%20Vision%20%7C%20LightGBM-FF6F00?style=for-the-badge&logo=scikitlearn&logoColor=white)](https://github.com/)
[![License](https://img.shields.io/badge/Govt.%20Of%20India-Civic%20Tech-orange?style=for-the-badge)](https://swachhbharat.mygov.in/)

<br/>

> **"Transforming Municipal Waste Management from Passive Grievance Redressal into Proactive, Real-time AI Triage & Dynamic Fleet Logistics."**

[🌐 Live Deployment (Vercel)](https://safaai-sarathi2-0.vercel.app) &nbsp;•&nbsp; [⚙️ API Backend (Render)](https://safaaisarathi2-0.onrender.com) &nbsp;•&nbsp; [📑 System Architecture](#-end-to-end-system-architecture)

---

</div>

<br/>

## 🎬 Visual Showcase & Real Dashboard Previews

<div align="center">

### 1️⃣ Cinematic 3D Intro & Interactive Landing Experience
| 🚛 High-Impact 3D Driving Truck Intro (4s) | 🏛️ Official Landing Page (Glassmorphism & Live Stats) |
| :---: | :---: |
| <img src="./docs/assets/01_splash_intro.png" width="480" alt="3D Intro Screen" /> | <img src="./docs/assets/02_landing_page.png" width="480" alt="Landing Page" /> |
| *Real-time Three.js 6-wheel municipal truck with active strobe & headlights* | *Live city impact metrics, tricolor civic branding & instant portal access* |

<br/>

### 2️⃣ Four Dedicated & Isolated Role Portals
| 📱 Citizen Super-App (Instant AI Report & Live Track) | 🚛 Driver Navigator (Turn-by-turn Route & SOS) |
| :---: | :---: |
| <img src="./docs/assets/04_citizen_dashboard.png" width="480" alt="Citizen Dashboard" /> | <img src="./docs/assets/05_driver_dashboard.png" width="480" alt="Driver Dashboard" /> |
| *Point-in-polygon ward detection, duplicate similarity & Green Credits* | *Optimized pickup stops, battery/capacity tracker & 1-tap SOS triage* |

<br/>

| 🛡️ Ward Officer Console (Live Queue & AI Escalations) | 👑 Super Admin Command Center (City-wide Analytics) |
| :---: | :---: |
| <img src="./docs/assets/06_officer_dashboard.png" width="480" alt="Officer Console" /> | <img src="./docs/assets/07_admin_dashboard.png" width="480" alt="Admin Command Center" /> |
| *Triage approval, photo proof enforcement, hotspot maps & SLA countdown* | *Master fleet control, model health metrics, compliance CSV & audit trail* |

</div>

---

## ⚡ Why Safaai Sarathi Beats Legacy Portals (Swachhata / Traditional ULB)

Traditional municipal portals are simple form dropboxes: you upload a complaint, it sits in an unread database, and takes weeks to get attended. **Safaai Sarathi 2.0** completely re-engineers civic operations with an **Intelligent Autonomous Triage Layer**:

```mermaid
graph TD
    A[📸 Citizen Captures Waste Photo] --> B[🧠 AI Vision Classifier: Category & Confidence]
    B --> C{Spatial & Temporal Deduplication}
    C -->|Duplicate Found within 24h & 50m| D[🔗 Merges into Existing Ticket + Notifies Citizens]
    C -->|Unique Issue| E[🚨 AI Urgency & Fraud Scoring]
    E -->|Hazard / Bio / Emergency| F[⚡ Bypass Queue: 30-min Auto Escalation to Ward Officer]
    E -->|Confidence > 70%| G[🤖 Auto-Verified & Added to Optimized Driver Route]
    E -->|Confidence < 70%| H[🛡️ Human-in-the-Loop Review Queue]
    G --> I[🚛 Live Driver Route Optimizer - 2-Opt & Or-Opt Solver]
    I --> J[✅ Driver Resolves with Mandatory Photo Proof]
    J --> K[🎉 Citizen Rewarded with Green Credits + Before/After Timeline]
```

### 🏆 Key Differentiators:
1. **Zero Fake Complaints (AI Fraud Shield):** Analyzes EXIF metadata, camera lens characteristics, Shannon entropy, and location authenticity.
2. **Instant Emergency Escalation:** Medical waste, dead animals, and chemical hazards bypass human delay with an automated **30-minute SLA countdown timer**.
3. **Smart Duplicate Merging:** When 10 citizens photograph the same overflowing bin, it doesn't create 10 redundant tickets; it merges them into a single high-priority node.
4. **Mandatory Photo-Proof Resolution:** A driver cannot close a ticket by simply clicking a checkbox. The API mathematically blocks resolution unless an authentic post-cleanup photo is provided.
5. **Rotated & Interpolated Live GPS Tracking:** Google Maps-style 60 FPS smooth truck movement on custom Leaflet vector maps.

---

## 🧠 AI Agents, Machine Learning Models & Algorithms

Safaai Sarathi operates a dedicated micro-service hosting specialized AI models:

```
┌────────────────────────────────────────────────────────────────────────┐
│                     SAFAAI SARATHI AI SERVICE (Port 8100)              │
├────────────────────────────┬───────────────────────────────────────────┤
│ Model / Engine             │ Operational Purpose & Mathematical Spec   │
├────────────────────────────┼───────────────────────────────────────────┤
│ 👁️ Vision Waste Classifier │ 9-Class Waste Classification (Piles,      │
│    (Custom PyTorch / CNN)  │ Overflowing Bins, Medical, Bio-Waste)     │
├────────────────────────────┼───────────────────────────────────────────┤
│ 🧬 Duplicate Similarity    │ Cosine similarity on 512-dim visual       │
│    Embedder (ResNet Backbone)│ feature vectors + Haversine spatial radius│
├────────────────────────────┼───────────────────────────────────────────┤
│ 🔮 Hotspot Predictor       │ LightGBM Gradient Boosted Decision Trees  │
│    (LightGBM Hotspot v1)   │ trained on 45-day temporal civic data     │
├────────────────────────────┼───────────────────────────────────────────┤
│ 🛡️ Fraud & Anomaly Scorer  │ Multi-signal Heuristic + Entropy Scoring  │
│    (Shannon Entropy + EXIF)│ (Flags web downloaded / duplicate images) │
├────────────────────────────┼───────────────────────────────────────────┤
│ 🗺️ Fleet Routing Solver    │ TSP & VRP Solver with Nearest-Neighbor,   │
│    (2-Opt + Or-Opt Heuristic) 2-Opt edge swaps & Emergency locking     │
└────────────────────────────┴───────────────────────────────────────────┘
```

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
        STORE[Cloudflare R2 / Local Storage]
    end

    subgraph AIService [AI Inference Microservice - FastAPI / Node Engine]
        CLASS[Vision Classifier]
        SIM[Duplicate Detector]
        PRED[LightGBM Hotspot Engine]
    end

    CP & DP & OP & AP --> Gateway
    Gateway --> ISO --> Core
    Core <--> Data
    Core <--> AIService
```

---

## 🛠️ Complete Tech Stack by Component

| Domain | Technology / Library | Role & Justification |
| :--- | :--- | :--- |
| **Frontend Framework** | `React 18`, `TypeScript`, `Vite` | Ultra-fast client-side SPA with high type safety and sub-second builds. |
| **Styling & Design System** | `Tailwind CSS`, `Custom CSS Tokens` | True light/dark theme variables, pure `#000` AMOLED mode & glassmorphism. |
| **3D Graphics Engine** | `Three.js`, `@react-three/fiber` | Full-screen 3D dynamic driving truck intro with dynamic lighting & road physics. |
| **Mapping & Geospatial** | `Leaflet`, `React-Leaflet`, `OSM` | Real-time interpolated GPS markers, ward boundary polygons & heatmaps. |
| **Charts & Telemetry** | `Recharts` | Interactive resolution velocity, ward performance & category bar analytics. |
| **Backend Framework** | `Node.js`, `Express.js` (ES Modules) | High-concurrency event-driven architecture. |
| **ORM & Database** | `Prisma ORM`, `PostgreSQL 17` | Relational integrity with 17 schema models & strict audit logging. |
| **Realtime Sockets** | `Socket.io` | WebSocket rooms (`ward:<id>`, `truck:<id>`, `city`) for instantaneous GPS broadcasts. |
| **Security & Auth** | `Argon2id`, `JWT`, `Google OIDC`, `TOTP 2FA` | Cryptographically secure passwords, token-reuse family revocation & 2FA. |
| **Internationalization** | Zero-dependency Custom i18n | Instant switching between **English**, **हिन्दी (Hindi)**, and **ગુજરાતી (Gujarati)**. |

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
JWT_REFRESH_SECRET="safaai_super_secret_refresh_key"
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
GOOGLE_REDIRECT_URI="http://localhost:5100/api/auth/citizen/google/callback"
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

| Service | Port | Endpoint URL |
| :--- | :--- | :--- |
| 💻 **Frontend Web App** | `5273` | `http://localhost:5273` |
| ⚙️ **API Gateway** | `5100` | `http://localhost:5100/api/health` |
| 🧠 **AI Microservice** | `8100` | `http://localhost:8100/health` |

---

## 🔑 Seeded Demo Credentials

| Role | Portal Login | Email / Phone | Master Password |
| :--- | :--- | :--- | :--- |
| 👤 **Citizen** | `/login` | `citizen1@safaai.gov.in` | `safaai@2026` |
| 🚛 **Driver** | `/driver/login` | `driver1@safaai.gov.in` *(or OTP `9700000001`)* | `safaai@2026` |
| 🛡️ **Ward Officer** | `/officer/login` | `officer1@safaai.gov.in` | `safaai@2026` |
| 👑 **Super Admin** | `/admin/login` | `admin@safaai.gov.in` | `safaai@2026` |

---

<div align="center">

Made with ❤️ for **Swachh Bharat Abhiyan & Smart Cities Mission** 🇮🇳  
*Safaai Sarathi 2.0 — Built to empower citizens, drivers, and municipal administrators.*

</div>
