# 🧠 Safaai Sarathi 2.0 — Classical & Algorithmic AI Engine
> **High-Performance Municipal AI Microservice Suite (Models 2, 3, 4, and 5)**

---

## 📌 Architectural Clarification

| AI Category | Models in Safaai Sarathi | Training Paradigm | Artifacts |
|---|---|---|---|
| **Deep Learning (Supervised)** | **Model 1:** YOLOv8 Custom Waste Classifier | Supervised backpropagation over labeled dataset | `safaai_best.pt` weights |
| **Classical & Algorithmic AI** | **Model 2:** Spatial Hotspot & Density Engine<br>**Model 3:** Predictive Ward What-If Forecaster<br>**Model 4:** 2-Opt TSP Fleet Route Optimizer<br>**Model 5:** AI Safaai Sahayak Multilingual NLP | Unsupervised Clustering, Monte Carlo Simulation, Combinatorial Graph Optimization, Semantic N-gram Intent Matching | Calibrated Hyperparameters, Transition Matrices, Rate Distributions, Vector Embeddings |

---

## 📊 Summary of Classical AI Modules

| Module Name | Algorithm Used | Key Python Stack | Tunable Parameters | Required Dashboard Outputs |
|---|---|---|---|---|
| **Model 2: Spatial Hotspot & Density Engine** | **DBSCAN** (Haversine distance) + **Gaussian KDE** | `scikit-learn`, `scipy.stats`, `numpy`, `pandas` | `eps_meters` (auto-tuned via k-distance elbow), `min_samples` | • `"High Density Zone"` clusters<br>• `"Emerging Accumulation"` areas<br>• `"Dispersed Incidents"` (Noise) |
| **Model 3: Predictive Ward What-If Forecaster** | **Monte Carlo Simulation** + **Poisson Ingestion Rate** + **Markov Chain Transitions** | `numpy`, `scipy.stats`, `simpy`, `pandas` | Poisson $\lambda$ (daily inflow), Markov state transition matrix $P_{ij}$, clearance rate | • `"Overflow Probability %"`<br>• `"Projected Inflow Rate"` (95% CI)<br>• `"SLA Deficit Risk"` (LOW/MED/HIGH/CRIT)<br>• What-If Delta Comparison |
| **Model 4: 2-Opt TSP Fleet Route Optimizer** | **2-Opt Local Search** + **Simulated Annealing** + **Dynamic Insertion** | `numpy`, `geopy`, `networkx` | Initial temperature $T_0$, cooling rate $\alpha$, truck average velocity | • `"Sequential Turn-by-Turn"` route<br>• `"Saved Km Calculation"` (% savings vs naive)<br>• `"Dynamic Insertion"` mid-route |
| **Model 5: AI Safaai Sahayak NLP** | **Multilingual Semantic Intent Matching** (TF-IDF N-grams & Cosine Distance) | `scikit-learn`, `sentence-transformers`, `FastAPI` | Similarity confidence threshold ($\tau = 0.55$), N-gram range | • Matched Intent & Confidence Score<br>• Localized Responses in EN, HI, GU<br>• Graceful Fallback on Low Confidence |

---

## 🛠️ Real Historical Data Calibration Guide (Pre-Production Checklist)

Before deploying to a live municipal environment, the following modules must be calibrated using real urban telemetry:

### 1. Model 2 (Hotspots & Density Engine)
- **Real Data Needed:** Minimum 60–90 days of geocoded citizen complaint logs (`latitude`, `longitude`, `timestamp`, `ward_id`).
- **Calibration Action:** Run `find_optimal_eps()` over historical data to compute ward-specific spatial density knees (e.g. dense urban wards typically need `eps = 180m–250m`, while peri-urban sectors need `eps = 400m–600m`).

### 2. Model 3 (Ward What-If Forecaster)
- **Real Data Needed:** Daily weighbridge manifests or compactor weigh-ins per ward (in metric tonnes/day), seasonal logs (monsoon vs festival surge).
- **Calibration Action:**
  1. Fit Poisson $\lambda$ to empirical daily weight histograms using Maximum Likelihood Estimation (MLE): $\hat{\lambda} = \frac{1}{N} \sum x_i$.
  2. Compute empirical Markov Transition Matrix $P_{ij}$ by tracking how often bins move between `OPTIMAL` $\rightarrow$ `FILLING` $\rightarrow$ `NEAR_FULL` $\rightarrow$ `OVERFLOW` under varying truck clearance frequencies.

### 3. Model 4 (TSP Fleet Optimizer)
- **Real Data Needed:** Real-world GPS vehicle speed profiles across rush hours (e.g. 7 AM – 11 AM) and actual road network topology.
- **Calibration Action:** Adjust `avg_speed_kmh` by zone and tune `stop_service_time_mins` (average hydraulic bin lifting cycle time: 3.5 to 5.0 mins).

### 4. Model 5 (Safaai Sahayak NLP)
- **Real Data Needed:** Real citizen support transcripts in English, Hindi, and Gujarati from WhatsApp / IVR / Call Center logs.
- **Calibration Action:** Expand intent dataset with local dialectal variations (e.g., *kachrawali gadi*, *dabba uffan*, *khula dhalav*) and re-index vectorizer.

---

## 🚀 Running the AI Engine Microservice

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Run Test Suite
```bash
python test_ai_modules.py
```

### 3. Launch FastAPI Server
```bash
uvicorn app:app --host 0.0.0.0 --port 8200 --reload
```
API Documentation available at: `http://localhost:8200/docs`
