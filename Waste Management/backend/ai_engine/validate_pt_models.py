"""
Safaai Sarathi 2.0 - PyTorch .pt Model Loader & Sanity Verification Suite
========================================================================
Loads every exported .pt model and checkpoint file, executes sanity inference checks,
measures file sizes, and prints the final verification summary table.
"""

import os
import torch
import torch.nn as nn
from pt_wrappers import (
    HotspotDensityEngineModule,
    WardWhatIfForecasterModule,
    TSPFleetOptimizerModule,
    SafaaiSahayakNLPModule,
)

EXPORT_DIR = os.path.join(os.path.dirname(__file__), "exported_models")

def format_size(size_bytes: int) -> str:
    """Format bytes into readable KB/MB string."""
    if size_bytes >= 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.2f} MB"
    elif size_bytes >= 1024:
        return f"{size_bytes / 1024:.2f} KB"
    return f"{size_bytes} B"

def validate_all_models():
    results = []

    print("==========================================================================================")
    print("                    VALIDATING EXPORTED .PT MODELS & SANITY CHECKS                        ")
    print("==========================================================================================")

    # ------------------------------------------------ 1. Validate YOLOv8 .pt
    m1_path = os.path.join(EXPORT_DIR, "yolov8_waste_classifier.pt")
    m1_ckpt_path = os.path.join(EXPORT_DIR, "yolov8_waste_classifier.checkpoint.pt")
    try:
        # Load weights/checkpoint with weights_only=False for YOLO custom classes
        m1_data = torch.load(m1_path, map_location="cpu", weights_only=False)
        m1_ckpt = torch.load(m1_ckpt_path, map_location="cpu", weights_only=False)
        m1_size = os.path.getsize(m1_path)
        params_saved = f"YOLOv8 Weights + {len(m1_ckpt.get('classes', []))} Classes"
        passed = True
        print(f"✅ Model 1 (YOLOv8): Successfully loaded {format_size(m1_size)} weights file.")
    except Exception as e:
        passed = False
        m1_size = 0
        params_saved = f"Error: {e}"
        print(f"❌ Model 1 failed to load: {e}")

    results.append({
        "name": "Model 1: YOLOv8 Custom Waste Classifier",
        "type": "Trained (Deep Learning)",
        "params": params_saved,
        "size": format_size(m1_size),
        "passed": "YES" if passed else "NO",
    })

    # ------------------------------------------------ 2. Validate Hotspot Engine .pt
    m2_path = os.path.join(EXPORT_DIR, "hotspot_density_engine.pt")
    m2_ckpt_path = os.path.join(EXPORT_DIR, "hotspot_density_engine.checkpoint.pt")
    try:
        m2_state = torch.load(m2_path, map_location="cpu")
        m2_ckpt = torch.load(m2_ckpt_path, map_location="cpu")
        
        # Instantiate wrapper and load state dict
        m2_module = HotspotDensityEngineModule(m2_ckpt["params"])
        m2_module.load_state_dict(m2_state)
        
        # Sanity check forward pass
        out = m2_module(torch.zeros(1))
        assert "eps_meters" in out and out["eps_meters"] > 0
        m2_size = os.path.getsize(m2_path)
        params_saved = f"eps={out['eps_meters']:.1f}m, min_samples={out['min_samples']}, bw={out['kde_bandwidth']:.4f}"
        passed = True
        print(f"✅ Model 2 (Hotspots): Loaded state dict & verified buffers: eps={out['eps_meters']:.1f}m.")
    except Exception as e:
        passed = False
        m2_size = 0
        params_saved = f"Error: {e}"
        print(f"❌ Model 2 failed to load: {e}")

    results.append({
        "name": "Model 2: Spatial Hotspot & Density Engine",
        "type": "Calibrated (DBSCAN + KDE)",
        "params": params_saved,
        "size": format_size(m2_size),
        "passed": "YES" if passed else "NO",
    })

    # ------------------------------------------------ 3. Validate Ward Forecaster .pt
    m3_path = os.path.join(EXPORT_DIR, "ward_whatif_forecaster.pt")
    m3_ckpt_path = os.path.join(EXPORT_DIR, "ward_whatif_forecaster.checkpoint.pt")
    try:
        m3_state = torch.load(m3_path, map_location="cpu")
        m3_ckpt = torch.load(m3_ckpt_path, map_location="cpu")
        
        m3_module = WardWhatIfForecasterModule(m3_ckpt["params"])
        m3_module.load_state_dict(m3_state)

        # Sanity check Markov matrix multiplication
        test_state = torch.tensor([1.0, 0.0, 0.0, 0.0])
        next_state_prob = m3_module(test_state)
        assert torch.isclose(torch.sum(next_state_prob), torch.tensor(1.0), atol=1e-3)
        
        m3_size = os.path.getsize(m3_path)
        params_saved = f"lambda={float(m3_module.poisson_lambda_inflow):.2f} T/d, 4x4 Markov Matrix"
        passed = True
        print(f"✅ Model 3 (Forecaster): Loaded state dict & verified Markov state transition buffer.")
    except Exception as e:
        passed = False
        m3_size = 0
        params_saved = f"Error: {e}"
        print(f"❌ Model 3 failed to load: {e}")

    results.append({
        "name": "Model 3: Predictive Ward What-If Forecaster",
        "type": "Calibrated (Poisson-Markov)",
        "params": params_saved,
        "size": format_size(m3_size),
        "passed": "YES" if passed else "NO",
    })

    # ------------------------------------------------ 4. Validate TSP Optimizer .pt
    m4_path = os.path.join(EXPORT_DIR, "tsp_fleet_optimizer.pt")
    m4_ckpt_path = os.path.join(EXPORT_DIR, "tsp_fleet_optimizer.checkpoint.pt")
    try:
        m4_state = torch.load(m4_path, map_location="cpu")
        m4_ckpt = torch.load(m4_ckpt_path, map_location="cpu")

        m4_module = TSPFleetOptimizerModule(m4_ckpt["params"])
        m4_module.load_state_dict(m4_state)

        out4 = m4_module()
        assert out4["cooling_rate"] > 0
        m4_size = os.path.getsize(m4_path)
        params_saved = f"T0={out4['initial_temperature']}, alpha={out4['cooling_rate']}, max_iter={out4['max_sa_iterations']}"
        passed = True
        print(f"✅ Model 4 (TSP Optimizer): Loaded state dict & verified Simulated Annealing schedule.")
    except Exception as e:
        passed = False
        m4_size = 0
        params_saved = f"Error: {e}"
        print(f"❌ Model 4 failed to load: {e}")

    results.append({
        "name": "Model 4: 2-Opt TSP Fleet Route Optimizer",
        "type": "Calibrated (Combinatorial SA)",
        "params": params_saved,
        "size": format_size(m4_size),
        "passed": "YES" if passed else "NO",
    })

    # ------------------------------------------------ 5. Validate NLP Assistant .pt
    m5_path = os.path.join(EXPORT_DIR, "safaai_sahayak_nlp.pt")
    m5_ckpt_path = os.path.join(EXPORT_DIR, "safaai_sahayak_nlp.checkpoint.pt")
    try:
        m5_state = torch.load(m5_path, map_location="cpu")
        m5_ckpt = torch.load(m5_ckpt_path, map_location="cpu")

        # Dynamically size intent embeddings buffer from state dict tensor shape
        emb_shape = m5_state["intent_embeddings"].shape
        m5_module = SafaaiSahayakNLPModule({"intent_embeddings": torch.zeros(emb_shape)})
        m5_module.load_state_dict(m5_state)

        # Sanity check forward cosine computation
        test_vec = torch.randn((1, emb_shape[1]))
        sim_scores = m5_module(test_vec)
        assert sim_scores.shape == (1, emb_shape[0])
        
        m5_size = os.path.getsize(m5_path)
        params_saved = f"Intent Tensor {emb_shape[0]}x{emb_shape[1]} (EN/HI/GU)"
        passed = True
        print(f"✅ Model 5 (NLP Assistant): Loaded state dict & verified Multilingual intent buffer ({emb_shape[0]}x{emb_shape[1]}).")
    except Exception as e:
        passed = False
        m5_size = 0
        params_saved = f"Error: {e}"
        print(f"❌ Model 5 failed to load: {e}")

    results.append({
        "name": "Model 5: AI Safaai Sahayak Multilingual NLP",
        "type": "Calibrated (Multilingual Embeddings)",
        "params": params_saved,
        "size": format_size(m5_size),
        "passed": "YES" if passed else "NO",
    })

    # Print Final Markdown-Formatted Table
    print("\n" + "=" * 90)
    print("                      FINAL SUMMARY & EXPORT VERIFICATION TABLE                      ")
    print("=" * 90)
    print(f"{'Module Name':<42} | {'Type':<18} | {'Params Saved':<30} | {'.pt Size':<10} | {'Load Test'}")
    print("-" * 115)
    for r in results:
        print(f"{r['name']:<42} | {r['type']:<18} | {r['params'][:28]:<30} | {r['size']:<10} | {r['passed']}")
    print("=" * 115)

if __name__ == "__main__":
    validate_all_models()
