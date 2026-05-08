import { View, ActivityIndicator } from 'react-native';
import type { ActivityType, SubmitActivityResponse } from '@/types/api';
import { estimateCalories } from '@/lib/calories';
import { Tier2Prompts } from '@/components/activity/Tier2Prompts';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useTokens } from '@/lib/useTokens';

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
  const { colors } = useTokens();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        backgroundColor: colors.surfaceAlt,
        borderRadius: 16,
        padding: 16,
        minWidth: '40%',
      }}
    >
      <Text variant="h3" style={{ color: colors.accent }}>{value}</Text>
      <Text variant="tag" tone="muted" style={{ marginTop: 4 }}>{label}</Text>
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
  const { colors } = useTokens();
  const calories = estimateCalories(type, durationS);

  return (
    <Card padding={24} radius="xxl" elevation="whisper" style={{ marginHorizontal: 16 }}>
      <Text variant="h2" tone="strong" align="center" style={{ marginBottom: 24 }}>
        Activity Complete
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32 }}>
        <StatBox label="Distance"   value={`${(distanceM / 1000).toFixed(2)} km`} />
        <StatBox label="Duration"   value={formatDuration(durationS)} />
        <StatBox label="Pace"       value={`${formatPace(distanceM, durationS)} /km`} />
        <StatBox label="Calories"   value={`${calories} kcal`} />
        <StatBox label="GPS Points" value={`${pointCount}`} />
      </View>

      {submissionState === 'submitting' && (
        <View className="items-center gap-3 py-2">
          <ActivityIndicator size="large" color={colors.accent} />
          <Text variant="caption" tone="muted">Saving activity…</Text>
        </View>
      )}

      {submissionState === 'success' && submissionResult && (
        <View style={{ gap: 16 }}>
          <View
            style={{
              backgroundColor: colors.surfaceAlt,
              borderRadius: 16, padding: 16,
              borderWidth: 1, borderColor: colors.border,
              alignItems: 'center',
            }}
          >
            <Text variant="bodyStrong" style={{ color: colors.accent }}>
              {submissionResult.cells_captured > 0
                ? `${submissionResult.cells_captured} hexes captured`
                : 'Activity recorded — route too small for zones'}
            </Text>
            {submissionResult.cells_lost.length > 0 && (
              <View style={{ marginTop: 8, gap: 4 }}>
                {submissionResult.cells_lost.map((d) => (
                  <Text key={d.owner_id} variant="tag" tone="muted" align="center">
                    Took {d.count} {d.count === 1 ? 'hex' : 'hexes'} from another player
                  </Text>
                ))}
              </View>
            )}
          </View>
          <Tier2Prompts />
          <Button label="Done" variant="primary" size="lg" fullWidth onPress={onDone} />
        </View>
      )}

      {submissionState === 'error' && (
        <View style={{ gap: 12 }}>
          <View
            style={{
              backgroundColor: colors.surfaceAlt,
              borderRadius: 16, padding: 16,
              borderWidth: 1, borderColor: colors.danger,
              alignItems: 'center',
            }}
          >
            <Text variant="caption" tone="danger" align="center">
              {submissionError ?? 'Could not save activity. Please try again.'}
            </Text>
          </View>
          <Button label="Retry"   variant="primary"   size="lg" fullWidth onPress={onRetry} />
          <Button label="Discard" variant="secondary" size="lg" fullWidth onPress={onDiscard} />
        </View>
      )}

      {submissionState === 'idle' && (
        <View style={{ gap: 12 }}>
          <Button label="Save Activity" variant="primary"   size="lg" fullWidth onPress={onSave} />
          <Button label="Discard"       variant="secondary" size="lg" fullWidth onPress={onDiscard} />
        </View>
      )}
    </Card>
  );
}
