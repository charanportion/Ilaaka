import { useEffect } from 'react';
import { View, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Svg, { Polygon } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  withSequence,
  Easing,
  interpolate,
  type SharedValue,
} from 'react-native-reanimated';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/brand/Eyebrow';
import { AnimatedNumber } from '@/components/animation/AnimatedNumber';
import { useTokens } from '@/lib/useTokens';
import type { SubmitActivityResponse } from '@/types/api';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const HEX_BURST_COUNT = 8;
/* Loose territory palette — only used inside the celebration where the
   colour represents claimed turf, not chrome. Tokens stay monochrome. */
const HEX_COLORS = ['#ff7a1a', '#c7f340', '#ff2d87', '#2bd9b8'];

type Props = {
  result: SubmitActivityResponse;
  distanceM: number;
  onDone: () => void;
};

/**
 * Full-screen celebration overlay shown when an activity is saved and
 * captures hexes. Mirrors the "feel like a game" moment: hex burst from
 * centre, big Fraunces wonk-italic "Apna Ilaaka." headline, animated
 * stat counters, optional roll of stolen-from-friends.
 *
 * Pure-Reanimated (UI-thread driven), so it stays smooth even while the
 * map / submission code unwinds in the background.
 */
export function CaptureCelebration({ result, distanceM, onDone }: Props) {
  const { colors } = useTokens();

  const stolenTotal = result.cells_lost.reduce((acc, d) => acc + d.count, 0);
  const captureSqM = result.cells_captured * 1770; // H3 res 11 ≈ 1,770 m² per cell

  /* Master timeline shared values. Each piece uses delays + their own
     timing to compose a staggered reveal without a controller component. */
  const overlay = useSharedValue(0);   // 0..1 backdrop fade
  const card = useSharedValue(0);      // 0..1 card scale + translate
  const burst = useSharedValue(0);     // 0..1 hex burst expand
  const headline = useSharedValue(0);  // 0..1 type-in
  const stats = useSharedValue(0);     // 0..1 stat block
  const cta = useSharedValue(0);       // 0..1 CTA fade

  useEffect(() => {
    overlay.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) });
    card.value = withDelay(80, withSpring(1, { damping: 14, stiffness: 130 }));
    burst.value = withDelay(180, withTiming(1, {
      duration: 850,
      easing: Easing.out(Easing.cubic),
    }));
    headline.value = withDelay(320, withSpring(1, { damping: 12, stiffness: 110 }));
    stats.value = withDelay(620, withTiming(1, {
      duration: 480,
      easing: Easing.out(Easing.quad),
    }));
    cta.value = withDelay(1280, withTiming(1, { duration: 360 }));

    /* Haptic burst — three quick pulses to mark the moment. Reduced-motion
       users still feel this; haptics are an additive cue, not the message. */
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }, 110);
    setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }, 240);
  }, [overlay, card, burst, headline, stats, cta]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: overlay.value,
  }));

  const cardStyle = useAnimatedStyle(() => {
    const scale = interpolate(card.value, [0, 1], [0.92, 1]);
    const translateY = interpolate(card.value, [0, 1], [24, 0]);
    return {
      opacity: card.value,
      transform: [{ translateY }, { scale }],
    };
  });

  const headlineStyle = useAnimatedStyle(() => {
    const translateY = interpolate(headline.value, [0, 1], [16, 0]);
    return {
      opacity: headline.value,
      transform: [{ translateY }],
    };
  });

  const statsStyle = useAnimatedStyle(() => {
    const translateY = interpolate(stats.value, [0, 1], [12, 0]);
    return {
      opacity: stats.value,
      transform: [{ translateY }],
    };
  });

  const ctaStyle = useAnimatedStyle(() => ({
    opacity: cta.value,
  }));

  return (
    <Animated.View
      pointerEvents="auto"
      style={[
        {
          position: 'absolute',
          left: 0, right: 0, top: 0, bottom: 0,
          backgroundColor: '#0d0d0c',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
        },
        backdropStyle,
      ]}
    >
      {/* Hex burst — fixed-position, exploding outward from screen centre */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: SCREEN_W,
          height: SCREEN_H,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {Array.from({ length: HEX_BURST_COUNT }).map((_, i) => (
          <BurstHex key={i} index={i} progress={burst} />
        ))}
      </View>

      {/* Animated central card */}
      <Animated.View
        style={[
          {
            width: '88%',
            maxWidth: 460,
            paddingHorizontal: 28,
            paddingVertical: 32,
            alignItems: 'center',
          },
          cardStyle,
        ]}
      >
        <Animated.View style={headlineStyle}>
          <Eyebrow style={{ marginBottom: 14, alignSelf: 'center' }}>
            Captured · just now
          </Eyebrow>
          <Text
            variant="displayWonk"
            align="center"
            style={{
              color: '#f8f1e3',
              fontSize: 56,
              lineHeight: 60,
              marginBottom: 4,
            }}
          >
            Apna
          </Text>
          <Text
            variant="displayWonk"
            align="center"
            style={{
              color: '#ff7a1a',
              fontSize: 56,
              lineHeight: 60,
              marginBottom: 22,
            }}
          >
            Ilaaka.
          </Text>
        </Animated.View>

        <Animated.View
          style={[
            {
              alignItems: 'center',
              marginBottom: 28,
              paddingHorizontal: 22,
              paddingVertical: 18,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: 'rgba(248,241,227,0.10)',
              backgroundColor: 'rgba(248,241,227,0.04)',
              minWidth: 240,
            },
            statsStyle,
          ]}
        >
          {result.cells_captured > 0 ? (
            <>
              <Eyebrow style={{ marginBottom: 8, alignSelf: 'center' }}>
                Streets claimed
              </Eyebrow>
              <AnimatedNumber
                value={result.cells_captured}
                variant="display"
                duration={1100}
                style={{ color: '#f8f1e3', fontSize: 64, lineHeight: 70 }}
              />
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'baseline',
                  marginTop: 6,
                }}
              >
                <AnimatedNumber
                  value={captureSqM}
                  variant="caption"
                  duration={1100}
                  group
                  style={{ color: 'rgba(248,241,227,0.7)' }}
                />
                <Text
                  variant="caption"
                  style={{ color: 'rgba(248,241,227,0.55)' }}
                >
                  {' '}sqm · {(distanceM / 1000).toFixed(2)} km walked
                </Text>
              </View>
            </>
          ) : (
            <>
              <Eyebrow style={{ marginBottom: 8, alignSelf: 'center' }}>
                Activity recorded
              </Eyebrow>
              <Text
                variant="h2"
                align="center"
                style={{ color: '#f8f1e3' }}
              >
                Route too small for a zone
              </Text>
              <Text
                variant="caption"
                align="center"
                style={{ color: 'rgba(248,241,227,0.55)', marginTop: 6 }}
              >
                Walk a bit further next time to claim hexes.
              </Text>
            </>
          )}
        </Animated.View>

        {stolenTotal > 0 && (
          <Animated.View
            style={[
              {
                marginBottom: 24,
                paddingHorizontal: 18,
                paddingVertical: 12,
                borderRadius: 16,
                backgroundColor: 'rgba(255,45,135,0.14)',
                borderWidth: 1,
                borderColor: 'rgba(255,122,184,0.35)',
              },
              statsStyle,
            ]}
          >
            <Text
              variant="captionStrong"
              align="center"
              style={{ color: '#ff7ab8' }}
            >
              {stolenTotal === 1
                ? '+1 hex stolen back'
                : `+${stolenTotal} hexes stolen back from ${result.cells_lost.length} ${result.cells_lost.length === 1 ? 'rival' : 'rivals'}`}
            </Text>
          </Animated.View>
        )}

        <Animated.View style={[{ alignSelf: 'stretch' }, ctaStyle]}>
          <Button
            label="See it on the map"
            variant="primary"
            size="lg"
            fullWidth
            onPress={onDone}
          />
        </Animated.View>
      </Animated.View>

      {/* Tap-anywhere-on-backdrop dismiss after the CTA has appeared */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss celebration"
        onPress={onDone}
        style={{
          position: 'absolute',
          left: 0, right: 0, top: 0, bottom: 0,
          zIndex: -1,
        }}
      />
    </Animated.View>
  );
}

/* One hex of the burst. Each is offset to a unique angle around the
   centre, scales from 0 → 1, drifts outward, and fades. */
function BurstHex({ index, progress }: { index: number; progress: SharedValue<number> }) {
  const angle = (Math.PI * 2 * index) / HEX_BURST_COUNT;
  const distance = SCREEN_W * 0.55;
  const dx = Math.cos(angle) * distance;
  const dy = Math.sin(angle) * distance;
  const color = HEX_COLORS[index % HEX_COLORS.length]!;

  const style = useAnimatedStyle(() => {
    const t = progress.value;
    const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
    const tx = eased * dx;
    const ty = eased * dy;
    const scale = interpolate(t, [0, 0.25, 1], [0, 1.1, 0.85]);
    const opacity = interpolate(t, [0, 0.15, 0.7, 1], [0, 0.95, 0.7, 0]);
    const rotate = `${eased * (index % 2 === 0 ? 1 : -1) * 35}deg`;
    return {
      opacity,
      transform: [{ translateX: tx }, { translateY: ty }, { scale }, { rotate }],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: 56,
          height: 49,
        },
        style,
      ]}
    >
      <Svg viewBox="0 0 60 52" width="100%" height="100%">
        <Polygon
          points="30,1 58,16 58,38 30,52 2,38 2,16"
          fill={color}
          opacity={0.9}
        />
      </Svg>
    </Animated.View>
  );
}
