import { supabase } from '@/lib/supabase';
import type {
  ActivityType,
  FrequencyKind,
  MotivationKind,
  OwnProfile,
  UserActivity,
  UserPublicProfile,
} from '@/types/api';

export async function fetchUserPublicProfile(
  userId: string,
): Promise<UserPublicProfile | null> {
  const { data, error } = await supabase.rpc('user_public_profile', {
    p_user_id: userId,
  });
  if (error) throw error;
  const rows = (data ?? []) as UserPublicProfile[];
  return rows[0] ?? null;
}

export async function fetchUserRecentActivities(
  userId: string,
  limit = 10,
): Promise<UserActivity[]> {
  const { data, error } = await supabase.rpc('user_recent_activities', {
    p_user_id: userId,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as UserActivity[];
}

const OWN_PROFILE_COLUMNS =
  'id, username, display_name, avatar_url, color, usual_locality, primary_activity, motivation, target_frequency, usual_time_slot, onboarding_completed_at';

export async function fetchOwnProfile(userId: string): Promise<OwnProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(OWN_PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as OwnProfile | null;
}

export async function isUsernameAvailable(
  username: string,
  excludeUserId: string,
): Promise<boolean> {
  // Profiles are publicly readable per RLS; a head count tells us uniqueness
  // without leaking other users' columns. Excluded id covers the user's own row.
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .ilike('username', username)
    .neq('id', excludeUserId);
  if (error) throw error;
  return (count ?? 0) === 0;
}

type Tier1Input = {
  username: string;
  usual_locality: string;
  primary_activity: ActivityType | null;
};

export async function updateProfileTier1(
  userId: string,
  input: Tier1Input,
): Promise<OwnProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      username: input.username,
      usual_locality: input.usual_locality,
      primary_activity: input.primary_activity,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select(OWN_PROFILE_COLUMNS)
    .single();
  if (error) throw error;
  return data as OwnProfile;
}

type Tier2Input = {
  motivation?: MotivationKind;
  target_frequency?: FrequencyKind;
};

export async function updateProfileTier2(
  userId: string,
  input: Tier2Input,
): Promise<OwnProfile> {
  const patch: Record<string, string> = {};
  if (input.motivation) patch.motivation = input.motivation;
  if (input.target_frequency) patch.target_frequency = input.target_frequency;
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select(OWN_PROFILE_COLUMNS)
    .single();
  if (error) throw error;
  return data as OwnProfile;
}
