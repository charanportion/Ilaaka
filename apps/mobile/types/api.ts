export type ActivityType = 'run' | 'walk' | 'cycle' | 'hike';

export type ActivityVisibility = 'public' | 'followers' | 'private';

export type MotivationKind = 'consistency' | 'habit' | 'compete' | 'explore' | 'curious';
export type FrequencyKind = 'daily' | 'multiple_per_week' | 'weekends' | 'flexible';
export type TimeSlotKind = 'morning' | 'afternoon' | 'evening' | 'late_night' | 'varies';

export type OwnProfile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  color: string;
  usual_locality: string | null;
  primary_activity: ActivityType | null;
  motivation: MotivationKind | null;
  target_frequency: FrequencyKind | null;
  usual_time_slot: TimeSlotKind | null;
  onboarding_completed_at: string | null;
};

export type ActivityMetadata = {
  title?: string;
  description?: string;
  visibility?: ActivityVisibility;
  hide_pace?: boolean;
  hide_calories?: boolean;
  photo_paths?: string[];
};

export type SubmitActivityRequest = {
  type: ActivityType;
  started_at: string;
  ended_at: string;
  trace: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  samples: {
    timestamps: number[];
    accuracy_m: number[];
  };
  client_calories?: number;
} & ActivityMetadata;

export type SubmitActivityResponse = {
  activity_id: string;
  cells_captured: number;
  cells_lost: { owner_id: string; count: number }[];
};

export type ZoneInBbox = {
  h3_index: string;
  owner_id: string;
  owner_username: string;
  owner_color: string;
  captured_at: string;
  geom: GeoJSON.Polygon;
};

export type MergedZoneInBbox = {
  owner_id: string;
  owner_username: string;
  owner_display_name: string;
  owner_avatar_url: string | null;
  owner_color: string;
  captured_at: string;
  geom: GeoJSON.Polygon | GeoJSON.MultiPolygon;
};

export type UserPublicProfile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  color: string;
  total_distance_m: number;
  total_area_m2: number;
  total_calories: number;
  total_activities: number;
  is_following: boolean;
};

export type UserActivity = {
  activity_id: string;
  type: ActivityType;
  started_at: string;
  duration_s: number;
  distance_m: number;
  area_captured_m2: number;
  calories: number | null;
};

export type ZoneFilter = 'all' | 'mine' | 'friends';

export type UserSearchResult = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  color: string;
  is_following: boolean;
};

export type FeedItem = {
  activity_id: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  color: string;
  type: ActivityType;
  started_at: string;
  duration_s: number;
  distance_m: number;
  area_captured_m2: number;
  calories: number | null;
  title: string | null;
  description: string | null;
  visibility: ActivityVisibility;
  hide_pace: boolean;
  hide_calories: boolean;
  photo_count: number;
  cover_photo_path: string | null;
  like_count: number;
  comment_count: number;
  has_liked: boolean;
  capture_polygon_geojson: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  trace_geojson: GeoJSON.LineString | GeoJSON.MultiLineString | null;
};

export type ActivityDetail = {
  activity_id: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  color: string;
  type: ActivityType;
  started_at: string;
  ended_at: string;
  duration_s: number;
  distance_m: number;
  area_captured_m2: number;
  calories: number | null;
  title: string | null;
  description: string | null;
  visibility: ActivityVisibility;
  hide_pace: boolean;
  hide_calories: boolean;
  capture_polygon_geojson: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  trace_geojson: GeoJSON.LineString | GeoJSON.MultiLineString | null;
  photo_paths: string[];
  like_count: number;
  comment_count: number;
  has_liked: boolean;
};

export type ActivityLiker = {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  color: string;
  liked_at: string;
  is_following: boolean;
};

export type ActivityComment = {
  comment_id: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  color: string;
  body: string;
  created_at: string;
  updated_at: string;
};
