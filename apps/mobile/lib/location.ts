/**
 * Thin facade over the recording controller. Kept as the public seam that
 * record.tsx / activity-store reach for, so the controller's exact shape can
 * change without touching every caller.
 */
import * as controller from '@/lib/recording-controller';
import type { ActivityType } from '@/types/api';
import type { StartResult } from '@/lib/recording-controller';

export type { StartResult };

export function startTracking(
  type: ActivityType,
  opts: { localId: string; startedAtMs: number },
): Promise<StartResult> {
  return controller.start(type, opts);
}

export function stopTracking(localId: string): Promise<void> {
  return controller.stop(localId, { showSavedFollowup: false });
}

export function pauseTracking(localId: string): Promise<void> {
  return controller.pause(localId);
}

export function resumeTracking(localId: string): Promise<void> {
  return controller.resume(localId);
}

export function continueTracking(localId: string): Promise<StartResult> {
  return controller.continueExisting(localId);
}

export function reconcileTrackingOnLaunch(): Promise<{ active: boolean; localId: string | null }> {
  return controller.reconcileOnLaunch();
}
