import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import type { ActivityType, SubmitActivityResponse } from '@/types/api';
import { estimateCalories } from '@/lib/calories';

export type SubmissionState = 'idle' | 'submitting' | 'success' | 'error';

type Props = {
  type: ActivityType;
  distanceM: number;
  durationS: number;
  pointCount: number;
  submissionState: SubmissionState;
  submissionResult?: SubmitActivityResponse;
  submissionError?: string;
  onSave: () => void;
  onRetry: () => void;
  onDiscard: () => void;
  onDone: () => void;
};

function formatDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function formatPace(distanceM: number, durationS: number): string {
  if (distanceM < 10 || durationS < 1) return '--:--';
  const minPerKm = durationS / 60 / (distanceM / 1000);
  const min = Math.floor(minPerKm);
  const sec = Math.round((minPerKm - min) * 60);
  return `${min}:${String(sec).padStart(2, '0')}`;
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 items-center bg-gray-50 rounded-2xl p-4" style={{ minWidth: '40%' }}>
      <Text className="text-2xl font-bold text-indigo-600">{value}</Text>
      <Text className="text-xs text-gray-500 mt-1">{label}</Text>
    </View>
  );
}

export function PostActivityCard({
  type,
  distanceM,
  durationS,
  pointCount,
  submissionState,
  submissionResult,
  submissionError,
  onSave,
  onRetry,
  onDiscard,
  onDone,
}: Props) {
  const calories = estimateCalories(type, durationS);

  return (
    <View className="bg-white rounded-3xl mx-4 p-6 shadow-sm">
      <Text className="text-2xl font-bold text-gray-900 mb-6 text-center">Activity Complete</Text>

      <View className="flex-row flex-wrap gap-3 mb-8">
        <StatBox label="Distance"   value={`${(distanceM / 1000).toFixed(2)} km`} />
        <StatBox label="Duration"   value={formatDuration(durationS)} />
        <StatBox label="Pace"       value={`${formatPace(distanceM, durationS)} /km`} />
        <StatBox label="Calories"   value={`${calories} kcal`} />
        <StatBox label="GPS Points" value={`${pointCount}`} />
      </View>

      {submissionState === 'submitting' && (
        <View className="items-center gap-3 py-2">
          <ActivityIndicator size="large" color="#6366F1" />
          <Text className="text-gray-500 text-sm">Saving activity…</Text>
        </View>
      )}

      {submissionState === 'success' && submissionResult && (
        <View className="gap-4">
          <View className="bg-indigo-50 rounded-2xl p-4 items-center">
            <Text className="text-indigo-700 font-bold text-lg">
              {submissionResult.cells_captured > 0
                ? `${submissionResult.cells_captured} hexes captured`
                : 'Activity recorded — route too small for zones'}
            </Text>
            {submissionResult.cells_lost.length > 0 && (
              <View className="mt-2 gap-1">
                {submissionResult.cells_lost.map((d) => (
                  <Text key={d.owner_id} className="text-indigo-500 text-xs text-center">
                    Took {d.count} {d.count === 1 ? 'hex' : 'hexes'} from another player
                  </Text>
                ))}
              </View>
            )}
          </View>
          <TouchableOpacity
            onPress={onDone}
            className="bg-indigo-500 rounded-2xl py-4 items-center"
            activeOpacity={0.8}
          >
            <Text className="text-white font-semibold text-base">Done</Text>
          </TouchableOpacity>
        </View>
      )}

      {submissionState === 'error' && (
        <View className="gap-3">
          <View className="bg-red-50 rounded-2xl p-4 items-center">
            <Text className="text-red-700 text-sm text-center">
              {submissionError ?? 'Could not save activity. Please try again.'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onRetry}
            className="bg-indigo-500 rounded-2xl py-4 items-center"
            activeOpacity={0.8}
          >
            <Text className="text-white font-semibold text-base">Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onDiscard}
            className="bg-gray-100 rounded-2xl py-4 items-center"
            activeOpacity={0.8}
          >
            <Text className="text-gray-600 font-semibold text-base">Discard</Text>
          </TouchableOpacity>
        </View>
      )}

      {submissionState === 'idle' && (
        <View className="gap-3">
          <TouchableOpacity
            onPress={onSave}
            className="bg-indigo-500 rounded-2xl py-4 items-center"
            activeOpacity={0.8}
          >
            <Text className="text-white font-semibold text-base">Save Activity</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onDiscard}
            className="bg-gray-100 rounded-2xl py-4 items-center"
            activeOpacity={0.8}
          >
            <Text className="text-gray-600 font-semibold text-base">Discard</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
