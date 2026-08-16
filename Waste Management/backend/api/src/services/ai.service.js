import axios from 'axios';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { CATEGORY_MAP, WASTE_CATEGORIES } from '../config/constants.js';

const client = axios.create({ baseURL: env.aiServiceUrl, timeout: 15000 });

export async function classifyWaste({ buffer, mimetype = 'image/jpeg', filename = 'photo.jpg', hint }) {
  const started = Date.now();
  try {
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: mimetype }), filename);
    if (hint) form.append('hint', hint);

    const { data } = await client.post('/api/classify-waste', form);
    return { ...data, latencyMs: data.latencyMs ?? Date.now() - started, degraded: false };
  } catch (err) {
    return {
      ...localClassify(buffer, hint),
      latencyMs: Date.now() - started,
      degraded: true,
      degradedReason: `Vision service unreachable at ${env.aiServiceUrl} (${err.code || err.message}) — deterministic fallback engaged`,
    };
  }
}

/** Fraud/troll scoring. Features are computed from data we actually hold. */
export async function scoreFraud(features) {
  try {
    const { data } = await client.post('/fraud/score', features, { timeout: 6000 });
    return { ...data, degraded: false };
  } catch {
    return { ...localFraudScore(features), degraded: true };
  }
}

/** Hotspot forecast for a ward. */
export async function predictHotspots(payload) {
  try {
    const { data } = await client.post('/hotspot/predict', payload, { timeout: 12000 });
    return { ...data, degraded: false };
  } catch (err) {
    return { predictions: [], degraded: true, degradedReason: err.code || err.message };
  }
}

export async function aiHealth() {
  try {
    const { data } = await client.get('/', { timeout: 3500 });
    return {
      reachable: true,
      url: env.aiServiceUrl,
      status: 'healthy',
      activeModel: 'YOLOv8 Custom Waste Classifier (safaai_best.pt)',
      classes: ['overflowing_bin', 'dead_animal', 'medical_waste', 'construction_debris', 'illegal_dumping', 'garbage_pile'],
      ...data,
    };
  } catch (err) {
    try {
      const { data } = await client.get('/health', { timeout: 3500 });
      return {
        reachable: true,
        url: env.aiServiceUrl,
        status: 'healthy',
        activeModel: 'YOLOv8 Custom Waste Classifier (safaai_best.pt)',
        classes: ['overflowing_bin', 'dead_animal', 'medical_waste', 'construction_debris', 'illegal_dumping', 'garbage_pile'],
        ...data,
      };
    } catch {
      return {
        reachable: false,
        url: env.aiServiceUrl,
        error: err.code || err.message,
        fallbackActive: true,
      };
    }
  }
}

/**
 * Local fallback classifier — deterministic on the image bytes, so the same
 * photo always yields the same category. Never claims high confidence.
 */
export function localClassify(buffer, hint) {
  if (hint && CATEGORY_MAP[hint]) {
    return {
      modelVersion: 'fallback-v1',
      category: hint,
      confidence: 0.55,
      alternatives: [],
      detections: [],
    };
  }

  const digest = crypto.createHash('sha256').update(buffer ?? Buffer.from('safaai')).digest();
  const category = WASTE_CATEGORIES[digest[0] % WASTE_CATEGORIES.length].id;
  const confidence = 0.42 + (digest[1] / 255) * 0.22; // deliberately below the auto-approve gate

  return {
    modelVersion: 'fallback-v1',
    category,
    confidence: Number(confidence.toFixed(3)),
    alternatives: [],
    detections: [],
  };
}

/**
 * Logistic-style fraud score over real signals.
 */
export function localFraudScore(f = {}) {
  const signals = [];
  let score = 0.05;

  if (f.samePhotoHashCount > 1) {
    score += 0.45;
    signals.push('exact_duplicate_photo_hash');
  }
  if (f.rapidSubmissionsInWard5m > 3) {
    score += 0.25;
    signals.push('velocity_burst_ward');
  }
  if (f.reportedFarFromUserWard) {
    score += 0.15;
    signals.push('out_of_ward_citizen');
  }
  if (f.exifMissing) {
    score += 0.05;
    signals.push('stripped_exif');
  }

  score = Math.min(0.99, Number(score.toFixed(3)));
  return {
    score,
    flagged: score >= 0.6,
    signals,
    modelVersion: 'rule_heuristic_v1',
  };
}
