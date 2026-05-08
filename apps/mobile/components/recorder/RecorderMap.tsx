import { useEffect, useMemo, useRef, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import {
  Map,
  Camera,
  UserLocation,
  GeoJSONSource,
  Layer,
  type CameraRef,
  type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native';
import type { NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapRecenterButton } from '@/components/map/MapRecenterButton';
import { useMapStyleUrl } from '@/lib/theme';
import { useTokens } from '@/lib/useTokens';
import { filterOutliers, type RawPoint } from '@/lib/smooth';
import type { ActivityType } from '@/types/api';

const FOLLOW_ZOOM = 17;
const FOLLOW_EASE_MS = 600;
const NEAR_USER_METERS = 30;

function isNear(a: [number, number] | null, b: [number, number] | null): boolean {
  if (!a || !b) return false;
  const cosLat = Math.cos((a[1] * Math.PI) / 180);
  const dxMeters = (a[0] - b[0]) * cosLat * 111_320;
  const dyMeters = (a[1] - b[1]) * 111_320;
  return Math.hypot(dxMeters, dyMeters) < NEAR_USER_METERS;
}

type Props = {
  points: readonly RawPoint[];
  isFollowing: boolean;
  activityType?: ActivityType;
  trailColor?: string;
  initialCenter?: [number, number] | null; // [lng, lat]
};

export function RecorderMap({
  points,
  isFollowing,
  activityType = 'walk',
  trailColor = '#7F77DD',
  initialCenter,
}: Props) {
  const cameraRef = useRef<CameraRef | null>(null);
  const insets = useSafeAreaInsets();
  const mapStyle = useMapStyleUrl();
  const { colors } = useTokens();
  const [userPanned, setUserPanned] = useState(false);
  const [bearing, setBearing] = useState(0);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);

  const trailFc = useMemo<GeoJSON.Feature<GeoJSON.LineString> | null>(() => {
    if (points.length < 2) return null;
    /* Live trail: outlier-filter only, no EMA smoothing. The EMA used to
       "round corners" by lagging behind the latest fix — fine for a
       static replay, terrible for live tracking where the line should
       end right under the user's dot. The pretty snap-to-roads version
       runs server-side on submit (see supabase/functions/submit-activity
       and the project's trace-smoothing pipeline). */
    const filtered = filterOutliers(points, activityType);
    if (filtered.length < 2) return null;
    const coordinates: [number, number][] = filtered.map((p) => [p.lng, p.lat]);
    return {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates },
      properties: {},
    };
  }, [points, activityType]);

  // Ease the camera to the latest point on every new GPS sample while following.
  // Skips when the user has manually panned away — recenter button restores follow.
  const latest = points.length > 0 ? points[points.length - 1] : null;
  useEffect(() => {
    if (!isFollowing || userPanned || !latest || !cameraRef.current) return;
    cameraRef.current.easeTo({
      center:   [latest.lng, latest.lat],
      zoom:     FOLLOW_ZOOM,
      duration: FOLLOW_EASE_MS,
    });
  }, [isFollowing, userPanned, latest?.lng, latest?.lat]);

  function handleRegionIsChanging(e: NativeSyntheticEvent<ViewStateChangeEvent>) {
    const { bearing: nextBearing, center, userInteraction } = e.nativeEvent;
    setBearing(nextBearing);
    setMapCenter([center[0], center[1]]);
    if (userInteraction) setUserPanned(true);
  }

  const userLngLat: [number, number] | null = latest ? [latest.lng, latest.lat] : null;
  const isCenteredOnUser = isNear(mapCenter, userLngLat);

  function handleRecenterPress() {
    if (!cameraRef.current) return;
    if (isCenteredOnUser) {
      cameraRef.current.setStop({ bearing: 0, pitch: 0, duration: 400 });
      return;
    }
    if (!userLngLat) return;
    cameraRef.current.easeTo({
      center: userLngLat,
      zoom: FOLLOW_ZOOM,
      duration: 500,
    });
    setUserPanned(false);
  }

  // Either GPS-derived initial center, or the first recorded point if we
  // somehow have points before initialCenter resolves.
  const center =
    initialCenter ??
    (points[0] ? [points[0].lng, points[0].lat] as [number, number] : null);

  if (!center) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Map
        style={{ flex: 1 }}
        mapStyle={mapStyle}
        logo={false}
        attribution={false}
        onRegionIsChanging={handleRegionIsChanging}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{ center, zoom: FOLLOW_ZOOM }}
        />
        <UserLocation animated />

        {trailFc && (
          <GeoJSONSource id="recorder-trail" data={trailFc}>
            <Layer
              id="recorder-trail-line"
              type="line"
              paint={{
                'line-color':   trailColor,
                'line-width':   5,
                'line-opacity': 0.95,
              }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </GeoJSONSource>
        )}
      </Map>

      {userLngLat && (
        <View style={{ position: 'absolute', right: 16, top: insets.top + 12 }}>
          <MapRecenterButton
            mode={isCenteredOnUser ? 'compass' : 'recenter'}
            bearing={bearing}
            onPress={handleRecenterPress}
          />
        </View>
      )}
    </View>
  );
}
