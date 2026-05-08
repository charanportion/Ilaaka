import { supabase } from '@/lib/supabase';
import type {
  WeekMetrics,
  WeeklyBucket,
  StreakStats,
  ActivityDay,
  UserGoals,
} from '@/types/api';

export async function fetchCurrentWeekMetrics(userId: string): Promise<WeekMetrics> {
  const { data, error } = await supabase.rpc('current_week_metrics', { p_user_id: userId });
  if (error) throw error;
  const row = (data as WeekMetrics[] | null)?.[0];
  return row ?? { distance_m: 0, duration_s: 0, elevation_gain_m: 0, activity_count: 0 };
}

export async function fetchWeeklyHistory(userId: string, weeks = 12): Promise<WeeklyBucket[]> {
  const { data, error } = await supabase.rpc('weekly_history', {
    p_user_id: userId,
    p_weeks: weeks,
  });
  if (error) throw error;
  return (data ?? []) as WeeklyBucket[];
}

export async function fetchStreakStats(userId: string): Promise<StreakStats> {
  const { data, error } = await supabase.rpc('streak_stats', { p_user_id: userId });
  if (error) throw error;
  const row = (data as StreakStats[] | null)?.[0];
  return row ?? { current_streak: 0, max_streak: 0, last_activity_date: null };
}

export async function fetchActivityDays(userId: string, monthStart: Date): Promise<ActivityDay[]> {
  const iso = isoDate(monthStart);
  const { data, error } = await supabase.rpc('activity_days', {
    p_user_id: userId,
    p_month_start: iso,
  });
  if (error) throw error;
  return (data ?? []) as ActivityDay[];
}

const DEFAULT_GOALS: UserGoals = { weekly_distance_m: 10_000, weekly_area_m2: 50_000 };

export async function fetchUserGoals(userId: string): Promise<UserGoals> {
  const { data, error } = await supabase
    .from('user_goals')
    .select('weekly_distance_m, weekly_area_m2')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as UserGoals | null) ?? DEFAULT_GOALS;
}

export async function upsertUserGoals(userId: string, goals: UserGoals): Promise<void> {
  const { error } = await supabase
    .from('user_goals')
    .upsert(
      {
        user_id: userId,
        weekly_distance_m: goals.weekly_distance_m,
        weekly_area_m2: goals.weekly_area_m2,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
  if (error) throw error;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
