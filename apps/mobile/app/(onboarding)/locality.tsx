import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Home, Briefcase, Trees, Shuffle, MapPin } from 'lucide-react-native';
import { capture } from '@/lib/analytics';
import { OnboardingProgressBar } from '@/components/onboarding/ProgressBar';

type IconComponent = React.ComponentType<{ color: string; size: number }>;

const TILES: { key: string; label: string; Icon: IconComponent }[] = [
  { key: 'around_home',  label: 'Around my home', Icon: Home      },
  { key: 'near_office',  label: 'Near my office', Icon: Briefcase },
  { key: 'at_a_park',    label: 'At a park',      Icon: Trees     },
  { key: 'mixed',        label: 'Mixed',          Icon: Shuffle   },
];

export default function LocalityScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ username?: string }>();

  const [resolved, setResolved] = useState<string>('');
  const [detecting, setDetecting] = useState(false);

  async function handleDetect() {
    setDetecting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location off',
          'Enable location access to detect your locality, or type it in.',
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const places = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      const place = places[0];
      if (!place) {
        Alert.alert('No locality', "Couldn't read a place name. Type it in.");
        return;
      }
      const name =
        [place.district, place.subregion, place.city, place.region]
          .find((s) => typeof s === 'string' && s.length > 0) ?? '';
      setResolved(name);
    } catch {
      Alert.alert('Detect failed', "Couldn't get your location. Type it in.");
    } finally {
      setDetecting(false);
    }
  }

  const value = resolved.trim();
  const canContinue = value.length > 1;

  function handleContinue() {
    if (!canContinue) return;
    capture('onboarding_question_answered', {
      tier: 1,
      question: 'locality',
      value: value.toLowerCase(),
    });
    router.push({
      pathname: '/(onboarding)/activity',
      params: { username: params.username ?? '', locality: value },
    });
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <View className="px-6 pt-4">
          <OnboardingProgressBar step={2} total={4} />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="text-3xl font-bold text-gray-900 mb-3">
            Where do you usually walk?
          </Text>
          <Text className="text-gray-500 mb-8">
            We'll use this to set up your map. We never share your home address.
          </Text>

          <View className="flex-row flex-wrap -mx-1.5">
            {TILES.map(({ key, label, Icon }) => {
              const active = resolved.trim().toLowerCase() === label.toLowerCase();
              return (
                <View key={key} className="w-1/2 px-1.5 mb-3">
                  <TouchableOpacity
                    onPress={() => setResolved(label)}
                    className={`rounded-2xl border py-6 items-center ${
                      active
                        ? 'bg-indigo-500 border-indigo-500'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <Icon color={active ? '#fff' : '#6B7280'} size={28} />
                    <Text
                      className={`mt-2 text-sm font-semibold ${
                        active ? 'text-white' : 'text-gray-600'
                      }`}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          <Text className="mt-6 text-sm text-gray-500 mb-2">Locality name</Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-base"
            value={resolved}
            onChangeText={setResolved}
            placeholder="e.g. Koramangala 5th Block"
            autoCapitalize="words"
          />

          <TouchableOpacity
            onPress={handleDetect}
            disabled={detecting}
            className="mt-3 flex-row items-center self-start py-2"
          >
            {detecting ? (
              <ActivityIndicator size="small" color="#4F46E5" />
            ) : (
              <MapPin color="#4F46E5" size={16} />
            )}
            <Text className="ml-2 text-indigo-600 font-medium text-sm">
              {detecting ? 'Detecting…' : 'Detect my locality'}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <View className="px-6 pb-8">
          <TouchableOpacity
            className={`rounded-xl py-4 items-center ${
              canContinue ? 'bg-indigo-500' : 'bg-gray-200'
            }`}
            onPress={handleContinue}
            disabled={!canContinue}
          >
            <Text
              className={`font-semibold text-base ${
                canContinue ? 'text-white' : 'text-gray-400'
              }`}
            >
              Continue
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
