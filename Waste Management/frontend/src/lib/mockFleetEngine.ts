/**
 * Safaai Sarathi 2.0 - Real Road-Snapped Mock Fleet Telemetry Engine
 * ==================================================================
 * Simulates 6-8 active municipal waste collection drivers moving along
 * actual road coordinates in Gandhinagar municipal sectors.
 *
 * PRODUCTION NOTE:
 * To swap this mock engine for real hardware GPS trackers, replace the
 * internal setInterval simulation loop with a WebSocket connection to:
 * `wss://api.safaaisarathi.gov.in/ws/trucks` or listen to `SOCKET_EVENTS.TRUCK_UPDATE`.
 */

import { getRoadSnappedRoute, RoadRoute } from './routing';

export type DriverStatus = 'en_route' | 'idle' | 'at_destination' | 'delayed';

export interface SimulatedDriver {
  id: string;
  name: string;
  phone: string;
  vehicleNumber: string;
  model: string;
  wardName: string;
  wardCode: string;
  status: DriverStatus;
  currentLat: number;
  currentLng: number;
  heading: number;
  speedKmh: number;
  fuelPct: number;
  destination: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    category: string;
    urgency: 'NORMAL' | 'HIGH' | 'EMERGENCY';
  };
  route: RoadRoute | null;
  routeProgressIndex: number;
  etaMinutes: number;
  remainingDistanceKm: number;
  isOffRoute: boolean;
  lastUpdated: string;
}

// Initial realistic locations across Gandhinagar Sectors
const INITIAL_DRIVERS_SEED = [
  {
    id: 'drv-01',
    name: 'Ramesh Patel',
    phone: '+91 98251 44321',
    vehicleNumber: 'GJ-18-GB-4012',
    model: 'Tata Ace Gold 2T',
    wardName: 'Sector 6 Municipal Ward',
    wardCode: 'W-06',
    status: 'en_route' as DriverStatus,
    start: [23.2156, 72.6369] as [number, number], // Sector 6 Depot
    destination: {
      name: 'Sector 6 Vegetable Market',
      address: 'Near GH-6 Circle, Sector 6',
      latitude: 23.2275,
      longitude: 72.6455,
      category: 'Garbage Pile',
      urgency: 'HIGH' as const,
    },
    speedKmh: 28,
    fuelPct: 78,
  },
  {
    id: 'drv-02',
    name: 'Suresh Vaghela',
    phone: '+91 94280 11984',
    vehicleNumber: 'GJ-18-GB-5108',
    model: 'Ashok Leyland Dost 2.5T',
    wardName: 'Sector 1-7 Ward',
    wardCode: 'W-01',
    status: 'en_route' as DriverStatus,
    start: [23.2080, 72.6280] as [number, number], // Sector 3
    destination: {
      name: 'Civil Hospital Waste Gate',
      address: 'Gate 4, Sector 12',
      latitude: 23.2310,
      longitude: 72.6520,
      category: 'Medical Waste',
      urgency: 'EMERGENCY' as const,
    },
    speedKmh: 34,
    fuelPct: 62,
  },
  {
    id: 'drv-03',
    name: 'Vikram Thakor',
    phone: '+91 97123 88472',
    vehicleNumber: 'GJ-18-GB-3341',
    model: 'Mahindra Bolero Maxi Truck',
    wardName: 'Sector 21 Commercial Zone',
    wardCode: 'W-21',
    status: 'en_route' as DriverStatus,
    start: [23.2380, 72.6410] as [number, number], // Sector 21
    destination: {
      name: 'Sector 21 Shopping Hub',
      address: 'Behind District Court, Sector 21',
      latitude: 23.2450,
      longitude: 72.6580,
      category: 'Overflowing Bin',
      urgency: 'NORMAL' as const,
    },
    speedKmh: 22,
    fuelPct: 85,
  },
  {
    id: 'drv-04',
    name: 'Dilip Makwana',
    phone: '+91 99044 56219',
    vehicleNumber: 'GJ-18-GB-8921',
    model: 'Tata Ace Tipper 1.5T',
    wardName: 'InfoCity Tech Corridor',
    wardCode: 'W-IC',
    status: 'delayed' as DriverStatus,
    start: [23.1890, 72.6250] as [number, number], // DA-IICT area
    destination: {
      name: 'InfoCity Food Court Bin 3',
      address: 'Main Plaza, InfoCity, Gandhinagar',
      latitude: 23.1945,
      longitude: 72.6325,
      category: 'Illegal Dump',
      urgency: 'HIGH' as const,
    },
    speedKmh: 0,
    fuelPct: 41,
  },
  {
    id: 'drv-05',
    name: 'Mahesh Solanki',
    phone: '+91 98982 34105',
    vehicleNumber: 'GJ-18-GB-1290',
    model: 'Eicher Pro Compactor 6T',
    wardName: 'Sector 14-20 Ward',
    wardCode: 'W-14',
    status: 'idle' as DriverStatus,
    start: [23.2210, 72.6560] as [number, number], // Sector 16
    destination: {
      name: 'Central Sector Solid Waste Yard',
      address: 'CH-Road Processing Center',
      latitude: 23.2395,
      longitude: 72.6680,
      category: 'General Waste',
      urgency: 'NORMAL' as const,
    },
    speedKmh: 0,
    fuelPct: 90,
  },
  {
    id: 'drv-06',
    name: 'Haresh Prajapati',
    phone: '+91 98765 12098',
    vehicleNumber: 'GJ-18-GB-7711',
    model: 'Tata Ace Gold 2T',
    wardName: 'Koba-Kudasan Ward',
    wardCode: 'W-KB',
    status: 'en_route' as DriverStatus,
    start: [23.1750, 72.6180] as [number, number], // Kudasan
    destination: {
      name: 'Bhaijipura Cross Road Dump Point',
      address: 'Near NH-8C Bypass, Kudasan',
      latitude: 23.1880,
      longitude: 72.6310,
      category: 'Garbage Pile',
      urgency: 'NORMAL' as const,
    },
    speedKmh: 31,
    fuelPct: 53,
  },
];

class MockFleetEngine {
  private drivers: Map<string, SimulatedDriver> = new Map();
  private listeners: Set<(drivers: SimulatedDriver[]) => void> = new Set();
  private intervalId: any = null;
  private isInitialized = false;

  constructor() {
    this.initFleet();
  }

  private async initFleet() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    for (const seed of INITIAL_DRIVERS_SEED) {
      const destCoord: [number, number] = [seed.destination.latitude, seed.destination.longitude];
      const roadRoute = await getRoadSnappedRoute(seed.start, destCoord);

      const driver: SimulatedDriver = {
        id: seed.id,
        name: seed.name,
        phone: seed.phone,
        vehicleNumber: seed.vehicleNumber,
        model: seed.model,
        wardName: seed.wardName,
        wardCode: seed.wardCode,
        status: seed.status,
        currentLat: seed.start[0],
        currentLng: seed.start[1],
        heading: 45,
        speedKmh: seed.speedKmh,
        fuelPct: seed.fuelPct,
        destination: seed.destination,
        route: roadRoute,
        routeProgressIndex: 0,
        etaMinutes: roadRoute.durationMinutes,
        remainingDistanceKm: roadRoute.distanceKm,
        isOffRoute: seed.status === 'delayed',
        lastUpdated: new Date().toISOString(),
      };

      this.drivers.set(driver.id, driver);
    }

    this.notifyListeners();
    this.startSimulationLoop();
  }

  private startSimulationLoop() {
    if (this.intervalId) return;

    // Advance driver position along the real road route every 2.5 seconds
    this.intervalId = setInterval(() => {
      this.stepSimulation();
    }, 2500);
  }

  private stepSimulation() {
    let hasChanges = false;

    this.drivers.forEach((driver) => {
      if (driver.status !== 'en_route' || !driver.route || driver.route.coordinates.length === 0) {
        return;
      }

      const totalCoords = driver.route.coordinates.length;
      const nextIdx = driver.routeProgressIndex + 1;

      if (nextIdx < totalCoords) {
        const prevCoord = driver.route.coordinates[driver.routeProgressIndex];
        const nextCoord = driver.route.coordinates[nextIdx];

        // Compute heading angle
        const dLng = nextCoord[1] - prevCoord[1];
        const dLat = nextCoord[0] - prevCoord[0];
        const heading = (Math.atan2(dLng, dLat) * 180) / Math.PI;

        driver.currentLat = nextCoord[0];
        driver.currentLng = nextCoord[1];
        driver.heading = Math.round(heading >= 0 ? heading : heading + 360);
        driver.routeProgressIndex = nextIdx;

        // Decrease remaining distance & ETA proportionally
        const fractionRemaining = (totalCoords - nextIdx) / totalCoords;
        driver.remainingDistanceKm = Number((driver.route.distanceKm * fractionRemaining).toFixed(2));
        driver.etaMinutes = Math.max(1, Math.round(driver.route.durationMinutes * fractionRemaining));
        driver.lastUpdated = new Date().toISOString();
        hasChanges = true;
      } else {
        // Reached destination!
        driver.status = 'at_destination';
        driver.remainingDistanceKm = 0;
        driver.etaMinutes = 0;
        driver.speedKmh = 0;
        driver.lastUpdated = new Date().toISOString();
        hasChanges = true;
      }
    });

    if (hasChanges) {
      this.notifyListeners();
    }
  }

  public subscribe(callback: (drivers: SimulatedDriver[]) => void): () => void {
    this.listeners.add(callback);
    callback(Array.from(this.drivers.values()));
    return () => {
      this.listeners.delete(callback);
    };
  }

  public getDrivers(): SimulatedDriver[] {
    return Array.from(this.drivers.values());
  }

  public getDriverById(id: string): SimulatedDriver | undefined {
    return this.drivers.get(id);
  }

  private notifyListeners() {
    const list = Array.from(this.drivers.values());
    this.listeners.forEach((cb) => cb(list));
  }
}

// Global Singleton Instance
export const mockFleetEngine = new MockFleetEngine();
