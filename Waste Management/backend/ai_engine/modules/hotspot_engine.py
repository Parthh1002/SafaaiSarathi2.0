"""
MODEL 2: AI Spatial Hotspot & Density Engine
=============================================
Category: Geospatial Clustering (Unsupervised Learning)
Core Algorithms: DBSCAN (Density-Based Spatial Clustering) + Kernel Density Estimation (KDE)

Features:
- DBSCAN clustering using Haversine spherical distance metric.
- K-distance graph elbow method to auto-suggest optimal `eps` parameter in meters.
- Gaussian Kernel Density Estimation (KDE) for continuous spatial probability surfaces.
- Categorizes points into:
  * "High Density Zone" (DBSCAN core/border clusters)
  * "Emerging Accumulation" (KDE elevated density zones)
  * "Dispersed Incidents" (noise points, cluster_id = -1)
"""

from typing import List, Dict, Any, Optional, Tuple
import math
import numpy as np
import pandas as pd
from sklearn.cluster import DBSCAN
from sklearn.neighbors import NearestNeighbors
from scipy.stats import gaussian_kde

EARTH_RADIUS_METERS = 6371008.8

class SpatialHotspotEngine:
    """
    Geospatial clustering and accumulation density analysis engine for civic waste incidents.
    """

    def __init__(self, default_eps_meters: float = 350.0, default_min_samples: int = 4):
        self.default_eps_meters = default_eps_meters
        self.default_min_samples = default_min_samples

    @staticmethod
    def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate great-circle distance between two GPS coordinates in meters."""
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)

        a = (math.sin(delta_phi / 2.0) ** 2 +
             math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return EARTH_RADIUS_METERS * c

    def find_optimal_eps(self, coordinates: np.ndarray, k: int = 4) -> float:
        """
        Auto-suggest optimal DBSCAN epsilon (in meters) using the k-distance elbow method.
        Computes k-th nearest neighbor distance for each point in meters.
        """
        if len(coordinates) <= k:
            return self.default_eps_meters

        # Convert lat/lng degrees to radians for spherical nearest neighbor lookup
        coords_rad = np.radians(coordinates)
        nbrs = NearestNeighbors(n_neighbors=k, metric='haversine').fit(coords_rad)
        distances, _ = nbrs.kneighbors(coords_rad)

        # Distance in meters to the k-th neighbor
        k_distances_m = np.sort(distances[:, k - 1] * EARTH_RADIUS_METERS)
        
        # 80th-90th percentile knee heuristic for spatial urban incident clusters
        knee_idx = int(len(k_distances_m) * 0.85)
        suggested_eps = float(k_distances_m[knee_idx])
        return max(100.0, min(1000.0, suggested_eps))

    def analyze_hotspots(
        self,
        reports: List[Dict[str, Any]],
        eps_meters: Optional[float] = None,
        min_samples: Optional[int] = None,
        kde_grid_size: int = 25,
    ) -> Dict[str, Any]:
        """
        Execute DBSCAN clustering and KDE surface analysis on waste incident reports.

        :param reports: List of dicts with 'latitude', 'longitude', optional 'id', 'category', 'weight'
        :param eps_meters: Maximum distance in meters between points to form cluster (auto-tuned if None)
        :param min_samples: Minimum points required to form a high-density cluster
        :param kde_grid_size: Resolution of the density surface estimation grid
        :return: Structured dashboard dictionary matching Safaai specs
        """
        if not reports:
            return {
                "status": "empty",
                "summary": {"total_reports": 0, "clusters_found": 0, "noise_count": 0, "eps_meters": 0.0},
                "high_density_zones": [],
                "emerging_accumulations": [],
                "dispersed_incidents": [],
            }

        # Extract coordinate array
        coords = np.array([[r["latitude"], r["longitude"]] for r in reports], dtype=float)
        n_samples = len(coords)

        # 1. Auto-tune or apply hyperparameters
        actual_min_samples = min_samples if min_samples is not None else max(2, min(self.default_min_samples, n_samples // 3))
        if eps_meters is None:
            actual_eps_meters = self.find_optimal_eps(coords, k=actual_min_samples)
        else:
            actual_eps_meters = eps_meters

        # 2. DBSCAN Clustering with Haversine metric (radian unit)
        coords_rad = np.radians(coords)
        eps_rad = actual_eps_meters / EARTH_RADIUS_METERS

        db = DBSCAN(eps=eps_rad, min_samples=actual_min_samples, metric="haversine")
        cluster_labels = db.fit_predict(coords_rad)

        # 3. Kernel Density Estimation (KDE) surface
        emerging_accumulations = []
        if n_samples >= 3:
            try:
                # Transpose for scipy kde (shape: [2, N])
                kde = gaussian_kde(coords.T)
                lat_min, lat_max = coords[:, 0].min(), coords[:, 0].max()
                lng_min, lng_max = coords[:, 1].min(), coords[:, 1].max()

                # Add 10% padding
                lat_pad = max(0.002, (lat_max - lat_min) * 0.1)
                lng_pad = max(0.002, (lng_max - lng_min) * 0.1)

                grid_lat = np.linspace(lat_min - lat_pad, lat_max + lat_pad, kde_grid_size)
                grid_lng = np.linspace(lng_min - lng_pad, lng_max + lng_pad, kde_grid_size)
                mesh_lat, mesh_lng = np.meshgrid(grid_lat, grid_lng)
                grid_coords = np.vstack([mesh_lat.ravel(), mesh_lng.ravel()])

                density_values = kde(grid_coords).reshape(mesh_lat.shape)
                density_threshold = float(np.percentile(density_values, 85))

                # Identify local peaks representing emerging hotspots
                for i in range(1, kde_grid_size - 1):
                    for j in range(1, kde_grid_size - 1):
                        val = density_values[i, j]
                        if val >= density_threshold:
                            # Check if local maximum
                            surroundings = density_values[i-1:i+2, j-1:j+2]
                            if val == surroundings.max():
                                emerging_accumulations.append({
                                    "latitude": round(float(grid_lat[j]), 6),
                                    "longitude": round(float(grid_lng[i]), 6),
                                    "density_score": round(float(val / density_values.max() * 100.0), 2),
                                    "zone_classification": "Emerging Accumulation",
                                    "recommended_action": "Stage preventive mobile collection van & CCTV check",
                                })
            except Exception as kde_err:
                print(f"[HotspotEngine] KDE computation warning: {kde_err}")

        # 4. Aggregate High Density Clusters and Dispersed Noise Incidents
        unique_labels = set(cluster_labels)
        high_density_zones = []
        dispersed_incidents = []

        for label in unique_labels:
            mask = (cluster_labels == label)
            cluster_reports = [reports[idx] for idx in np.where(mask)[0]]
            cluster_coords = coords[mask]

            if label == -1:
                # Noise points -> Dispersed Incidents
                for rep in cluster_reports:
                    dispersed_incidents.append({
                        "id": rep.get("id", f"rep_{len(dispersed_incidents)+1}"),
                        "latitude": float(rep["latitude"]),
                        "longitude": float(rep["longitude"]),
                        "category": rep.get("category", "General Waste"),
                        "status": "Dispersed Incident",
                        "handling": "Standard daily route pickup",
                    })
            else:
                # Valid dense cluster -> High Density Zone
                centroid_lat = float(cluster_coords[:, 0].mean())
                centroid_lng = float(cluster_coords[:, 1].mean())
                radius_m = float(max([self.haversine_distance(centroid_lat, centroid_lng, p[0], p[1]) for p in cluster_coords]))

                severity = (
                    "CRITICAL" if len(cluster_reports) >= 8
                    else "HIGH" if len(cluster_reports) >= 5
                    else "MODERATE"
                )

                high_density_zones.append({
                    "cluster_id": int(label) + 1,
                    "name": f"High Density Cluster #{int(label)+1}",
                    "severity": severity,
                    "report_count": len(cluster_reports),
                    "centroid": {"latitude": round(centroid_lat, 6), "longitude": round(centroid_lng, 6)},
                    "bounding_radius_meters": round(max(50.0, radius_m), 1),
                    "bounds": {
                        "min_lat": float(cluster_coords[:, 0].min()),
                        "max_lat": float(cluster_coords[:, 0].max()),
                        "min_lng": float(cluster_coords[:, 1].min()),
                        "max_lng": float(cluster_coords[:, 1].max()),
                    },
                    "incidents": [
                        {
                            "id": r.get("id", f"c{label}_{i}"),
                            "latitude": float(r["latitude"]),
                            "longitude": float(r["longitude"]),
                            "category": r.get("category", "Garbage Pile"),
                        }
                        for i, r in enumerate(cluster_reports)
                    ],
                    "recommendation": "Deploy high-capacity compactor truck and install permanent community bin",
                })

        # Sort zones by severity & report count
        high_density_zones.sort(key=lambda x: x["report_count"], reverse=True)

        return {
            "status": "success",
            "summary": {
                "total_reports": n_samples,
                "clusters_found": len(high_density_zones),
                "high_density_incidents": sum(z["report_count"] for z in high_density_zones),
                "dispersed_incidents_count": len(dispersed_incidents),
                "emerging_hotspots_detected": len(emerging_accumulations),
                "eps_meters_applied": round(actual_eps_meters, 1),
                "min_samples_applied": actual_min_samples,
            },
            "high_density_zones": high_density_zones,
            "emerging_accumulations": emerging_accumulations,
            "dispersed_incidents": dispersed_incidents,
        }

    @staticmethod
    def generate_mock_reports(num_samples: int = 40, center_lat: float = 23.2156, center_lng: float = 72.6369) -> List[Dict[str, Any]]:
        """Generate realistic synthetic geospatial waste incidents around a municipal center."""
        np.random.seed(42)
        mock_data = []

        # Generate 2 dense clusters
        cluster1_pts = np.random.normal(loc=[center_lat + 0.005, center_lng - 0.004], scale=0.0012, size=(16, 2))
        cluster2_pts = np.random.normal(loc=[center_lat - 0.006, center_lng + 0.007], scale=0.0015, size=(14, 2))
        
        # Generate dispersed noise points
        noise_pts = np.random.uniform(low=[center_lat - 0.02, center_lng - 0.02], high=[center_lat + 0.02, center_lng + 0.02], size=(num_samples - 30, 2))

        all_pts = np.vstack([cluster1_pts, cluster2_pts, noise_pts])
        categories = ["overflowing_bin", "garbage_pile", "illegal_dumping", "construction_debris", "medical_waste"]

        for idx, pt in enumerate(all_pts):
            mock_data.append({
                "id": f"REP-MOCK-{idx+1:03d}",
                "latitude": float(pt[0]),
                "longitude": float(pt[1]),
                "category": categories[idx % len(categories)],
                "timestamp": f"2026-08-17T{10 + (idx % 12):02d}:30:00Z",
            })

        return mock_data
