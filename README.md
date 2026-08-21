<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0F2A1D,50:16743F,100:4DBF7D&height=200&section=header&text=Safaai%20Sarathi%202.0&fontSize=48&fontColor=FFFFFF&fontAlignY=38&desc=Next-Gen%20Autonomous%20Civic%20Waste%20Management%20Ecosystem&descSize=15&descAlignY=58&animation=fadeIn" width="100%" alt="banner" />

### स्वच्छ भारत मिशन — Next-Gen Civic Waste Management, Built to Actually Work

[![SIH 2026](https://img.shields.io/badge/Smart_India_Hackathon-2026-FF6B35?style=for-the-badge&logo=india&logoColor=white)](#)
[![Team](https://img.shields.io/badge/Team-Ekalavya-16743F?style=for-the-badge)](#-team-ekalavya)
[![License](https://img.shields.io/badge/License-MIT-4DBF7D?style=for-the-badge)](#-license)
[![React](https://img.shields.io/badge/React_18-000?style=for-the-badge&logo=react)](#)
[![Node](https://img.shields.io/badge/Node.js-000?style=for-the-badge&logo=nodedotjs)](#)
[![Postgres](https://img.shields.io/badge/PostgreSQL-000?style=for-the-badge&logo=postgresql)](#)

[**🌐 Live Demo**](https://waste-management-black.vercel.app) &nbsp;·&nbsp; [**⚙️ API Health**](https://safaai-api.onrender.com/api/health) &nbsp;·&nbsp; [**🏗️ Architecture**](#-system-workflow)

</div>

Municipal waste complaints in most Indian cities vanish into the same black hole — a form nobody reads, a status that never updates, no proof anything was ever cleaned. **Safaai Sarathi 2.0** replaces that with a real-time, AI-verified, four-portal system where every report is tracked, prioritised, and closed with photographic proof.

<div align="center">
<table>
<tr>
<td><img src="docs/assets/live-landing.png" width="270"/><p align="center"><sub>Landing page</sub></p></td>
<td><img src="docs/assets/live-login.png" width="270"/><p align="center"><sub>Per-portal sign-in</sub></p></td>
<td><img src="docs/assets/live-citizen-home.png" width="270"/><p align="center"><sub>Citizen home</sub></p></td>
</tr>
<tr>
<td><img src="docs/assets/live-driver-route.png" width="270"/><p align="center"><sub>Driver live route</sub></p></td>
<td><img src="docs/assets/live-officer-dashboard.png" width="270"/><p align="center"><sub>Officer console</sub></p></td>
<td><img src="docs/assets/live-admin-dashboard.png" width="270"/><p align="center"><sub>Admin command centre</sub></p></td>
</tr>
</table>
<sub>Live screenshots — <a href="https://waste-management-black.vercel.app">waste-management-black.vercel.app</a></sub>
</div>

<br/>

## 🎯 Objective

**The problem:** civic grievance systems today are passive — complaints are filed and forgotten, closures are self-reported with no verification, duplicate reports flood the same pothole while real emergencies wait in the same queue, and citizens have zero visibility once they hit submit.

**Our mission:** build a municipal-grade platform where an AI agent triages every report the instant it arrives, emergencies bypass the queue automatically, routes are solved and road-snapped instead of guessed, and a ticket physically cannot close without proof — ready to demo for SIH 2026 and structured to be deployable by a real ULB.

<br/>

## ⭐ Key Features

| | Feature | What it does |
|---|---|---|
| 🧠 | **AI-Powered Verification** | Vision model predicts waste category on submit; low-confidence reports route to a human instead of auto-approving |
| 🔍 | **Fraud & Duplicate Detection** | Scores EXIF, photo-hash reuse, and location plausibility; merges reports of the same issue instead of stacking tickets |
| 🛰️ | **Real-Time GPS Tracking** | Citizens watch their assigned truck move live, the same way they'd track a food delivery |
| 🗺️ | **Optimised, Road-Snapped Routing** | 2-opt solver + OSRM — real street-following paths, not straight lines |
| 🚨 | **SLA-Based Auto-Escalation** | Emergency categories get a 30-minute clock; unacknowledged tickets escalate automatically |
| 🔐 | **Role-Isolated Portals** | Citizen, Driver, Officer, Admin — four separate logins, four separate JWT audiences, zero cross-access |
| 🌐 | **Multilingual by Default** | English / हिन्दी / ગુજરાતી, switchable before login |
| 🏆 | **Citizen Rewards Engine** | Green Credits for verified reports, redeemable for real incentives |

<br/>

## 🛠️ Technology Stack

<div align="center">
<img src="https://skillicons.dev/icons?i=react,ts,vite,tailwind,nodejs,express,prisma,postgres,socketio,python,pytorch,fastapi,vercel,git,github" />
</div>

<br/>

## 🏗️ System Workflow

`mermaid
flowchart TD
    %% Define Colors matching the architecture diagram
    classDef blue fill:#eef2ff,stroke:#3b82f6,stroke-width:2px,color:#1e40af
    classDef purple fill:#faf5ff,stroke:#a855f7,stroke-width:2px,color:#6b21a8
    classDef grey fill:#f3f4f6,stroke:#6b7280,stroke-width:2px,color:#374151
    classDef orange fill:#fff7ed,stroke:#f97316,stroke-width:2px,color:#9a3412
    classDef green fill:#f0fdf4,stroke:#22c55e,stroke-width:2px,color:#166534

    %% Nodes
    C1["👤 1. Citizen Registration & Profile"]:::blue
    C2["📸 2. Issue Reporting (Camera & GPS)"]:::blue
    C3["🤖 3. Safaai Sahayak (NLP Chatbot)"]:::blue
    
    A4["🧠 4. AI Triage Hub (YOLOv8)"]:::purple
    
    O5["🏛️ 5. Officer Command Center"]:::grey
    O9["📍 9. Live Map Dashboards"]:::grey
    
    D6["🚚 6. Driver Navigation Portal"]:::orange
    
    R7["✅ 7. Resolution Validation"]:::green
    R8["💰 8. Green Credits Ledger"]:::green

    %% Connections
    C1 -- "Submit Complaint" --> C2
    C1 -- "Ask Query / Help" --> C3
    C3 -- "Guided Complaint Filing" --> C2
    
    C2 -- "Send for Auto-Verification" --> A4
    
    A4 -- "Auto-Approve (≥70% Conf.)" --> O5
    A4 -- "Manual Review (<70% Conf.)" --> O5
    
    O5 -- "Assign Task & Route" --> D6
    O5 -- "Update Status" --> O9
    
    D6 -- "Live GPS Push" --> O9
    D6 -- "Upload After-Cleanup Proof" --> R7
    
    R7 -- "Trigger Reward" --> R8
    R7 -- "Resolution Alert & Feedback" --> O9
    
    R8 -- "Redeem for Tax Discount" --> C3
`

Every request passes through one **portal guard** that checks the JWT's audience before anything else runs — that's what makes the four portals genuinely isolated, not just a styling difference. The AI service acts as the triage brain, ensuring only verified and critical data reaches the officer layer.

<br/>

## 🚀 Setup & Installation

**Prerequisites:** Node.js ≥ 18, npm, Python 3.9+, PostgreSQL 17 instance.

`ash
# 1. Clone & enter the project
git clone https://github.com/TIRTHPATEL3086/SIH-2026-safaai-sarathi.git
cd "SIH-2026-safaai-sarathi/Waste Management"

# 2. Install all workspaces (frontend + api + ai)
npm run install:all

# 3. Configure backend/api/.env (copy from .env.example) with your DATABASE_URL

# 4. Push the schema, then seed deterministic demo data
npm run db:push
npm run seed

# 5. Run everything together
npm run dev
`

<details open>
<summary><b>📁 Complete Folder Structure</b></summary>

`	ext
SafaaiSarathi2.0/
├── 📂 backend/
│   ├── 📁 api/               # Express + Prisma (Core backend, Routes, Sockets, JWT Auth)
│   ├── 📁 ai_engine/         # NLP & Hotspot Services (Fraud scoring, LightGBM)
│   └── 📁 vision/            # FastAPI + YOLOv8 (Image classification inference)
├── 📂 frontend/              # React 18 + Vite (Monorepo for all portals)
│   ├── 📁 src/
│   │   ├── 📁 portals/
│   │   │   ├── 📄 Citizen/   # PWA interface for public reporting
│   │   │   ├── 📄 Officer/   # Command center dashboard
│   │   │   ├── 📄 Driver/    # Navigation and task management
│   │   │   └── 📄 Admin/     # Global analytics and settings
│   │   ├── 📁 components/    # Shared UI library (Tailwind)
│   │   └── 📁 services/      # API clients & Socket hooks
├── 📄 package.json           # Workspace configurations
└── 📄 README.md              # You are here
`
</details>

<br/>

## 📊 Current Implementation Status

| Module | Status |
|---|---|
| Citizen / Driver / Officer / Admin portals | ✅ Done |
| Role-isolated authentication (JWT + Google OAuth) | ✅ Done |
| Real-time GPS tracking & Socket.io layer | ✅ Done |
| Road-snapped route optimisation (OSRM + 2-opt) | ✅ Done |
| SLA emergency escalation engine | ✅ Done |
| Hotspot forecasting & fraud scoring | ✅ Done |
| YOLOv8 live vision classification | 🚧 Model trained, standalone deployment in progress |
| Multilingual UI (English / Hindi / Gujarati) | ✅ Done |

<br/>

## 👥 Team Ekalavya

**LDRP Institute of Technology & Research, KSV, Gandhinagar**
Built with dedication by Team Ekalavya for Smart India Hackathon 2026.

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:4DBF7D,50:16743F,100:0F2A1D&height=120&section=footer&animation=fadeIn" width="100%" />

**Made with ❤️ for Swachh Bharat Mission**

</div>
