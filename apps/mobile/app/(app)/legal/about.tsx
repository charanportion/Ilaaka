import { ScrollView, View, Text, Linking, TouchableOpacity } from 'react-native';
import Constants from 'expo-constants';

const VERSION = Constants.expoConfig?.version ?? '0.0.0';

function Link({ children, url }: { children: string; url: string }) {
  return (
    <TouchableOpacity onPress={() => Linking.openURL(url)}>
      <Text className="text-indigo-600 underline">{children}</Text>
    </TouchableOpacity>
  );
}

export default function AboutScreen() {
  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 24 }}>
      <View className="items-center mb-6">
        <View className="w-16 h-16 rounded-2xl bg-indigo-500 items-center justify-center mb-3">
          <Text className="text-white text-3xl font-bold">I</Text>
        </View>
        <Text className="text-2xl font-bold text-gray-900">Ilaaka</Text>
        <Text className="text-sm text-gray-500 mt-1">Version {VERSION}</Text>
      </View>

      <Text className="text-base text-gray-700 leading-6 mb-6">
        Ilaaka turns your real-world walks, runs, and rides into territory you own. Walk a loop and the area inside becomes yours. Walk through a friend&apos;s zone and you take it from them.
      </Text>

      <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Built with
      </Text>
      <View className="mb-6">
        <Text className="text-sm text-gray-700 mb-1">• OpenStreetMap data via OpenFreeMap</Text>
        <Text className="text-sm text-gray-700 mb-1">• Mapbox Map Matching for road snapping</Text>
        <Text className="text-sm text-gray-700 mb-1">• Supabase for backend + auth</Text>
        <Text className="text-sm text-gray-700 mb-1">• Expo + React Native</Text>
      </View>

      <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Contact
      </Text>
      <View className="mb-6">
        <Link url="mailto:sricharan.rayala@dotportion.com">sricharan.rayala@dotportion.com</Link>
      </View>

      <Text className="text-xs text-gray-400 mt-8 text-center">
        © 2026 Ilaaka. Made in Hyderabad, India.
      </Text>
    </ScrollView>
  );
}
