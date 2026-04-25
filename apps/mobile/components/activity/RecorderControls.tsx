import { View, TouchableOpacity } from 'react-native';
import { Play, Pause, Square } from 'lucide-react-native';

type Props = {
  isRecording: boolean;
  isPaused: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
};

export function RecorderControls({ isRecording, isPaused, onStart, onPause, onResume, onStop }: Props) {
  if (!isRecording) {
    return (
      <View className="items-center">
        <TouchableOpacity
          onPress={onStart}
          className="w-24 h-24 rounded-full bg-indigo-500 items-center justify-center shadow-lg"
          activeOpacity={0.8}
        >
          <Play color="#fff" size={40} fill="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-row gap-8 justify-center items-center">
      <TouchableOpacity
        onPress={isPaused ? onResume : onPause}
        className="w-16 h-16 rounded-full bg-white border-2 border-indigo-500 items-center justify-center"
        activeOpacity={0.8}
      >
        {isPaused ? (
          <Play color="#6366F1" size={28} fill="#6366F1" />
        ) : (
          <Pause color="#6366F1" size={28} fill="#6366F1" />
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onStop}
        className="w-16 h-16 rounded-full bg-red-500 items-center justify-center"
        activeOpacity={0.8}
      >
        <Square color="#fff" size={28} fill="#fff" />
      </TouchableOpacity>
    </View>
  );
}
