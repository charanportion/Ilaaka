import type { ActivityType } from '@/types/api';

const MET: Record<ActivityType, number> = {
  run: 9.8,
  walk: 3.5,
  cycle: 8.0,
  hike: 6.0,
};

const DEFAULT_WEIGHT_KG = 70;

export function estimateCalories(type: ActivityType, durationS: number, weightKg = DEFAULT_WEIGHT_KG): number {
  const hours = durationS / 3600;
  return Math.round(MET[type] * weightKg * hours);
}
