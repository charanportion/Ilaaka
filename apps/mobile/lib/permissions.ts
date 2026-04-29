import { Alert, Linking, Platform } from 'react-native';

// Standard "permission denied" recovery alert. Offers a button that takes the
// user directly to the system Settings screen for our app, where they can
// flip the toggle. Without this, users hit a dead-end alert and assume the
// app is broken when they previously denied.
export function showPermissionDeniedAlert(opts: {
  title?: string;
  message: string;
  cancelLabel?: string;
}): void {
  Alert.alert(
    opts.title ?? 'Permission needed',
    opts.message,
    [
      { text: opts.cancelLabel ?? 'Cancel', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: () => {
          // openSettings() opens the app-specific Settings page on iOS and
          // Android. Catching is defensive — has been known to throw on
          // older Android versions.
          Linking.openSettings().catch(() => {/* no-op */});
        },
      },
    ],
    { cancelable: true },
  );
}

// Convenience for the common "you previously denied X — go re-enable it"
// scenario. Reads as one call site.
export function showPermissionDenied(featureName: string, action: string): void {
  showPermissionDeniedAlert({
    title: `${featureName} permission needed`,
    message: `Allow ${featureName} access in Settings to ${action}.`,
  });
}

// Some platforms' iOS background-location flow only re-prompts after you
// flip both flags in Settings. This explicitly says so.
export function showLocationDenied(): void {
  showPermissionDeniedAlert({
    title: 'Location permission needed',
    message: Platform.OS === 'ios'
      ? 'Open Settings → Privacy → Location and choose "Always" or "While Using" to keep recording your activity.'
      : 'Open Settings → Apps → Ilaaka → Permissions and allow Location to keep recording your activity.',
  });
}
