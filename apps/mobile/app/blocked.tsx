import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Compass } from 'lucide-react-native';
import { signOut } from '@/lib/auth';
import { useAuthStore } from '@/stores/auth-store';
import { setRegionStatus, submitRegionRequest } from '@/lib/users';
import { decideRegion } from '@/lib/geo-gate';
import { capture } from '@/lib/analytics';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/brand/Eyebrow';
import { ScribbleSticker } from '@/components/brand/ScribbleSticker';
import { useTokens } from '@/lib/useTokens';
import { typography } from '@/lib/design-tokens';

/**
 * Region-blocked screen. Shown when a user's GPS coords place them outside
 * the Hyderabad metro bbox (and their locality text doesn't say otherwise).
 *
 * Two paths off this screen:
 *   1. "Notify me" — submits a region_requests row so we know there's
 *      demand in their city, then shows a thank-you state.
 *   2. "I'm in Hyderabad now" — re-runs the region check. If their GPS
 *      now reads inside the bbox we flip their region_status to allowed
 *      and route to the map. Useful for travellers / fresh installs in
 *      unstable network.
 */
export default function BlockedScreen() {
  const router = useRouter();
  const { colors } = useTokens();
  const userId = useAuthStore((s) => s.user?.id);
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);

  const [city, setCity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [rechecking, setRechecking] = useState(false);

  async function handleNotify() {
    if (!userId) return;
    const trimmed = city.trim();
    if (trimmed.length < 2) {
      Alert.alert('Add your city', "Tell us where you're walking from.");
      return;
    }
    setSubmitting(true);
    try {
      await submitRegionRequest(userId, {
        city: trimmed,
        source: 'blocked_signup',
      });
      capture('region_request_submitted', { city: trimmed });
      setSubmitted(true);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Try again in a moment.';
      Alert.alert("Couldn't save", message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecheck() {
    if (!userId) return;
    setRechecking(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let coords: { lat: number; lng: number } | null = null;
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      }
      const decision = decideRegion({
        coords,
        locality: profile?.usual_locality ?? null,
      });
      capture('region_gate_rechecked', {
        status: decision.status,
        reason: decision.reason,
      });
      if (decision.status === 'allowed') {
        const updated = await setRegionStatus(userId, 'allowed');
        setProfile(updated);
        router.replace('/(app)/map');
      } else {
        Alert.alert(
          'Still outside Hyderabad',
          "We couldn't place you inside Hyderabad. If your GPS is off, try again outdoors with a clear sky.",
        );
      }
    } catch {
      Alert.alert('Recheck failed', "Couldn't read your location. Try again.");
    } finally {
      setRechecking(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 32, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          {!submitted ? (
            <>
              <View style={{ alignItems: 'flex-start', marginBottom: 28 }}>
                <Eyebrow style={{ marginBottom: 14 }}>
                  Hyderabad-only · v0
                </Eyebrow>
                <ScribbleSticker inset={{ x: 16, y: 6 }}>
                  <Text
                    variant="displayWonk"
                    tone="inverse"
                    style={{ fontSize: 48, lineHeight: 52, paddingHorizontal: 4 }}
                  >
                    Not yet here.
                  </Text>
                </ScribbleSticker>
              </View>

              <Text variant="bodyLg" style={{ marginBottom: 12 }}>
                Right now Ilaaka is exclusive to{' '}
                <Text variant="bodyLg" tone="strong">Hyderabad</Text>.
                We&apos;re focused on getting the streets there feeling alive
                before we expand.
              </Text>
              <Text variant="bodyLg" tone="muted" style={{ marginBottom: 32 }}>
                Tell us where you are — when there are enough walkers in your
                city to make it fun, you&apos;ll be the first to know.
              </Text>

              <Eyebrow style={{ marginBottom: 8 }}>Your city</Eyebrow>
              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder="e.g. Mumbai, Pune, Chennai…"
                placeholderTextColor={colors.inkSubtle}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!submitting}
                style={{
                  borderWidth: 1,
                  borderColor: colors.borderInput,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontFamily: typography.body.fontFamily,
                  fontSize: typography.body.fontSize,
                  color: colors.ink,
                  backgroundColor: colors.surface,
                  marginBottom: 16,
                }}
              />

              <Button
                label={submitting ? 'Sending…' : 'Notify me when you launch here'}
                variant="primary"
                size="lg"
                fullWidth
                loading={submitting}
                onPress={handleNotify}
                style={{ marginBottom: 12 }}
              />

              <View
                style={{
                  marginTop: 24,
                  paddingTop: 24,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Compass color={colors.inkSubtle} size={14} />
                  <Text
                    variant="eyebrow"
                    style={{ marginLeft: 8 }}
                  >
                    Already in Hyderabad?
                  </Text>
                </View>
                <Text variant="caption" tone="muted" style={{ marginBottom: 12 }}>
                  GPS can be flaky on first launch. Step outside and try again.
                </Text>
                <Button
                  label={rechecking ? 'Checking…' : "I'm in Hyderabad — recheck"}
                  variant="secondary"
                  size="md"
                  fullWidth
                  loading={rechecking}
                  onPress={handleRecheck}
                />
              </View>
            </>
          ) : (
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <View style={{ alignItems: 'flex-start', marginBottom: 28 }}>
                <Eyebrow style={{ marginBottom: 14 }}>You&apos;re on the list</Eyebrow>
                <Text variant="h1" tone="strong">
                  Got it. We&apos;ll write to you.
                </Text>
              </View>
              <Text variant="bodyLg" tone="muted" style={{ marginBottom: 12 }}>
                We&apos;ll let you know the moment Ilaaka comes to{' '}
                <Text variant="bodyLg" tone="strong">{city.trim()}</Text>.
              </Text>
              <Text variant="bodyLg" tone="muted">
                In the meantime, hit us up at{' '}
                <Text variant="bodyLg" tone="link">sri@ilaaka.app</Text> if you
                want to help us launch in your city.
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={{ paddingHorizontal: 24, paddingBottom: 16 }}>
          <TouchableOpacity
            onPress={() => signOut().catch(() => {})}
            style={{ paddingVertical: 12, alignItems: 'center' }}
          >
            <Text variant="captionStrong" tone="muted">Sign out</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
