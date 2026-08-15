/** Shared domain vocabulary — one source of truth for API, AI service and web. */

export const ROLES = {
  CITIZEN: 'CITIZEN',
  DRIVER: 'DRIVER',
  OFFICER: 'OFFICER',
  ADMIN: 'ADMIN',
};

/**
 * Portal namespaces. A token minted for one portal cannot be used on another
 * (plan §3): the `aud` claim is checked against the namespace on every request.
 */
export const PORTALS = {
  CITIZEN: 'citizen',
  DRIVER: 'driver',
  OFFICER: 'officer',
  ADMIN: 'admin',
};

export const ROLE_PORTAL = {
  [ROLES.CITIZEN]: PORTALS.CITIZEN,
  [ROLES.DRIVER]: PORTALS.DRIVER,
  [ROLES.OFFICER]: PORTALS.OFFICER,
  [ROLES.ADMIN]: PORTALS.ADMIN,
};

export const WASTE_CATEGORIES = [
  { id: 'GARBAGE_PILE', label: 'Garbage pile', emergency: false, severity: 'MEDIUM', slaMinutes: 1440 },
  { id: 'OVERFLOWING_BIN', label: 'Overflowing bin', emergency: false, severity: 'MEDIUM', slaMinutes: 720 },
  { id: 'DEAD_ANIMAL', label: 'Dead animal', emergency: true, severity: 'CRITICAL', slaMinutes: 120 },
  { id: 'CONSTRUCTION_DEBRIS', label: 'Construction debris', emergency: false, severity: 'LOW', slaMinutes: 2880 },
  { id: 'MEDICAL_WASTE', label: 'Medical waste', emergency: true, severity: 'CRITICAL', slaMinutes: 120 },
  { id: 'ILLEGAL_DUMPING', label: 'Illegal dumping', emergency: false, severity: 'HIGH', slaMinutes: 720 },
  { id: 'SEWAGE_OVERFLOW', label: 'Sewage overflow', emergency: true, severity: 'HIGH', slaMinutes: 240 },
  { id: 'BURNING_WASTE', label: 'Burning waste', emergency: true, severity: 'HIGH', slaMinutes: 120 },
  { id: 'OTHER', label: 'Other', emergency: false, severity: 'LOW', slaMinutes: 2880 },
];

export const CATEGORY_MAP = Object.fromEntries(WASTE_CATEGORIES.map((c) => [c.id, c]));

/** The red-button options on the citizen Emergency Report screen (plan §2.1). */
export const EMERGENCY_TYPES = ['DEAD_ANIMAL', 'MEDICAL_WASTE', 'BURNING_WASTE', 'SEWAGE_OVERFLOW'];

export const COMPLAINT_FLOW = ['PENDING', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED'];

export const SOCKET_EVENTS = {
  TRUCK_UPDATE: 'truck:update',
  DRIVER_LOCATION: 'driver:location',
  COMPLAINT_NEW: 'complaint:new',
  COMPLAINT_UPDATE: 'complaint:update',
  EMERGENCY_NEW: 'emergency:new',
  ESCALATION_NEW: 'escalation:new',
  ASSIGNMENT_NEW: 'assignment:new',
  SOS_NEW: 'sos:new',
  NOTIFICATION: 'notification:new',
  STATS_UPDATE: 'stats:update',
};

/** Green credits — awarded from verified evidence, never granted by the UI. */
export const CREDIT_RULES = {
  version: 'credits-v1',
  reportSubmitted: 5,
  reportVerified: 15,
  reportResolved: 10,
  emergencyVerified: 25,
  duplicateReport: 2,
  fakeReport: -20,
};

export default {
  ROLES,
  PORTALS,
  ROLE_PORTAL,
  WASTE_CATEGORIES,
  CATEGORY_MAP,
  EMERGENCY_TYPES,
  COMPLAINT_FLOW,
  SOCKET_EVENTS,
  CREDIT_RULES,
};
