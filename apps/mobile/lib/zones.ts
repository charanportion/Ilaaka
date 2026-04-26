import { supabase } from '@/lib/supabase';
import type { ZoneInBbox } from '@/types/api';

export type TraceInBbox = {
  activity_id: string;
  geom: GeoJSON.LineString;
  created_at: string;
};

export async function fetchZonesInBbox(
  bbox: [number, number, number, number],
): Promise<ZoneInBbox[]> {
  const [min_lng, min_lat, max_lng, max_lat] = bbox;
  const { data, error } = await supabase.rpc('zones_in_bbox', {
    min_lng, min_lat, max_lng, max_lat,
  });
  if (error) throw error;
  return (data ?? []) as ZoneInBbox[];
}

export async function fetchMyTracesInBbox(
  bbox: [number, number, number, number],
): Promise<TraceInBbox[]> {
  const [min_lng, min_lat, max_lng, max_lat] = bbox;
  const { data, error } = await supabase.rpc('my_traces_in_bbox', {
    min_lng, min_lat, max_lng, max_lat,
  });
  if (error) throw error;
  return (data ?? []) as TraceInBbox[];
}

export async function fetchProfileStats(
  userId: string,
): Promise<{ cells_owned: number; cells_captured_alltime: number }> {
  const { data, error } = await supabase.rpc('profile_zone_stats', {
    p_user_id: userId,
  });
  if (error) throw error;
  const row = (data as { cells_owned: number; cells_captured_alltime: number }[] | null)?.[0];
  return row ?? { cells_owned: 0, cells_captured_alltime: 0 };
}
