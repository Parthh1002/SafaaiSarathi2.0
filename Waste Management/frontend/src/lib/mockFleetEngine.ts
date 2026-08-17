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
import { realGpsTracker } from './realGpsTracker';

export type DriverStatus = 'en_route' | 'idle' | 'at_destination' | 'delayed';

export interface SimulatedDriver {
  id: string;
  name: string;
  email?: string;
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
  isRealGps?: boolean;
  destination: {
    name: string;
    address: string;
    lat: number;
    lng: number;
    latitude?: number;
    longitude?: number;
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

// Exactly 3 active drivers: 1 Real GPS Live Driver (Parth) + 2 Mock Demo Drivers
const INITIAL_DRIVERS_SEED = [
  {
    id: 'drv-parth-real',
    name: 'Parth Patel (Live GPS)',
    email: 'parthh1002@gmail.com',
    phone: '+91 98251 44321',
    vehicleNumber: 'GJ-18-GB-4012',
    model: 'Tata Ace Gold 2T (Real GPS Transmitter)',
    wardName: 'Sector 6 Municipal Ward',
    wardCode: 'W-06',
    status: 'en_route' as DriverStatus,
    isRealGps: true,
    start: [23.2156, 72.6369] as [number, number],
    destination: {
      name: 'Sector 6 Vegetable Market',
      address: 'Near GH-6 Circle, Sector 6',
      lat: 23.2275,
      lng: 72.6455,
      category: 'Garbage Pile',
      urgency: 'HIGH' as const,
    },
    speedKmh: 0,
    fuelPct: 82,
  },
  {
    id: 'drv-01',
    name: 'Ramesh Patel',
    phone: '+91 94280 11984',
    vehicleNumber: 'GJ-18-GB-5108',
    model: 'Ashok Leyland Dost 2.5T',
    wardName: 'Sector 1-7 Ward',
    wardCode: 'W-01',
    status: 'en_route' as DriverStatus,
    isRealGps: false,
    start: [23.2080, 72.6280] as [number, number],
    destination: {
      name: 'Civil Hospital Waste Gate',
      address: 'Gate 4, Sector 12',
      lat: 23.2310,
      lng: 72.6520,
      category: 'Medical Waste',
      urgency: 'EMERGENCY' as const,
    },
    speedKmh: 32,
    fuelPct: 68,
  },
  {
    id: 'drv-02',
    name: 'Dilip Makwana',
    phone: '+91 99044 56219',
    vehicleNumber: 'GJ-18-GB-8921',
    model: 'Tata Ace Tipper 1.5T',
    wardName: 'InfoCity Tech Corridor',
    wardCode: 'W-IC',
    status: 'delayed' as DriverStatus,
    isRealGps: false,
    start: [23.1890, 72.6250] as [number, number],
    destination: {
      name: 'InfoCity Food Court Bin 3',
      address: 'Main Plaza, InfoCity, Gandhinagar',
      lat: 23.1945,
      lng: 72.6325,
      category: 'Illegal Dump',
      urgency: 'HIGH' as const,
    },
    speedKmh: 0,
    fuelPct: 41,
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
      const destCoord: [number, number] = [seed.destination.lat, seed.destination.lng];
      const roadRoute = await getRoadSnappedRoute(seed.start, destCoord);

      const driver: SimulatedDriver = {
        id: seed.id,
        name: seed.name,
        email: seed.email,
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
        isRealGps: seed.isRealGps,
        destination: {
          ...seed.destination,
          latitude: seed.destination.lat,
          longitude: seed.destination.lng,
        },
        route: roadRoute,
        routeProgressIndex: 0,
        etaMinutes: roadRoute.durationMinutes,
        remainingDistanceKm: roadRoute.distanceKm,
        isOffRoute: seed.status === 'delayed',
        lastUpdated: new Date().toISOString(),
      };

      this.drivers.set(driver.id, driver);
    }

    // Connect Real GPS Tracker for Parth Patel account (drv-parth-real)
    realGpsTracker.startTracking(true);
    realGpsTracker.subscribe((loc, status) => {
      const parthDriver = this.drivers.get('drv-parth-real');
      if (parthDriver && loc) {
        parthDriver.currentLat = loc.latitude;
        parthDriver.currentLng = loc.longitude;
        parthDriver.speedKmh = loc.speed ?? 0;
        parthDriver.heading = loc.heading ?? 0;
        parthDriver.status = (loc.speed && loc.speed > 2) ? 'en_route' : 'idle';
        parthDriver.lastUpdated = new Date().toISOString();
        this.notifyListeners();
      }
    });

    this.notifyListeners();
    this.startSimulationLoop();
  }

  private startSimulationLoop() {
    if (this.intervalId) return;

    // Advance MOCK drivers only (real driver is driven by real GPS hardware)
    this.intervalId = setInterval(() => {
      this.stepSimulation();
    }, 2500);
  }

  private stepSimulation() {
    let hasChanges = false;

    this.drivers.forEach((driver) => {
      // Real driver only moves when physical phone coordinates update
      if (driver.isRealGps) {
        return;
      }
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
