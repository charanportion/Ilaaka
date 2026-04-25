import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ZoneMap } from '@/components/map/ZoneMap';
import { MyZonesToggle } from '@/components/map/MyZonesToggle';

export default function MapScreen() {
  const [showOnlyMine, setShowOnlyMine] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      <ZoneMap showOnlyMine={showOnlyMine} />
      <SafeAreaView
        edges={['top']}
        style={{ position: 'absolute', top: 0, right: 16 }}
        pointerEvents="box-none"
      >
        <View className="mt-2">
          <MyZonesToggle
            showOnlyMine={showOnlyMine}
            onToggle={() => setShowOnlyMine((v) => !v)}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}
