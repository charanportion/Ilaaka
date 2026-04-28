import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ZoneMap } from '@/components/map/ZoneMap';
import { ZoneFilterToggle } from '@/components/map/ZoneFilterToggle';
import { capture } from '@/lib/analytics';
import type { ZoneFilter } from '@/types/api';

export default function MapScreen() {
  const [filter, setFilter] = useState<ZoneFilter>('all');

  function handleFilterChange(next: ZoneFilter) {
    capture('map_filter_changed', { filter: next });
    setFilter(next);
  }

  return (
    <View style={{ flex: 1 }}>
      <ZoneMap filter={filter} />
      <SafeAreaView
        edges={['top']}
        style={{ position: 'absolute', top: 0, right: 16 }}
        pointerEvents="box-none"
      >
        <View className="mt-2">
          <ZoneFilterToggle value={filter} onChange={handleFilterChange} />
        </View>
      </SafeAreaView>
    </View>
  );
}
