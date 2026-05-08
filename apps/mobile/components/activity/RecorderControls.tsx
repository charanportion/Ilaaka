import { View, TouchableOpacity } from 'react-native';
import { Play, Pause, Square } from 'lucide-react-native';
import { useTokens } from '@/lib/useTokens';
import { shadows } from '@/lib/design-tokens';

type Props = {
  isRecording: boolean;
  isPaused: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
};

export function RecorderControls({ isRecording, isPaused, onStart, onPause, onResume, onStop }: Props) {
  const { colors } = useTokens();

  if (!isRecording) {
    return (
      <View className="items-center">
        <TouchableOpacity
          onPress={onStart}
          style={{
            width: 96, height: 96, borderRadius: 48,
            backgroundColor: colors.ctaBg,
            alignItems: 'center', justifyContent: 'center',
            ...shadows.standard,
          }}
          activeOpacity={0.8}
        >
          <Play color={colors.ctaFg} size={40} fill={colors.ctaFg} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', gap: 32, alignItems: 'center', justifyContent: 'center' }}>
      <TouchableOpacity
        onPress={isPaused ? onResume : onPause}
        style={{
          width: 64, height: 64, borderRadius: 32,
          backgroundColor: colors.surface,
          borderWidth: 2, borderColor: colors.ctaBg,
          alignItems: 'center', justifyContent: 'center',
          ...shadows.whisper,
        }}
        activeOpacity={0.8}
      >
        {isPaused ? (
          <Play color={colors.ctaBg} size={28} fill={colors.ctaBg} />
        ) : (
          <Pause color={colors.ctaBg} size={28} fill={colors.ctaBg} />
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onStop}
        style={{
          width: 64, height: 64, borderRadius: 32,
          backgroundColor: colors.danger,
          alignItems: 'center', justifyContent: 'center',
          ...shadows.whisper,
        }}
        activeOpacity={0.8}
      >
        <Square color="#ffffff" size={28} fill="#ffffff" />
      </TouchableOpacity>
    </View>
  );
}
