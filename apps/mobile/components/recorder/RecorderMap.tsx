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
import { useActivityStore } from '@/stores/activity-store';
import type { ActivityType } from '@/types/api';

const FOLLOW_ZOOM = 17;
// Shorter ease (was 600) keeps the bearing animation from stacking too far past
// the next GPS fix at 1Hz, which used to cause visible stutter.
const FOLLOW_EASE_MS = 400;
const NEAR_USER_METERS = 30;
const HEADING_EMA_ALPHA = 0.3;
// Caps the map's angular velocity so a single bad GPS heading can't spin the map.
const MAX_SLEW_DEG_PER_SEC = 90;

function isNear(a: [number, number] | null, b: [number, number] | null): boolean {
  if (!a || !b) return false;
  const cosLat = Math.cos((a[1] * Math.PI) / 180);
  const dxMeters = (a[0] - b[0]) * cosLat * 111_320;
  const dyMeters = (a[1] - b[1]) * 111_320;
  return Math.hypot(dxMeters, dyMeters) < NEAR_USER_METERS;
}

function normalizeDeg(d: number): number {
  return ((d % 360) + 360) % 360;
}

// EMA over headings in unit-vector space — averaging raw degrees would wrap
// badly near 0/360 (e.g. mean of 350° and 10° should be 0°, not 180°).
function circularEma(prev: number, next: number, alpha: number): number {
  const pRad = (prev * Math.PI) / 180;
  const nRad = (next * Math.PI) / 180;
  const x = Math.cos(pRad) + alpha * (Math.cos(nRad) - Math.cos(pRad));
  const y = Math.sin(pRad) + alpha * (Math.sin(nRad) - Math.sin(pRad));
  return normalizeDeg((Math.atan2(y, x) * 180) / Math.PI);
}

function slewCap(prev: number, target: number, maxDeltaDeg: number): number {
  let diff = normalizeDeg(target) - normalizeDeg(prev);
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  const clamped = Math.max(-maxDeltaDeg, Math.min(maxDeltaDeg, diff));
  return normalizeDeg(prev + clamped);
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
  // Sticky north-up after the user taps the compass while centered. Cleared
  // when they tap recenter (course-up re-engages).
  const [northUpLocked, setNorthUpLocked] = useState(false);
  const smoothedBearingRef = useRef<number | null>(null);
  const lastBearingUpdateRef = useRef<number>(0);
  const latestHeading = useActivityStore((s) => s.latestHeading);

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

  // Apply circular EMA + slew cap to the gated GPS heading. Writing through a
  // ref (not state) so updating bearing doesn't re-render — the camera effect
  // below reads the ref when it fires on the next position or heading change.
  useEffect(() => {
    if (latestHeading == null) return;
    const now = Date.now();
    if (smoothedBearingRef.current == null) {
      smoothedBearingRef.current = normalizeDeg(latestHeading);
    } else {
      const dtS = Math.max((now - lastBearingUpdateRef.current) / 1000, 0.001);
      const target = circularEma(smoothedBearingRef.current, latestHeading, HEADING_EMA_ALPHA);
      smoothedBearingRef.current = slewCap(
        smoothedBearingRef.current,
        target,
        MAX_SLEW_DEG_PER_SEC * dtS,
      );
    }
    lastBearingUpdateRef.current = now;
  }, [latestHeading]);

  // Ease the camera to the latest point on every new GPS sample while following.
  // Skips when the user has manually panned away — recenter button restores follow.
  const latest = points.length > 0 ? points[points.length - 1] : null;
  useEffect(() => {
    if (!isFollowing || userPanned || !latest || !cameraRef.current) return;
    const smoothed = smoothedBearingRef.current;
    const applyBearing = !northUpLocked && smoothed != null;
    cameraRef.current.easeTo({
      center:   [latest.lng, latest.lat],
      zoom:     FOLLOW_ZOOM,
      duration: FOLLOW_EASE_MS,
      ...(applyBearing ? { bearing: smoothed } : {}),
    });
  }, [isFollowing, userPanned, latest?.lng, latest?.lat, latestHeading, northUpLocked]);

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
      // Compass tap while centered: snap to north and lock it. Course-up stays
      // off until the user pans away and taps recenter again.
      cameraRef.current.setStop({ bearing: 0, pitch: 0, duration: 400 });
      setNorthUpLocked(true);
      smoothedBearingRef.current = null;
      return;
    }
    if (!userLngLat) return;
    cameraRef.current.easeTo({
      center: userLngLat,
      zoom: FOLLOW_ZOOM,
      duration: 500,
    });
    setUserPanned(false);
    setNorthUpLocked(false);
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
