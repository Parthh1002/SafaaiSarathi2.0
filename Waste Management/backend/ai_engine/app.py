"""
Safaai Sarathi 2.0 - Unified AI Engine FastAPI Microservice
===========================================================
Exposes Classical/Algorithmic AI modules:
1. Model 2: /api/ai/hotspots (DBSCAN + KDE Spatial Density Engine)
2. Model 3: /api/ai/what-if-forecast & /api/ai/what-if-compare (Monte Carlo Ward Forecaster)
3. Model 4: /api/ai/route-optimize & /api/ai/dynamic-insert (2-Opt TSP Route Optimizer)
4. Model 5: /api/ai/nlp-assistant (Multilingual NLP Intent Matching)
"""

from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from modules.hotspot_engine import SpatialHotspotEngine
from modules.whatif_forecaster import WardWhatIfForecaster
from modules.route_optimizer import TSPRouteOptimizer
from modules.safaai_sahayak_nlp import SafaaiSahayakNLP

# Initialize engine instances
hotspot_engine = SpatialHotspotEngine()
whatif_forecaster = WardWhatIfForecaster()
route_optimizer = TSPRouteOptimizer()
nlp_assistant = SafaaiSahayakNLP()

app = FastAPI(
    title="Safaai Sarathi AI Engine API",
    description="Production-grade classical AI microservice for spatial clustering, ward forecasting, TSP fleet routing, and civic NLP.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------ Request / Response Models

class ReportPoint(BaseModel):
    id: Optional[str] = None
    latitude: float
    longitude: float
    category: Optional[str] = "General Waste"
    timestamp: Optional[str] = None

class HotspotRequest(BaseModel):
    reports: List[ReportPoint]
    eps_meters: Optional[float] = None
    min_samples: Optional[int] = None
    kde_grid_size: Optional[int] = 25

class WhatIfRequest(BaseModel):
    ward_id: str = "WARD-06"
    ward_name: str = "Sector 6 Municipal Ward"
    capacity_tonnes: float = 12.0
    current_volume_tonnes: float = 3.5
    avg_daily_inflow_tonnes: float = 4.2
    pickups_per_day: float = 2.0
    truck_capacity_per_trip: float = 2.5
    simulation_days: int = 7
    surge_multiplier: float = 1.0
    num_simulations: Optional[int] = 2500

class WhatIfCompareRequest(BaseModel):
    ward_id: str = "WARD-06"
    ward_name: str = "Sector 6 Municipal Ward"
    capacity_tonnes: float = 12.0
    current_volume_tonnes: float = 3.5
    avg_daily_inflow_tonnes: float = 4.2
    baseline_pickups_per_day: float = 2.0
    proposed_pickups_per_day: float = 1.0
    truck_capacity: float = 2.5
    surge_multiplier: float = 1.0
    simulation_days: int = 7

class Waypoint(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    address: Optional[str] = None
    latitude: float
    longitude: float
    priority: Optional[str] = "NORMAL"

class RouteOptimizeRequest(BaseModel):
    depot: Waypoint
    stops: List[Waypoint]
    return_to_depot: bool = False

class DynamicInsertRequest(BaseModel):
    current_route: List[Waypoint]
    new_stop: Waypoint

class NLPQueryRequest(BaseModel):
    query: str = Field(..., min_length=1, description="Citizen message in EN, HI, or GU")
    forced_lang: Optional[str] = None

# ------------------------------------------------ Endpoints

@app.get("/api/ai/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "Safaai Sarathi Classical AI Microservice",
        "modules_active": {
            "model_2_hotspots": "DBSCAN + Gaussian KDE",
            "model_3_forecaster": "Monte Carlo + Poisson-Markov Simulation",
            "model_4_tsp_router": "2-Opt Heuristic + Simulated Annealing",
            "model_5_nlp_assistant": "Multilingual TF-IDF N-gram Intent Classifier (EN/HI/GU)",
        },
    }

# 1. Model 2: Spatial Hotspots & Density Engine
@app.post("/api/ai/hotspots")
async def compute_hotspots(req: HotspotRequest):
    reports_dict = [r.model_dump() for r in req.reports]
    result = hotspot_engine.analyze_hotspots(
        reports=reports_dict,
        eps_meters=req.eps_meters,
        min_samples=req.min_samples,
        kde_grid_size=req.kde_grid_size or 25,
    )
    return result

# 2. Model 3: Predictive Ward What-If Forecaster
@app.post("/api/ai/what-if-forecast")
async def forecast_ward(req: WhatIfRequest):
    result = whatif_forecaster.simulate_ward(
        ward_id=req.ward_id,
        ward_name=req.ward_name,
        capacity_tonnes=req.capacity_tonnes,
        current_volume_tonnes=req.current_volume_tonnes,
        avg_daily_inflow_tonnes=req.avg_daily_inflow_tonnes,
        pickups_per_day=req.pickups_per_day,
        truck_capacity_per_trip=req.truck_capacity_per_trip,
        simulation_days=req.simulation_days,
        surge_multiplier=req.surge_multiplier,
        num_simulations=req.num_simulations,
    )
    return result

@app.post("/api/ai/what-if-compare")
async def compare_what_if(req: WhatIfCompareRequest):
    result = whatif_forecaster.run_what_if_comparison(
        ward_id=req.ward_id,
        ward_name=req.ward_name,
        capacity_tonnes=req.capacity_tonnes,
        current_volume_tonnes=req.current_volume_tonnes,
        avg_daily_inflow_tonnes=req.avg_daily_inflow_tonnes,
        baseline_pickups_per_day=req.baseline_pickups_per_day,
        proposed_pickups_per_day=req.proposed_pickups_per_day,
        truck_capacity=req.truck_capacity,
        surge_multiplier=req.surge_multiplier,
        simulation_days=req.simulation_days,
    )
    return result

# 3. Model 4: 2-Opt TSP Fleet Route Optimizer
@app.post("/api/ai/route-optimize")
async def optimize_route(req: RouteOptimizeRequest):
    depot_dict = req.depot.model_dump()
    stops_dict = [s.model_dump() for s in req.stops]
    result = route_optimizer.optimize_route(
        depot=depot_dict,
        stops=stops_dict,
        return_to_depot=req.return_to_depot,
    )
    return result

@app.post("/api/ai/dynamic-insert")
async def dynamic_insert(req: DynamicInsertRequest):
    route_dict = [s.model_dump() for s in req.current_route]
    new_stop_dict = req.new_stop.model_dump()
    result = route_optimizer.dynamic_insert_stop(
        current_route=route_dict,
        new_stop=new_stop_dict,
    )
    return result

# 4. Model 5: AI Safaai Sahayak Multilingual NLP
@app.post("/api/ai/nlp-assistant")
async def nlp_assist(req: NLPQueryRequest):
    result = nlp_assistant.match_intent(
        query=req.query,
        forced_lang=req.forced_lang,
    )
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8200, reload=True)
