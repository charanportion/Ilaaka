import * as Location from 'expo-location';
import { useActivityStore } from '@/stores/activity-store';

let watcher: Location.LocationSubscription | null = null;

export async function startTracking(): Promise<void> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Location permission denied');

  watcher = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 1000,   // fire every ~1 s regardless of movement
      distanceInterval: 0,  // don't gate on distance — stationary testing still works
    },
    (loc) => useActivityStore.getState().addPoint(loc),
  );
}

export async function stopTracking(): Promise<void> {
  watcher?.remove();
  watcher = null;
}
