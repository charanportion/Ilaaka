import { ScrollView, View, Linking, TouchableOpacity } from 'react-native';
import Constants from 'expo-constants';
import { Text } from '@/components/ui/Text';
import { useTokens } from '@/lib/useTokens';

const VERSION = Constants.expoConfig?.version ?? '0.0.0';

function Link({ children, url }: { children: string; url: string }) {
  return (
    <TouchableOpacity onPress={() => Linking.openURL(url)}>
      <Text variant="caption" tone="link" style={{ textDecorationLine: 'underline' }}>{children}</Text>
    </TouchableOpacity>
  );
}

export default function AboutScreen() {
  const { colors } = useTokens();
  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 24 }}>
      <View className="items-center mb-6">
        <View
          style={{
            width: 64, height: 64, borderRadius: 16,
            backgroundColor: colors.ctaBg,
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 12,
          }}
        >
          <Text variant="h2" style={{ color: colors.ctaFg }}>I</Text>
        </View>
        <Text variant="h2" tone="strong">Ilaaka</Text>
        <Text variant="caption" tone="subtle" style={{ marginTop: 4 }}>Version {VERSION}</Text>
      </View>

      <Text variant="body" style={{ marginBottom: 24 }}>
        Ilaaka turns your real-world walks, runs, and rides into territory you own. Walk a loop and the area inside becomes yours. Walk through a friend&apos;s zone and you take it from them.
      </Text>

      <Text variant="tagStrong" tone="muted" style={{ textTransform: 'uppercase', marginBottom: 8 }}>
        Built with
      </Text>
      <View className="mb-6">
        <Text variant="caption" style={{ marginBottom: 4 }}>• OpenStreetMap data via OpenFreeMap</Text>
        <Text variant="caption" style={{ marginBottom: 4 }}>• Mapbox Map Matching for road snapping</Text>
        <Text variant="caption" style={{ marginBottom: 4 }}>• Supabase for backend + auth</Text>
        <Text variant="caption" style={{ marginBottom: 4 }}>• Expo + React Native</Text>
      </View>

      <Text variant="tagStrong" tone="muted" style={{ textTransform: 'uppercase', marginBottom: 8 }}>
        Contact
      </Text>
      <View className="mb-6">
        <Link url="mailto:sricharan.rayala@dotportion.com">sricharan.rayala@dotportion.com</Link>
      </View>

      <Text variant="tag" tone="subtle" align="center" style={{ marginTop: 32 }}>
        © 2026 Ilaaka. Made in Hyderabad, India.
      </Text>
    </ScrollView>
  );
}
