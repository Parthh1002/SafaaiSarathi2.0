"""
Safaai Sarathi 2.0 - PyTorch Module Wrappers for Classical AI Models
===================================================================
Provides lightweight torch.nn.Module wrappers to serialize calibrated hyperparameters,
transition matrices, rate distributions, and intent embeddings consistently as .pt files.
"""

from typing import Dict, Any, List
import torch
import torch.nn as nn

# ------------------------------------------------ MODEL 2: Hotspot & Density Module
class HotspotDensityEngineModule(nn.Module):
    """
    PyTorch Wrapper for Model 2: Spatial Hotspot & Density Engine (DBSCAN + KDE).
    Stores calibrated epsilon (in meters & radians), minimum samples, and KDE bandwidth.
    """
    def __init__(self, params: Dict[str, Any]):
        super().__init__()
        self.params = params
        self.register_buffer("eps_meters", torch.tensor(params.get("eps_meters", 350.0), dtype=torch.float32))
        self.register_buffer("min_samples", torch.tensor(params.get("min_samples", 4), dtype=torch.int32))
        self.register_buffer("kde_bandwidth", torch.tensor(params.get("kde_bandwidth", 0.015), dtype=torch.float32))
        self.register_buffer("density_threshold_percentile", torch.tensor(params.get("density_threshold_percentile", 85.0), dtype=torch.float32))

    def forward(self, x: torch.Tensor) -> Dict[str, Any]:
        """Returns registered calibration parameters."""
        return {
            "eps_meters": float(self.eps_meters),
            "min_samples": int(self.min_samples),
            "kde_bandwidth": float(self.kde_bandwidth),
            "density_threshold_percentile": float(self.density_threshold_percentile),
        }

# ------------------------------------------------ MODEL 3: Ward Forecaster Module
class WardWhatIfForecasterModule(nn.Module):
    """
    PyTorch Wrapper for Model 3: Predictive Ward What-If Forecaster (Monte Carlo + Markov).
    Stores calibrated Poisson lambda arrival rates, empirical Markov transition matrix, and capacity thresholds.
    """
    def __init__(self, params: Dict[str, Any]):
        super().__init__()
        self.params = params
        
        # Register transition matrix as tensor buffer
        trans_matrix = params.get("markov_transition_matrix", [[0.7, 0.25, 0.05, 0.0],
                                                               [0.1, 0.65, 0.20, 0.05],
                                                               [0.0, 0.15, 0.60, 0.25],
                                                               [0.0, 0.05, 0.20, 0.75]])
        self.register_buffer("transition_matrix", torch.tensor(trans_matrix, dtype=torch.float32))
        self.register_buffer("poisson_lambda_inflow", torch.tensor(params.get("poisson_lambda_inflow", 4.2), dtype=torch.float32))
        self.register_buffer("threshold_optimal", torch.tensor(params.get("threshold_optimal", 0.40), dtype=torch.float32))
        self.register_buffer("threshold_filling", torch.tensor(params.get("threshold_filling", 0.75), dtype=torch.float32))
        self.register_buffer("threshold_near_full", torch.tensor(params.get("threshold_near_full", 0.95), dtype=torch.float32))
        self.register_buffer("monte_carlo_default_runs", torch.tensor(params.get("monte_carlo_default_runs", 2500), dtype=torch.int32))

    def forward(self, state_idx: torch.Tensor) -> torch.Tensor:
        """Matrix multiplication for Markov state transitions."""
        return torch.matmul(state_idx, self.transition_matrix)

# ------------------------------------------------ MODEL 4: TSP Fleet Optimizer Module
class TSPFleetOptimizerModule(nn.Module):
    """
    PyTorch Wrapper for Model 4: 2-Opt TSP Fleet Route Optimizer.
    Stores calibrated Simulated Annealing cooling schedule, average city velocity, and stop service times.
    """
    def __init__(self, params: Dict[str, Any]):
        super().__init__()
        self.params = params
        self.register_buffer("initial_temperature", torch.tensor(params.get("initial_temperature", 80.0), dtype=torch.float32))
        self.register_buffer("cooling_rate", torch.tensor(params.get("cooling_rate", 0.995), dtype=torch.float32))
        self.register_buffer("min_temperature", torch.tensor(params.get("min_temperature", 0.001), dtype=torch.float32))
        self.register_buffer("max_sa_iterations", torch.tensor(params.get("max_sa_iterations", 1500), dtype=torch.int32))
        self.register_buffer("avg_truck_speed_kmh", torch.tensor(params.get("avg_truck_speed_kmh", 22.0), dtype=torch.float32))
        self.register_buffer("stop_service_time_mins", torch.tensor(params.get("stop_service_time_mins", 4.0), dtype=torch.float32))

    def forward(self, x: torch.Tensor = None) -> Dict[str, Any]:
        return {
            "initial_temperature": float(self.initial_temperature),
            "cooling_rate": float(self.cooling_rate),
            "min_temperature": float(self.min_temperature),
            "max_sa_iterations": int(self.max_sa_iterations),
            "avg_truck_speed_kmh": float(self.avg_truck_speed_kmh),
            "stop_service_time_mins": float(self.stop_service_time_mins),
        }

# ------------------------------------------------ MODEL 5: Multilingual NLP Assistant Module
class SafaaiSahayakNLPModule(nn.Module):
    """
    PyTorch Wrapper for Model 5: AI Safaai Sahayak Multilingual NLP Assistant.
    Stores multilingual intent embeddings, intent vocabulary indices, and confidence threshold.
    """
    def __init__(self, params: Dict[str, Any] = None):
        super().__init__()
        params = params or {}
        self.params = params
        
        # Storing intent vector matrix as PyTorch tensor buffer with dynamic shape support
        intent_vectors = params.get("intent_embeddings", None)
        if intent_vectors is None:
            # Default placeholder that will be overwritten during load_state_dict
            intent_vectors = torch.zeros((78, 5595), dtype=torch.float32)
        elif not isinstance(intent_vectors, torch.Tensor):
            intent_vectors = torch.tensor(intent_vectors, dtype=torch.float32)
        
        self.register_buffer("intent_embeddings", intent_vectors)
        self.register_buffer("confidence_threshold", torch.tensor(params.get("confidence_threshold", 0.55), dtype=torch.float32))
        self.intent_labels = params.get("intent_labels", ["waste_sorting_help", "rewards_inquiry", "emergency_assistance", "pickup_schedule_inquiry", "general_faq"])
        self.supported_languages = params.get("supported_languages", ["en", "hi", "gu"])

    def forward(self, query_vector: torch.Tensor) -> torch.Tensor:
        """Compute cosine similarity against registered intent embeddings."""
        # Cosine similarity: (A . B) / (||A|| * ||B||)
        norm_query = torch.nn.functional.normalize(query_vector, p=2, dim=-1)
        norm_intents = torch.nn.functional.normalize(self.intent_embeddings, p=2, dim=-1)
        return torch.matmul(norm_query, norm_intents.T)
