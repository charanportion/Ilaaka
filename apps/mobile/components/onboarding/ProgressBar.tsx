import { View } from 'react-native';

type Props = {
  step: number;
  total: number;
};

export function OnboardingProgressBar({ step, total }: Props) {
  const pct = Math.max(0, Math.min(1, step / total));
  return (
    <View className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
      <View
        className="h-full bg-indigo-500 rounded-full"
        style={{ width: `${pct * 100}%` }}
      />
    </View>
  );
}
