"""
MODEL 4: 2-Opt TSP Fleet Route Optimizer
=========================================
Category: Combinatorial Graph Optimization
Core Algorithm: Travelling Salesperson Problem (TSP) Solver via 2-Opt Heuristic + Simulated Annealing

Features:
- Exact Great-Circle / Haversine distance matrix computation.
- Nearest-Neighbor greedy initial path construction.
- 2-Opt local search refinement with Simulated Annealing temperature cooling to untangle crossing paths.
- "Dynamic Insertion" engine to seamlessly splice new urgent pickup points into an active route with minimal detour.
- Outputs:
  * "Sequential Turn-by-Turn" waypoint ordering with cumulative distances and ETAs
  * "Saved Km Calculation" (comparing naive sequential route vs 2-opt optimized route)
  * "Dynamic Insertion Delta"
"""

from typing import List, Dict, Any, Optional, Tuple
import math
import numpy as np

EARTH_RADIUS_KM = 6371.0088

class TSPRouteOptimizer:
    """
    Combinatorial optimization engine for municipal waste collection vehicles.
    """

    def __init__(self, avg_speed_kmh: float = 22.0, stop_service_time_mins: float = 4.0):
        self.avg_speed_kmh = avg_speed_kmh
        self.stop_service_time_mins = stop_service_time_mins

    @staticmethod
    def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate great-circle distance between two coordinates in kilometers."""
        p1, p2 = math.radians(lat1), math.radians(lat2)
        dp = math.radians(lat2 - lat1)
        dl = math.radians(lon2 - lon1)

        a = math.sin(dp / 2.0) ** 2 + math.cos(p1) * math.cos(p2) * (math.sin(dl / 2.0) ** 2)
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return EARTH_RADIUS_KM * c

    def build_distance_matrix(self, points: List[Tuple[float, float]]) -> np.ndarray:
        """Construct full N x N pairwise distance matrix in kilometers."""
        n = len(points)
        matrix = np.zeros((n, n), dtype=float)
        for i in range(n):
            for j in range(i + 1, n):
                d = self.haversine_km(points[i][0], points[i][1], points[j][0], points[j][1])
                matrix[i, j] = d
                matrix[j, i] = d
        return matrix

    def nearest_neighbor_tour(self, dist_matrix: np.ndarray, start_idx: int = 0) -> List[int]:
        """Construct greedy nearest-neighbor initial route (Naive baseline)."""
        n = dist_matrix.shape[0]
        unvisited = set(range(n))
        unvisited.remove(start_idx)
        tour = [start_idx]

        curr = start_idx
        while unvisited:
            next_node = min(unvisited, key=lambda x: dist_matrix[curr, x])
            tour.append(next_node)
            unvisited.remove(next_node)
            curr = next_node

        return tour

    def calculate_tour_length(self, tour: List[int], dist_matrix: np.ndarray, return_to_depot: bool = False) -> float:
        """Calculate total kilometers traversed by a sequence of node indices."""
        total = 0.0
        for i in range(len(tour) - 1):
            total += dist_matrix[tour[i], tour[i + 1]]
        if return_to_depot and len(tour) > 1:
            total += dist_matrix[tour[-1], tour[0]]
        return total

    def two_opt_with_simulated_annealing(
        self,
        dist_matrix: np.ndarray,
        initial_tour: List[int],
        initial_temp: float = 80.0,
        cooling_rate: float = 0.995,
        min_temp: float = 0.001,
        max_iterations: int = 1500,
        return_to_depot: bool = False,
    ) -> Tuple[List[int], float]:
        """
        Execute 2-Opt local search with Simulated Annealing to escape local minima and untangle route overlaps.
        """
        current_tour = list(initial_tour)
        current_dist = self.calculate_tour_length(current_tour, dist_matrix, return_to_depot)
        best_tour = list(current_tour)
        best_dist = current_dist

        temp = initial_temp
        n = len(current_tour)
        if n <= 3:
            return current_tour, current_dist

        np.random.seed(42)

        for _ in range(max_iterations):
            if temp <= min_temp:
                break

            # Pick 2 random cut points (keep depot index 0 fixed at start)
            i = np.random.randint(1, n - 1)
            j = np.random.randint(i + 1, n)

            # Create 2-opt reversed tour candidate: reverse segment from i to j
            candidate_tour = current_tour[:i] + current_tour[i:j+1][::-1] + current_tour[j+1:]
            candidate_dist = self.calculate_tour_length(candidate_tour, dist_matrix, return_to_depot)

            delta = candidate_dist - current_dist

            # Accept if better, or probabilistically accept if worse (Metropolis criterion)
            if delta < 0 or (delta > 0 and np.random.rand() < math.exp(-delta / max(1e-5, temp))):
                current_tour = candidate_tour
                current_dist = candidate_dist

                if current_dist < best_dist:
                    best_tour = list(current_tour)
                    best_dist = current_dist

            temp *= cooling_rate

        return best_tour, best_dist

    def dynamic_insert_stop(
        self,
        current_route: List[Dict[str, Any]],
        new_stop: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Perform O(N) Dynamic Insertion: Insert a new pickup point into an active route at the position
        that minimizes incremental detour distance, without re-solving the entire graph.
        """
        if not current_route:
            return {
                "inserted_index": 0,
                "detour_km": 0.0,
                "updated_route": [new_stop],
            }

        new_lat = float(new_stop["latitude"])
        new_lng = float(new_stop["longitude"])

        best_index = 1
        min_detour = float("inf")

        for i in range(len(current_route) - 1):
            p1 = (float(current_route[i]["latitude"]), float(current_route[i]["longitude"]))
            p2 = (float(current_route[i + 1]["latitude"]), float(current_route[i + 1]["longitude"]))

            original_edge = self.haversine_km(p1[0], p1[1], p2[0], p2[1])
            new_edges = (
                self.haversine_km(p1[0], p1[1], new_lat, new_lng) +
                self.haversine_km(new_lat, new_lng, p2[0], p2[1])
            )
            detour = new_edges - original_edge

            if detour < min_detour:
                min_detour = detour
                best_index = i + 1

        # Fallback to appending at end if route has 1 item
        if min_detour == float("inf"):
            p_last = (float(current_route[-1]["latitude"]), float(current_route[-1]["longitude"]))
            min_detour = self.haversine_km(p_last[0], p_last[1], new_lat, new_lng)
            best_index = len(current_route)

        updated_route = list(current_route)
        updated_route.insert(best_index, new_stop)

        return {
            "status": "success",
            "inserted_index": best_index,
            "detour_km": round(float(min_detour), 2),
            "estimated_extra_minutes": round((min_detour / self.avg_speed_kmh) * 60.0 + self.stop_service_time_mins, 1),
            "updated_route_length": len(updated_route),
            "new_stop_id": new_stop.get("id", "urgent_stop"),
        }

    def optimize_route(
        self,
        depot: Dict[str, Any],
        stops: List[Dict[str, Any]],
        return_to_depot: bool = False,
    ) -> Dict[str, Any]:
        """
        Full end-to-end 2-Opt route optimization for a vehicle dispatch.

        :param depot: Dict with 'latitude', 'longitude', 'name' (Start position)
        :param stops: List of collection point dicts with 'id', 'latitude', 'longitude', 'address', optional 'priority'
        :param return_to_depot: Whether the vehicle returns to depot at end of shift
        :return: Turn-by-turn itinerary with distance savings analytics
        """
        if not stops:
            return {
                "status": "empty",
                "summary": {"total_stops": 0, "optimized_distance_km": 0.0, "saved_km": 0.0},
                "turn_by_turn": [],
            }

        # Index 0 is Depot; Indices 1..N are stops
        all_nodes = [depot] + stops
        coords = [(float(n["latitude"]), float(n["longitude"])) for n in all_nodes]
        n_total = len(coords)

        dist_matrix = self.build_distance_matrix(coords)

        # 1. Compute Naive sequential distance (as reported/unoptimized order)
        naive_tour = list(range(n_total))
        naive_dist = self.calculate_tour_length(naive_tour, dist_matrix, return_to_depot)

        # 2. Compute Nearest-Neighbor baseline tour
        nn_tour = self.nearest_neighbor_tour(dist_matrix, start_idx=0)
        nn_dist = self.calculate_tour_length(nn_tour, dist_matrix, return_to_depot)

        # 3. 2-Opt with Simulated Annealing Optimization
        best_tour, opt_dist = self.two_opt_with_simulated_annealing(
            dist_matrix=dist_matrix,
            initial_tour=nn_tour,
            return_to_depot=return_to_depot,
        )

        saved_km = max(0.0, naive_dist - opt_dist)
        savings_pct = round((saved_km / max(0.1, naive_dist)) * 100.0, 1)

        # 4. Generate Turn-by-Turn Sequence with ETAs
        turn_by_turn = []
        cumulative_dist = 0.0
        cumulative_mins = 0.0

        for seq_idx, node_idx in enumerate(best_tour):
            node = all_nodes[node_idx]
            leg_dist = 0.0
            if seq_idx > 0:
                prev_node_idx = best_tour[seq_idx - 1]
                leg_dist = dist_matrix[prev_node_idx, node_idx]
                drive_mins = (leg_dist / self.avg_speed_kmh) * 60.0
                cumulative_dist += leg_dist
                cumulative_mins += drive_mins

            turn_by_turn.append({
                "sequence_number": seq_idx + 1,
                "is_depot": (node_idx == 0),
                "id": node.get("id", f"node_{node_idx}"),
                "name": node.get("name", node.get("address", f"Stop #{seq_idx}")),
                "latitude": round(coords[node_idx][0], 6),
                "longitude": round(coords[node_idx][1], 6),
                "leg_distance_km": round(leg_dist, 2),
                "cumulative_distance_km": round(cumulative_dist, 2),
                "estimated_arrival_minutes": round(cumulative_mins, 1),
                "priority": node.get("priority", "NORMAL"),
            })

            # Add service time at each stop (except initial depot launch)
            if node_idx != 0:
                cumulative_mins += self.stop_service_time_mins

        return {
            "status": "success",
            "summary": {
                "total_collection_stops": len(stops),
                "total_waypoints": len(best_tour),
                "optimized_distance_km": round(opt_dist, 2),
                "naive_distance_km": round(naive_dist, 2),
                "saved_km": round(saved_km, 2),
                "savings_percentage": savings_pct,
                "estimated_total_time_minutes": round(cumulative_mins, 1),
                "estimated_fuel_saved_liters": round(saved_km * 0.28, 2),  # ~3.5 km/L average municipal truck
                "co2_reduction_kg": round(saved_km * 0.75, 2),
            },
            "turn_by_turn": turn_by_turn,
        }
