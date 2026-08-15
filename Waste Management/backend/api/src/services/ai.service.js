import axios from 'axios';
import crypto from 'node:crypto';
import env from '../config/env.js';
import { CATEGORY_MAP, WASTE_CATEGORIES } from '../config/constants.js';

/**
 * Client for the self-hosted AI service (plan §7).
 *
 * Express owns persistence, routing and realtime; the models live behind an
 * HTTP boundary so they can be scaled, swapped or moved to a GPU box without
 * touching this codebase. If the service is unreachable, we fall back to a
 * local deterministic classifier and say so — `degraded: true` is surfaced in
 * the API response and rendered in the UI rather than hidden.
 */

const client = axios.create({ baseURL: env.aiServiceUrl, timeout: 15000 });

export async function classifyWaste({ buffer, mimetype = 'image/jpeg', filename = 'photo.jpg', hint }) {
  const started = Date.now();
  try {
    const form = new FormData();
    form.append('image', new Blob([buffer], { type: mimetype }), filename);
    if (hint) form.append('hint', hint);

    const { data } = await client.post('/vision/classify', form);
    return { ...data, latencyMs: data.latencyMs ?? Date.now() - started, degraded: false };
  } catch (err) {
    return {
      ...localClassify(buffer, hint),
      latencyMs: Date.now() - started,
      degraded: true,
      degradedReason: `AI service unreachable at ${env.aiServiceUrl} (${err.code || err.message}) — local fallback used`,
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
    const { data } = await client.get('/health', { timeout: 2500 });
    return { reachable: true, url: env.aiServiceUrl, ...data };
  } catch (err) {
    return { reachable: false, url: env.aiServiceUrl, error: err.code || err.message };
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
 * Logistic-style fraud score over real signals. Weights are hand-set rather
 * than trained — the trained scikit-learn model replaces this behind the same
 * interface, and `modelVersion` says which one produced a score.
 */
export function localFraudScore(f = {}) {
  const signals = [];
  let score = 0;

  if (f.accountAgeHours != null && f.accountAgeHours < 1) {
    score += 0.25;
    signals.push('account_created_minutes_ago');
  }
  if (f.reportsLastHour > 5) {
    score += 0.3;
    signals.push('burst_reporting');
  }
  if (f.priorRejectedRate > 0.4) {
    score += 0.25;
    signals.push('history_of_rejected_reports');
  }
  if (f.hasExif === false) {
    score += 0.1;
    signals.push('no_exif_metadata');
  }
  if (f.blurScore != null && f.blurScore < 0.35) {
    score += 0.15;
    signals.push('low_detail_image');
  }
  if (f.duplicateOfOwnReport) {
    score += 0.2;
    signals.push('duplicate_of_own_recent_report');
  }
  if (f.distanceFromUserMeters > 20000) {
    score += 0.1;
    signals.push('far_from_usual_area');
  }

  return {
    modelVersion: 'fraud-heuristic-v1',
    score: Number(Math.min(1, score).toFixed(3)),
    signals,
  };
}

export default { classifyWaste, scoreFraud, predictHotspots, aiHealth, localClassify, localFraudScore };
