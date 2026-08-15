/**
 * Gandhinagar ward geometry for the demo.
 *
 * Real ward boundaries would be uploaded as GeoJSON through the admin's ward
 * editor. For the demo we generate eight contiguous ward polygons across the
 * city so the heatmap, point-in-ward attribution and "nearest truck" queries
 * all operate on plausible geography.
 */

export const CITY = {
  name: 'Gandhinagar',
  state: 'Gujarat',
  corporation: 'Gandhinagar Municipal Corporation',
  center: { latitude: 23.2156, longitude: 72.6369 },
};

/**
 * 4 columns x 2 rows of wards. Gandhinagar is a compact planned city, so the
 * cells are smaller than a metro's — roughly 2 x 2 km each.
 */
const COLS = 4;
const ROWS = 2;
const CELL_LNG = 0.02;
const CELL_LAT = 0.018;

/** Sector blocks and the surrounding villages that GMC actually covers. */
export const WARDS = [
  { name: 'Sector 1–7', code: 'W-01', zone: 'North Zone', population: 41000 },
  { name: 'Sector 8–13', code: 'W-02', zone: 'North Zone', population: 38000 },
  { name: 'Sector 16–21', code: 'W-03', zone: 'Central Zone', population: 44000 },
  { name: 'Sector 22–30', code: 'W-04', zone: 'Central Zone', population: 36000 },
  { name: 'Sargasan', code: 'W-05', zone: 'South Zone', population: 29000 },
  { name: 'Kudasan', code: 'W-06', zone: 'South Zone', population: 33000 },
  { name: 'Vavol', code: 'W-07', zone: 'West Zone', population: 26000 },
  { name: 'Pethapur', code: 'W-08', zone: 'East Zone', population: 24000 },
];

/** Slight per-ward jitter so the grid does not read as graph paper. */
function jitter(index, scale) {
  const x = Math.sin(index * 12.9898) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * scale;
}

export function wardGeometry(index) {
  const col = index % COLS;
  const row = Math.floor(index / COLS);

  const originLng = CITY.center.longitude - (COLS / 2) * CELL_LNG;
  const originLat = CITY.center.latitude - (ROWS / 2) * CELL_LAT;

  const west = originLng + col * CELL_LNG + jitter(index, 0.0016);
  const east = west + CELL_LNG;
  const south = originLat + row * CELL_LAT + jitter(index + 100, 0.0016);
  const north = south + CELL_LAT;

  // Wobble the corners so boundaries look surveyed rather than drawn.
  const w = (n) => jitter(index * 7 + n, 0.0014);
  const ring = [
    [west + w(1), south + w(2)],
    [west + CELL_LNG * 0.5, south + w(3)],
    [east + w(4), south + w(5)],
    [east + w(6), south + CELL_LAT * 0.5],
    [east + w(7), north + w(8)],
    [west + CELL_LNG * 0.5, north + w(9)],
    [west + w(10), north + w(11)],
    [west + w(12), south + CELL_LAT * 0.5],
  ];
  ring.push(ring[0]);

  return {
    boundary: { type: 'Polygon', coordinates: [ring.map(([lng, lat]) => [round6(lng), round6(lat)])] },
    center: { longitude: round6((west + east) / 2), latitude: round6((south + north) / 2) },
  };
}

/** A deterministic point inside a ward — used to place complaints and depots. */
export function pointInWard(index, n) {
  const { center } = wardGeometry(index);
  return {
    latitude: round6(center.latitude + jitter(index * 31 + n, CELL_LAT * 0.7)),
    longitude: round6(center.longitude + jitter(index * 17 + n * 3, CELL_LNG * 0.7)),
  };
}

const round6 = (n) => Number(n.toFixed(6));

/** Gandhinagar's roads are lettered (Ch, Gh, K) alongside the sector roads. */
export const STREETS = [
  'Ch Road',
  'Gh Road',
  'K Road',
  'Sector Road',
  'Infocity Road',
  'Kudasan Cross Road',
  'Sargasan Circle',
  'Mahatma Mandir Road',
  'Adalaj Road',
  'Pethapur Main Road',
  'Indira Bridge Road',
  'Vavol Road',
];

export default { CITY, WARDS, wardGeometry, pointInWard, STREETS };
