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
    // supabase-js wraps non-2xx responses in FunctionsHttpError whose .message is
    // the generic "Edge Function returned a non-2xx status code". The actual
    // reason ({ error: 'too_short_distance' }, etc.) is on error.context (a Response).
    const reason = await readErrorReason(error);
    throw new Error(reason);
  }

  return data;
}

async function readErrorReason(error: unknown): Promise<string> {
  if (!error) return 'submit_failed';
  // FunctionsHttpError exposes the raw Response on .context
  const ctx = (error as { context?: unknown }).context;
  if (ctx && typeof (ctx as Response).json === 'function') {
    try {
      const body = await (ctx as Response).clone().json() as { error?: string };
      if (body?.error && typeof body.error === 'string') return body.error;
    } catch {
      // body wasn't JSON — fall through
    }
  }
  const msg = (error as { message?: string }).message;
  return msg && msg.length > 0 ? msg : 'submit_failed';
}
