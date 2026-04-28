import { supabase } from '@/lib/supabase';
import type { UserSearchResult, FeedItem, MergedZoneInBbox } from '@/types/api';

export async function searchUsers(q: string): Promise<UserSearchResult[]> {
  if (q.trim().length < 2) return [];
  const { data, error } = await supabase.rpc('search_users', { q: q.trim() });
  if (error) throw error;
  return (data ?? []) as UserSearchResult[];
}

export async function followUser(followeeId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not authenticated');
  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: user.id, followee_id: followeeId });
  if (error) throw error;
}

export async function unfollowUser(followeeId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('followee_id', followeeId);
  if (error) throw error;
}

export async function listFollowing(): Promise<UserSearchResult[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: followRows, error: followErr } = await supabase
    .from('follows')
    .select('followee_id')
    .eq('follower_id', user.id);
  if (followErr) throw followErr;

  const ids = (followRows ?? []).map((r) => r.followee_id as string);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, color')
    .in('id', ids)
    .order('username');
  if (error) throw error;
  return (data ?? []).map((p) => ({ ...p, is_following: true })) as UserSearchResult[];
}

export async function listFollowers(): Promise<UserSearchResult[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: followRows, error: followErr } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('followee_id', user.id);
  if (followErr) throw followErr;

  const ids = (followRows ?? []).map((r) => r.follower_id as string);
  if (ids.length === 0) return [];

  // Check which of these followers we follow back
  const { data: followingBack, error: fbErr } = await supabase
    .from('follows')
    .select('followee_id')
    .eq('follower_id', user.id)
    .in('followee_id', ids);
  if (fbErr) throw fbErr;
  const followingSet = new Set((followingBack ?? []).map((r) => r.followee_id as string));

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, color')
    .in('id', ids)
    .order('username');
  if (error) throw error;
  return (data ?? []).map((p) => ({
    ...p,
    is_following: followingSet.has(p.id),
  })) as UserSearchResult[];
}

export async function fetchFriendsFeed(limit = 20): Promise<FeedItem[]> {
  const { data, error } = await supabase.rpc('friends_feed', { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as FeedItem[];
}

export async function fetchFriendsZones(
  bbox: [number, number, number, number],
): Promise<MergedZoneInBbox[]> {
  const [min_lng, min_lat, max_lng, max_lat] = bbox;
  const { data, error } = await supabase.rpc('zone_polygons_in_bbox_friends', {
    min_lng, min_lat, max_lng, max_lat,
  });
  if (error) throw error;
  return (data ?? []) as MergedZoneInBbox[];
}
