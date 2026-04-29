import { haversineMeters } from '@/lib/distance';
import type { ActivityType } from '@/types/api';

export type RawPoint = { lng: number; lat: number; ts: number; accuracy: number; altitude?: number | null };

const ACCURACY_REJECT_M = 35;
const REFERENCE_ACCURACY_M = 10;
const BASE_ALPHA = 0.35;
const MIN_ALPHA = 0.05;
const MAX_ALPHA = 0.6;

const MAX_SPEED_MPS: Record<ActivityType, number> = {
  walk:  6,
  hike:  6,
  run:   8,
  cycle: 18,
};

// Drop fixes that are obviously wrong: low-accuracy GPS, or an instantaneous
// jump implying a speed beyond what the activity type allows.
export function filterOutliers(points: readonly RawPoint[], type: ActivityType): RawPoint[] {
  const cap = MAX_SPEED_MPS[type] ?? MAX_SPEED_MPS.walk;
  const out: RawPoint[] = [];
  for (const p of points) {
    if (!Number.isFinite(p.lng) || !Number.isFinite(p.lat)) continue;
    if (p.accuracy > ACCURACY_REJECT_M) continue;
    const prev = out[out.length - 1];
    if (prev) {
      const dt = (p.ts - prev.ts) / 1000;
      if (dt > 0) {
        const speed = haversineMeters(prev.lng, prev.lat, p.lng, p.lat) / dt;
        if (speed > cap) continue;
      }
    }
    out.push(p);
  }
  return out;
}

// Accuracy-weighted EMA over lng/lat. High-accuracy fix → trust new sample;
// low-accuracy → cling to the prior. Returns [lng, lat][] for direct GeoJSON use.
export function smoothTrace(points: readonly RawPoint[]): [number, number][] {
  const out: [number, number][] = [];
  let lng = 0;
  let lat = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (i === 0) {
      lng = p.lng;
      lat = p.lat;
    } else {
      const acc = Math.max(p.accuracy, REFERENCE_ACCURACY_M);
      const raw = BASE_ALPHA * (REFERENCE_ACCURACY_M / acc);
      const alpha = Math.max(MIN_ALPHA, Math.min(MAX_ALPHA, raw));
      lng = lng + alpha * (p.lng - lng);
      lat = lat + alpha * (p.lat - lat);
    }
    out.push([lng, lat]);
  }
  return out;
}
