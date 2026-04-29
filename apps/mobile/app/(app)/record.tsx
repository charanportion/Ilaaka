import { useEffect, useState } from 'react';
import { View, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Maximize2, Minimize2 } from 'lucide-react-native';
import { useActivityStore } from '@/stores/activity-store';
import { useAuthStore } from '@/stores/auth-store';
import { startTracking, stopTracking } from '@/lib/location';
import { submitActivity } from '@/lib/submit-activity';
import { markPendingSubmitted } from '@/db/trace-buffer';
import { showLocationDenied } from '@/lib/permissions';
import { ActivityTypePicker } from '@/components/activity/ActivityTypePicker';
import { RecorderControls } from '@/components/activity/RecorderControls';
import { PostActivityCard } from '@/components/activity/PostActivityCard';
import { SaveActivitySheet } from '@/components/activity/SaveActivitySheet';
import { RecorderMap } from '@/components/recorder/RecorderMap';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useTokens } from '@/lib/useTokens';
import { capture } from '@/lib/analytics';
import type { SubmissionState } from '@/components/activity/PostActivityCard';
import type { ActivityMetadata, ActivityType, SubmitActivityResponse } from '@/types/api';

type Screen = 'idle' | 'recording' | 'metadata' | 'summary';

// HUD overlay during recording is always dark (dashboard aesthetic), regardless of theme.
const HUD_BG = 'rgba(23,23,23,0.95)';
const HUD_FG = '#FFFFFF';
const HUD_FG_MUTED = 'rgba(255,255,255,0.6)';
const PAUSE_AMBER = '#F5B945';

function formatDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function RecordScreen() {
  const {
    isRecording,
    isPaused,
    hasPending,
    type,
    localId,
    startedAt,
    points,
    distanceM,
    durationS,
    start,
    pause,
    resume,
    stop,
    reset,
    loadPending,
  } = useActivityStore();
  const userId = useAuthStore((s) => s.user?.id);
  const primaryActivity = useAuthStore((s) => s.profile?.primary_activity);
  const { colors } = useTokens();

  const [screen, setScreen] = useState<Screen>('idle');
  const [localType, setLocalType] = useState<ActivityType>(primaryActivity ?? 'walk');
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
  const [submissionResult, setSubmissionResult] = useState<SubmitActivityResponse | undefined>();
  const [submissionError, setSubmissionError] = useState<string | undefined>();
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    loadPending();
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then((pos) => setInitialCenter([pos.coords.longitude, pos.coords.latitude]))
      .catch(() => {/* permission denied or no fix yet */});
  }, []);

  useEffect(() => {
    if (screen !== 'recording' || isPaused) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [screen, isPaused]);

  function resetSubmissionState() {
    setSubmissionState('idle');
    setSubmissionResult(undefined);
    setSubmissionError(undefined);
  }

  async function handleStart() {
    try {
      start(localType);
      await startTracking();
      setScreen('recording');
    } catch (err: unknown) {
      reset();
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('permission') || msg.includes('Permission')) {
        showLocationDenied();
      } else {
        Alert.alert('Location Required', msg || 'Could not start GPS tracking.');
      }
    }
  }

  async function handleStop() {
    stop();
    setScreen('metadata');
    resetSubmissionState();
    await stopTracking();
  }

  async function handlePublish(metadata: ActivityMetadata) {
    if (!localId || !startedAt) return;
    setScreen('summary');
    setSubmissionState('submitting');
    try {
      const result = await submitActivity(localId, type, startedAt, metadata);
      markPendingSubmitted(localId);
      setSubmissionResult(result);
      setSubmissionState('success');
      capture('activity_published', {
        activity_id:   result.activity_id,
        visibility:    metadata.visibility ?? 'public',
        has_title:     !!metadata.title,
        has_photos:    (metadata.photo_paths?.length ?? 0) > 0,
        hide_pace:     !!metadata.hide_pace,
        hide_calories: !!metadata.hide_calories,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'submit_failed';
      setSubmissionError(friendlyError(msg));
      setSubmissionState('error');
    }
  }

  async function handleRetry() {
    await handlePublish({});
  }

  function handleDone() {
    reset();
    resetSubmissionState();
    setScreen('idle');
  }

  function handleDiscard() {
    reset();
    resetSubmissionState();
    setScreen('idle');
  }

  async function handleContinuePending() {
    try {
      await startTracking();
      useActivityStore.setState({ isRecording: true, isPaused: false, hasPending: false });
      setScreen('recording');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('permission') || msg.includes('Permission')) {
        showLocationDenied();
      } else {
        Alert.alert('Location Required', msg || 'Could not start GPS tracking.');
      }
    }
  }

  if (screen === 'metadata') {
    if (!userId || !localId || !startedAt) {
      return (
        <SafeAreaView edges={['top']} className="flex-1 bg-bg justify-center">
          <PostActivityCard
            type={type}
            distanceM={distanceM}
            durationS={durationS}
            pointCount={points.length}
            submissionState="idle"
            submissionResult={submissionResult}
            submissionError={submissionError}
            onSave={() => {/* unreachable */}}
            onRetry={handleRetry}
            onDiscard={handleDiscard}
            onDone={handleDone}
          />
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-bg">
        <SaveActivitySheet
          userId={userId}
          localId={localId}
          type={type}
          startedAt={startedAt}
          distanceM={distanceM}
          durationS={durationS}
          publishing={submissionState === 'submitting'}
          onPublish={handlePublish}
          onDiscard={handleDiscard}
        />
      </SafeAreaView>
    );
  }

  if (screen === 'summary') {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-bg justify-center">
        <PostActivityCard
          type={type}
          distanceM={distanceM}
          durationS={durationS}
          pointCount={points.length}
          submissionState={submissionState}
          submissionResult={submissionResult}
          submissionError={submissionError}
          onSave={() => {/* metadata flow handles save */}}
          onRetry={handleRetry}
          onDiscard={handleDiscard}
          onDone={handleDone}
        />
      </SafeAreaView>
    );
  }

  if (screen === 'recording') {
    const lastTs =
      points.length > 0
        ? points[points.length - 1].ts
        : (startedAt?.getTime() ?? Date.now());
    const gapS = !isPaused ? Math.max(0, (Date.now() - lastTs) / 1000) : 0;
    const liveDurationS = durationS + gapS;

    const paceMinKm =
      distanceM > 10 && liveDurationS > 0
        ? liveDurationS / 60 / (distanceM / 1000)
        : null;

    const paceLabel =
      paceMinKm !== null
        ? `${Math.floor(paceMinKm)}:${String(Math.round((paceMinKm % 1) * 60)).padStart(2, '0')}`
        : '--:--';

    if (expanded) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0e0f12' }}>
          <SafeAreaView edges={['top']}>
            <View
              style={{
                paddingHorizontal: 20, paddingVertical: 16,
                backgroundColor: isPaused ? PAUSE_AMBER : '#0e0f12',
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  {isPaused && (
                    <Text variant="captionStrong" align="center" style={{ color: '#0e0f12', marginBottom: 4 }}>
                      Paused
                    </Text>
                  )}
                  <Text
                    variant="h1"
                    align="center"
                    style={{ color: isPaused ? '#0e0f12' : HUD_FG, fontVariant: ['tabular-nums'] }}
                  >
                    {formatDuration(liveDurationS)}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setExpanded(false)} hitSlop={12} style={{ position: 'absolute', right: 0, top: 8 }}>
                  <Minimize2 size={20} color={isPaused ? '#0e0f12' : HUD_FG} />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>

          <View className="flex-1 items-center justify-center gap-12 px-6">
            <View className="items-center">
              <Text variant="display" style={{ color: HUD_FG, fontVariant: ['tabular-nums'] }}>
                {(distanceM / 1000).toFixed(2)}
              </Text>
              <Text variant="bodyLg" style={{ color: HUD_FG_MUTED, marginTop: 8 }}>Distance (km)</Text>
            </View>
            <View className="items-center">
              <Text variant="h1" style={{ color: HUD_FG, fontVariant: ['tabular-nums'] }}>
                {paceLabel}
              </Text>
              <Text variant="bodyLg" style={{ color: HUD_FG_MUTED, marginTop: 8 }}>min/km pace</Text>
            </View>
          </View>

          <SafeAreaView edges={['bottom']}>
            <View className="px-4 pb-2 items-center">
              <RecorderControls
                isRecording={isRecording}
                isPaused={isPaused}
                onStart={handleStart}
                onPause={pause}
                onResume={resume}
                onStop={handleStop}
              />
            </View>
          </SafeAreaView>
        </View>
      );
    }

    return (
      <View className="flex-1 bg-bg">
        <RecorderMap
          points={points}
          isFollowing={!isPaused}
          activityType={type}
          initialCenter={initialCenter}
        />

        <SafeAreaView edges={['bottom']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }} pointerEvents="box-none">
          {isPaused && (
            <View
              style={{
                marginHorizontal: 16,
                backgroundColor: PAUSE_AMBER,
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                paddingHorizontal: 20,
                paddingVertical: 8,
              }}
            >
              <Text variant="captionStrong" align="center" style={{ color: '#0e0f12' }}>Paused</Text>
            </View>
          )}

          <View
            style={{
              marginHorizontal: 16,
              marginBottom: 12,
              backgroundColor: HUD_BG,
              paddingHorizontal: 20,
              paddingVertical: 16,
              borderTopLeftRadius:    isPaused ? 0 : 16,
              borderTopRightRadius:   isPaused ? 0 : 16,
              borderBottomLeftRadius: 16,
              borderBottomRightRadius: 16,
            }}
          >
            <View className="flex-row items-center mb-2">
              <Text variant="captionStrong" align="center" style={{ flex: 1, color: HUD_FG_MUTED }}>
                {type[0].toUpperCase() + type.slice(1)}
              </Text>
              <TouchableOpacity onPress={() => setExpanded(true)} hitSlop={10} style={{ position: 'absolute', right: 0 }}>
                <Maximize2 size={16} color={HUD_FG} />
              </TouchableOpacity>
            </View>
            <View className="flex-row">
              <View className="flex-1 items-center">
                <Text variant="h3" style={{ color: HUD_FG, fontSize: 24, fontVariant: ['tabular-nums'] }}>
                  {formatDuration(liveDurationS)}
                </Text>
                <Text variant="tag" style={{ color: HUD_FG_MUTED, marginTop: 4 }}>Time</Text>
              </View>
              <View className="flex-1 items-center">
                <Text variant="h2" style={{ color: HUD_FG, fontSize: 30, fontVariant: ['tabular-nums'] }}>
                  {(distanceM / 1000).toFixed(2)}
                </Text>
                <Text variant="tag" style={{ color: HUD_FG_MUTED, marginTop: 4 }}>Distance (km)</Text>
              </View>
              <View className="flex-1 items-center">
                <Text variant="h3" style={{ color: HUD_FG, fontSize: 24, fontVariant: ['tabular-nums'] }}>
                  {paceLabel}
                </Text>
                <Text variant="tag" style={{ color: HUD_FG_MUTED, marginTop: 4 }}>min/km</Text>
              </View>
            </View>
          </View>

          <View className="px-4 pb-2 items-center">
            <RecorderControls
              isRecording={isRecording}
              isPaused={isPaused}
              onStart={handleStart}
              onPause={pause}
              onResume={resume}
              onStop={handleStop}
            />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // idle screen
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingVertical: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="h2" tone="strong" align="center" style={{ marginBottom: 32 }}>
          Record Activity
        </Text>

        {hasPending && (
          <Card padding={20} style={{ marginBottom: 24, borderColor: colors.warning, borderWidth: 1 }}>
            <Text variant="bodyStrong" tone="warning" align="center" style={{ marginBottom: 4 }}>
              Previous activity in progress
            </Text>
            <Text variant="caption" tone="muted" align="center" style={{ marginBottom: 16 }}>
              {(distanceM / 1000).toFixed(2)} km · {points.length} GPS points saved
            </Text>
            <Button
              label="Continue Activity"
              variant="primary"
              size="md"
              fullWidth
              onPress={handleContinuePending}
            />
          </Card>
        )}

        {!hasPending && (
          <View className="mb-8">
            <ActivityTypePicker selected={localType} onChange={setLocalType} />
          </View>
        )}

        <View className="flex-1 justify-center items-center py-8">
          <RecorderControls
            isRecording={false}
            isPaused={false}
            onStart={handleStart}
            onPause={pause}
            onResume={resume}
            onStop={handleStop}
          />
          {!hasPending && (
            <Text variant="caption" tone="subtle" align="center" style={{ marginTop: 24 }}>
              Tap to start recording your {localType}
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function friendlyError(reason: string): string {
  const messages: Record<string, string> = {
    too_few_points:     'Not enough GPS points recorded.',
    too_short:          'Activity was too short (minimum 60 seconds).',
    too_short_distance: 'Distance too short (minimum 250 m).',
    gps_quality:        'GPS accuracy was too low. Try recording outdoors.',
    discontinuous_trace:'GPS signal was lost for too long during the activity.',
    implausible_pace:   "Pace looks off — make sure you're not in a vehicle.",
    too_large:          'Route is too large to process. Try a shorter activity.',
  };
  return messages[reason] ?? 'Could not save activity. Please try again.';
}
