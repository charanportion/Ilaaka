export type ActivityType = 'run' | 'walk' | 'cycle' | 'hike';

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
};

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
