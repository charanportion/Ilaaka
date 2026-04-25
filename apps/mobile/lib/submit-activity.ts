import { supabase } from '@/lib/supabase';
import { readBufferedTrace, getEndedAt } from '@/db/trace-buffer';
import { estimateCalories } from '@/lib/calories';
import type { ActivityType, SubmitActivityRequest, SubmitActivityResponse } from '@/types/api';

export async function submitActivity(
  localId: string,
  type: ActivityType,
  startedAt: Date,
): Promise<SubmitActivityResponse> {
  const points = readBufferedTrace(localId);
  if (points.length < 2) throw new Error('too_few_points');

  const endedAtMs = getEndedAt(localId) ?? Date.now();

  const durationS = (endedAtMs - startedAt.getTime()) / 1000;
  const calories = estimateCalories(type, durationS);

  const body: SubmitActivityRequest = {
    type,
    started_at: startedAt.toISOString(),
    ended_at:   new Date(endedAtMs).toISOString(),
    trace: {
      type: 'LineString',
      coordinates: points.map(p => [p.lng, p.lat]),
    },
    samples: {
      timestamps: points.map(p => p.ts),
      accuracy_m: points.map(p => p.accuracy),
    },
    client_calories: calories,
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
