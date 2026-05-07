import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { useTokens } from '@/lib/useTokens';
import { typography } from '@/lib/design-tokens';

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
  const { colors } = useTokens();

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
    <SafeAreaView className="flex-1 bg-bg">
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
          <Text variant="h1" tone="strong" style={{ marginBottom: 12 }}>
            Where do you usually walk?
          </Text>
          <Text variant="bodyLg" tone="muted" style={{ marginBottom: 32 }}>
            We&apos;ll use this to set up your map. We never share your home address.
          </Text>

          <View className="flex-row flex-wrap -mx-1.5">
            {TILES.map(({ key, label, Icon }) => {
              const active = resolved.trim().toLowerCase() === label.toLowerCase();
              return (
                <View key={key} className="w-1/2 px-1.5 mb-3">
                  <TouchableOpacity
                    onPress={() => setResolved(label)}
                    style={{
                      borderRadius: 16,
                      borderWidth: 1,
                      paddingVertical: 24,
                      alignItems: 'center',
                      backgroundColor: active ? colors.ctaBg : colors.surface,
                      borderColor:     active ? colors.ctaBg : colors.border,
                    }}
                  >
                    <Icon color={active ? colors.ctaFg : colors.inkMuted} size={28} />
                    <Text
                      variant="captionStrong"
                      style={{ marginTop: 8, color: active ? colors.ctaFg : colors.ink }}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          <Text variant="caption" tone="muted" style={{ marginTop: 24, marginBottom: 8 }}>
            Locality name
          </Text>
          <TextInput
            value={resolved}
            onChangeText={setResolved}
            placeholder="e.g. Jubilee Hills, Road No. 36"
            placeholderTextColor={colors.inkSubtle}
            autoCapitalize="words"
            style={{
              borderWidth: 1,
              borderColor: colors.borderInput,
              borderRadius: 8,
              paddingHorizontal: 16,
              paddingVertical: 12,
              fontFamily: typography.body.fontFamily,
              fontSize: typography.body.fontSize,
              color: colors.ink,
              backgroundColor: colors.surface,
            }}
          />

          <TouchableOpacity
            onPress={handleDetect}
            disabled={detecting}
            className="mt-3 flex-row items-center self-start py-2"
          >
            {detecting ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <MapPin color={colors.accent} size={16} />
            )}
            <Text variant="captionStrong" tone="link" style={{ marginLeft: 8 }}>
              {detecting ? 'Detecting…' : 'Detect my locality'}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <View className="px-6 pb-8">
          <Button
            label="Continue"
            variant="primary"
            size="lg"
            fullWidth
            disabled={!canContinue}
            onPress={handleContinue}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
