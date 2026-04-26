import { supabase } from '@/lib/supabase';
import type { ZoneInBbox, MergedZoneInBbox } from '@/types/api';

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

export async function fetchMergedZonesInBbox(
  bbox: [number, number, number, number],
): Promise<MergedZoneInBbox[]> {
  const [min_lng, min_lat, max_lng, max_lat] = bbox;
  const { data, error } = await supabase.rpc('zones_merged_in_bbox', {
    min_lng, min_lat, max_lng, max_lat,
  });
  if (error) throw error;
  return (data ?? []) as MergedZoneInBbox[];
}

export async function fetchZonePolygonsInBbox(
  bbox: [number, number, number, number],
): Promise<MergedZoneInBbox[]> {
  const [min_lng, min_lat, max_lng, max_lat] = bbox;
  const { data, error } = await supabase.rpc('zone_polygons_in_bbox', {
    min_lng, min_lat, max_lng, max_lat,
  });
  if (error) throw error;
  return (data ?? []) as MergedZoneInBbox[];
}

export async function fetchProfileStats(
  userId: string,
): Promise<{ distance_walked_m: number; area_captured_m2: number }> {
  const { data, error } = await supabase.rpc('profile_zone_stats', {
    p_user_id: userId,
  });
  if (error) throw error;
  const row = (data as { distance_walked_m: number; area_captured_m2: number }[] | null)?.[0];
  return row ?? { distance_walked_m: 0, area_captured_m2: 0 };
}
