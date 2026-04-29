import { View } from 'react-native';
import { useTokens } from '@/lib/useTokens';

type Props = {
  step: number;
  total: number;
};

export function OnboardingProgressBar({ step, total }: Props) {
  const { colors } = useTokens();
  const pct = Math.max(0, Math.min(1, step / total));
  return (
    <View
      style={{
        height: 6,
        width: '100%',
        backgroundColor: colors.surfaceAlt,
        borderRadius: 9999,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          height: '100%',
          width: `${pct * 100}%`,
          backgroundColor: colors.accent,
          borderRadius: 9999,
        }}
      />
    </View>
  );
}
