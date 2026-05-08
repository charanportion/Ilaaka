import { supabase } from '@/lib/supabase';
import type {
  ActivityComment,
  ActivityDetail,
  ActivityLiker,
} from '@/types/api';

export async function toggleActivityLike(
  activityId: string,
): Promise<{ liked: boolean; likeCount: number }> {
  const { data, error } = await supabase.rpc('toggle_activity_like', {
    p_activity_id: activityId,
  });
  if (error) throw error;
  const row = (data ?? [])[0] as { liked: boolean; like_count: number } | undefined;
  return { liked: row?.liked ?? false, likeCount: row?.like_count ?? 0 };
}

export async function listActivityLikers(
  activityId: string,
  limit = 50,
  after?: string,
): Promise<ActivityLiker[]> {
  const { data, error } = await supabase.rpc('list_activity_likers', {
    p_activity_id: activityId,
    p_limit:       limit,
    p_after:       after ?? null,
  });
  if (error) throw error;
  return (data ?? []) as ActivityLiker[];
}

export async function getActivityDetail(activityId: string): Promise<ActivityDetail | null> {
  const { data, error } = await supabase.rpc('get_activity_detail', {
    p_activity_id: activityId,
  });
  if (error) throw error;
  const row = (data ?? [])[0] as ActivityDetail | undefined;
  return row ?? null;
}

export async function listActivityComments(
  activityId: string,
  limit = 50,
  after?: string,
): Promise<ActivityComment[]> {
  const { data, error } = await supabase.rpc('list_activity_comments', {
    p_activity_id: activityId,
    p_limit:       limit,
    p_after:       after ?? null,
  });
  if (error) throw error;
  return (data ?? []) as ActivityComment[];
}

export async function createActivityComment(
  activityId: string,
  body: string,
): Promise<ActivityComment> {
  const trimmed = body.trim();
  if (trimmed.length === 0) throw new Error('empty_comment');
  const { data, error } = await supabase.rpc('create_activity_comment', {
    p_activity_id: activityId,
    p_body:        trimmed,
  });
  if (error) throw error;
  const row = (data ?? [])[0] as ActivityComment | undefined;
  if (!row) throw new Error('create_comment_no_row');
  return row;
}

export async function deleteActivityComment(commentId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_activity_comment', {
    p_comment_id: commentId,
  });
  if (error) throw error;
}

// Resolve a stored activity-photos path to a public URL.
export function activityPhotoUrl(storagePath: string): string {
  return supabase.storage.from('activity-photos').getPublicUrl(storagePath).data.publicUrl;
}
