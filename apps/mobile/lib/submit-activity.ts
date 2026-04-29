import { supabase } from '@/lib/supabase';
import { readBufferedTrace, getEndedAt, getOrCreateIdempotencyKey } from '@/db/trace-buffer';
import { estimateCalories } from '@/lib/calories';
import { filterOutliers } from '@/lib/smooth';
import { elevationGain } from '@/lib/distance';
import type {
  ActivityMetadata,
  ActivityType,
  SubmitActivityRequest,
  SubmitActivityResponse,
} from '@/types/api';

export async function submitActivity(
  localId: string,
  type: ActivityType,
  startedAt: Date,
  metadata?: ActivityMetadata,
): Promise<SubmitActivityResponse> {
  const raw = readBufferedTrace(localId);
  if (raw.length < 2) throw new Error('too_few_points');

  // Drop low-accuracy fixes and physically-impossible jumps before submitting.
  // Buffer rows stay raw — only the outbound request is filtered.
  const points = filterOutliers(raw, type);

  const endedAtMs = getEndedAt(localId) ?? Date.now();

  const durationS = (endedAtMs - startedAt.getTime()) / 1000;
  const calories = estimateCalories(type, durationS);
  const elevation = elevationGain(points);

  // Stable per pending activity so retries (network drop) hit the server's
  // idempotency short-circuit instead of inserting a duplicate.
  const idempotencyKey = getOrCreateIdempotencyKey(localId);

  const body: SubmitActivityRequest = {
    type,
    started_at: startedAt.toISOString(),
    ended_at:   new Date(endedAtMs).toISOString(),
    idempotency_key: idempotencyKey,
    trace: {
      type: 'LineString',
      coordinates: points.map(p => [p.lng, p.lat]),
    },
    samples: {
      timestamps: points.map(p => p.ts),
      accuracy_m: points.map(p => p.accuracy),
    },
    client_calories: calories,
    elevation_gain_m: elevation,
    ...(metadata ?? {}),
  };

  const { data, error } = await supabase.functions.invoke<SubmitActivityResponse>(
    'submit-activity',
    { body },
  );

  if (error || !data) {
    // error.message may contain the server's reason string (too_short, gps_quality, etc.)
    throw new Error(error?.message ?? 'submit_failed');
  }

  return data;
}
