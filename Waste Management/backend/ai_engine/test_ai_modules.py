"""
Comprehensive Test Suite for Safaai AI Engine (Models 2, 3, 4, 5)
==================================================================
Validates all required output structures, statistical fields, and dashboard contract fields.
"""

import pytest
import numpy as np
from modules.hotspot_engine import SpatialHotspotEngine
from modules.whatif_forecaster import WardWhatIfForecaster
from modules.route_optimizer import TSPRouteOptimizer
from modules.safaai_sahayak_nlp import SafaaiSahayakNLP

# ------------------------------------------------ MODULE 1 / MODEL 2 TESTS
def test_spatial_hotspot_engine():
    engine = SpatialHotspotEngine(default_eps_meters=350.0, default_min_samples=3)
    mock_reports = engine.generate_mock_reports(num_samples=35)

    assert len(mock_reports) == 35

    # 1. Test K-distance elbow calculation
    coords = np.array([[r["latitude"], r["longitude"]] for r in mock_reports])
    suggested_eps = engine.find_optimal_eps(coords, k=3)
    assert 50.0 <= suggested_eps <= 2000.0, f"Suggested eps out of range: {suggested_eps}"

    # 2. Test Full Hotspot & Density Analysis
    result = engine.analyze_hotspots(mock_reports)
    assert result["status"] == "success"

    # Check Required Output Keys
    assert "high_density_zones" in result
    assert "emerging_accumulations" in result
    assert "dispersed_incidents" in result
    assert "summary" in result

    # Check High Density Zones output fields
    assert len(result["high_density_zones"]) >= 1
    zone = result["high_density_zones"][0]
    assert "cluster_id" in zone
    assert "severity" in zone
    assert zone["severity"] in ["CRITICAL", "HIGH", "MODERATE"]
    assert "centroid" in zone
    assert "bounding_radius_meters" in zone
    assert "incidents" in zone

    # Check Dispersed Incidents (Noise)
    assert len(result["dispersed_incidents"]) >= 1
    disp = result["dispersed_incidents"][0]
    assert disp["status"] == "Dispersed Incident"

    print("\n✅ Model 2 (DBSCAN + KDE Hotspots) Test Passed successfully.")

# ------------------------------------------------ MODULE 2 / MODEL 3 TESTS
def test_ward_whatif_forecaster():
    forecaster = WardWhatIfForecaster(default_monte_carlo_runs=1000)

    # 1. Test Baseline Simulation
    sim = forecaster.simulate_ward(
        ward_id="WARD-06",
        ward_name="Sector 6",
        capacity_tonnes=10.0,
        current_volume_tonnes=3.0,
        avg_daily_inflow_tonnes=4.0,
        pickups_per_day=2.0,
        truck_capacity_per_trip=2.5,
        simulation_days=7,
    )

    metrics = sim["metrics"]
    assert "overflow_probability_pct" in metrics
    assert 0.0 <= metrics["overflow_probability_pct"] <= 100.0

    assert "projected_inflow_rate" in metrics
    inflow_rate = metrics["projected_inflow_rate"]
    assert "mean_tonnes_per_day" in inflow_rate
    assert "ci_95_lower" in inflow_rate
    assert "ci_95_upper" in inflow_rate
    assert inflow_rate["ci_95_lower"] <= inflow_rate["mean_tonnes_per_day"] <= inflow_rate["ci_95_upper"]

    assert "sla_deficit_risk" in metrics
    assert metrics["sla_deficit_risk"] in ["LOW", "MODERATE", "HIGH", "CRITICAL"]

    assert "forecast_trajectory" in sim
    assert len(sim["forecast_trajectory"]["days"]) == 7

    # 2. Test What-If Policy Comparison (Reducing pickups to 1x/day)
    comp = forecaster.run_what_if_comparison(
        ward_id="WARD-06",
        ward_name="Sector 6",
        capacity_tonnes=10.0,
        current_volume_tonnes=3.0,
        avg_daily_inflow_tonnes=4.0,
        baseline_pickups_per_day=2.0,
        proposed_pickups_per_day=1.0,
        truck_capacity=2.5,
    )

    assert "delta_metrics" in comp
    delta = comp["delta_metrics"]
    assert "overflow_prob_delta_pct" in delta
    assert delta["proposed_overflow_prob_pct"] >= delta["baseline_overflow_prob_pct"]
    assert "verdict" in delta

    print("✅ Model 3 (Monte Carlo What-If Forecaster) Test Passed successfully.")

# ------------------------------------------------ MODULE 3 / MODEL 4 TESTS
def test_tsp_route_optimizer():
    optimizer = TSPRouteOptimizer()

    depot = {"id": "DEPOT-01", "name": "Sector 6 Municipal Depot", "latitude": 23.2156, "longitude": 72.6369}
    stops = [
        {"id": "STOP-1", "address": "Block A Market", "latitude": 23.2201, "longitude": 72.6410},
        {"id": "STOP-2", "address": "City Hospital Gate", "latitude": 23.2250, "longitude": 72.6320},
        {"id": "STOP-3", "address": "Sector 6 School", "latitude": 23.2105, "longitude": 72.6450},
        {"id": "STOP-4", "address": "Residential Complex 4", "latitude": 23.2190, "longitude": 72.6280},
        {"id": "STOP-5", "address": "Commercial Hub", "latitude": 23.2270, "longitude": 72.6430},
    ]

    # 1. Full 2-Opt TSP Optimization
    res = optimizer.optimize_route(depot, stops, return_to_depot=True)

    assert res["status"] == "success"
    summary = res["summary"]
    assert summary["total_collection_stops"] == 5
    assert summary["optimized_distance_km"] > 0
    assert "saved_km" in summary
    assert "savings_percentage" in summary
    assert summary["optimized_distance_km"] <= summary["naive_distance_km"] + 0.05

    # Check Turn-by-Turn Waypoints
    assert len(res["turn_by_turn"]) == 6  # depot + 5 stops
    assert res["turn_by_turn"][0]["is_depot"] is True
    assert "cumulative_distance_km" in res["turn_by_turn"][1]

    # 2. Dynamic Insertion Test
    current_route = res["turn_by_turn"]
    new_urgent_stop = {"id": "URGENT-STOP-99", "address": "Emergency Point", "latitude": 23.2180, "longitude": 72.6350}

    insert_res = optimizer.dynamic_insert_stop(current_route, new_urgent_stop)
    assert insert_res["status"] == "success"
    assert "inserted_index" in insert_res
    assert 1 <= insert_res["inserted_index"] <= len(current_route)
    assert "detour_km" in insert_res
    assert insert_res["updated_route_length"] == len(current_route) + 1

    print("✅ Model 4 (2-Opt TSP Route Optimizer) Test Passed successfully.")

# ------------------------------------------------ MODULE 4 / MODEL 5 TESTS
def test_safaai_sahayak_nlp():
    nlp = SafaaiSahayakNLP()

    # 1. English Intent Query
    res_en = nlp.match_intent("Which dustbin do I use for vegetable food leftovers?")
    assert res_en["intent"] == "waste_sorting_help"
    assert res_en["confidence"] >= 0.55
    assert res_en["is_fallback"] is False
    assert res_en["language"] == "en"

    # 2. Hindi Intent Query
    res_hi = nlp.match_intent("सड़क पर मरा हुआ जानवर पड़ा है तुरंत मदद भेजो")
    assert res_hi["intent"] == "emergency_assistance"
    assert res_hi["confidence"] >= 0.55
    assert res_hi["is_fallback"] is False
    assert res_hi["language"] == "hi"

    # 3. Gujarati Intent Query
    res_gu = nlp.match_intent("મારી પાસે કેટલા ગ્રીન ક્રેડિટ પોઈન્ટ છે અને વાઉચર કેવી રીતે મળે?")
    assert res_gu["intent"] == "rewards_inquiry"
    assert res_gu["confidence"] >= 0.55
    assert res_gu["is_fallback"] is False
    assert res_gu["language"] == "gu"

    # 4. Low-confidence Gibberish -> Graceful Fallback
    res_fallback = nlp.match_intent("xyz abc qwerty random meaningless query 12345")
    assert res_fallback["is_fallback"] is True
    assert res_fallback["confidence"] < 0.55
    assert "not quite sure" in res_fallback["reply"] or "माफ़ कीजिये" in res_fallback["reply"] or "માફ કરશો" in res_fallback["reply"]

    print("✅ Model 5 (Multilingual NLP Safaai Sahayak) Test Passed successfully.")

if __name__ == "__main__":
    test_spatial_hotspot_engine()
    test_ward_whatif_forecaster()
    test_tsp_route_optimizer()
    test_safaai_sahayak_nlp()
    print("\n🎉 ALL 4 CLASSICAL/ALGORITHMIC AI MODULE TESTS COMPLETED WITH 100% PASS RATE!")
