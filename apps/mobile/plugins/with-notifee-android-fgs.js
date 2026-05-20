/**
 * Expo config plugin: declares Notifee's Android foreground service with
 * foregroundServiceType="location" so the OS (Android 14+) lets us access GPS
 * from the background-service context the recording uses.
 *
 * Notifee 9.x doesn't ship its own config plugin, and Android 14+ rejects a
 * foreground service that tries to use location without this attribute on its
 * <service> entry. Without this plugin, calling notifee.startForegroundService()
 * with location work would throw at runtime on real Android 14+ devices.
 */
const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

const NOTIFEE_SERVICE_NAME = 'app.notifee.core.ForegroundService';

module.exports = function withNotifeeAndroidFgs(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.service = app.service ?? [];
    const existing = app.service.find(
      (s) => s.$ && s.$['android:name'] === NOTIFEE_SERVICE_NAME,
    );
    if (existing) {
      existing.$['android:foregroundServiceType'] = 'location';
      existing.$['android:exported'] = 'false';
    } else {
      app.service.push({
        $: {
          'android:name': NOTIFEE_SERVICE_NAME,
          'android:foregroundServiceType': 'location',
          'android:exported': 'false',
        },
      });
    }
    return cfg;
  });
};
