import { useEffect, useState } from 'react';
import { View, Text, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useActivityStore } from '@/stores/activity-store';
import { startTracking, stopTracking } from '@/lib/location';
import { submitActivity } from '@/lib/submit-activity';
import { markPendingSubmitted } from '@/db/trace-buffer';
import { ActivityTypePicker } from '@/components/activity/ActivityTypePicker';
import { RecorderControls } from '@/components/activity/RecorderControls';
import { PostActivityCard } from '@/components/activity/PostActivityCard';
import type { SubmissionState } from '@/components/activity/PostActivityCard';
import type { ActivityType, SubmitActivityResponse } from '@/types/api';

type Screen = 'idle' | 'recording' | 'summary';

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

  const [screen, setScreen] = useState<Screen>('idle');
  const [localType, setLocalType] = useState<ActivityType>('run');
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
  const [submissionResult, setSubmissionResult] = useState<SubmitActivityResponse | undefined>();
  const [submissionError, setSubmissionError] = useState<string | undefined>();
  // Force a re-render every second so duration ticks even between GPS arrivals
  const [, setTick] = useState(0);

  useEffect(() => {
    loadPending();
  }, []);

  // 1-second heartbeat while actively recording (not paused)
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
      // start() created a pending_activities row — reset() clears it from SQLite
      reset();
      Alert.alert(
        'Location Required',
        err instanceof Error ? err.message : 'Could not start GPS tracking.',
      );
    }
  }

  async function handleStop() {
    // Batch store update + screen transition in the same render — no intermediate state
    stop();
    setScreen('summary');
    resetSubmissionState();
    // Defer GPS watcher removal until after React has committed the summary screen,
    // so the final location callback (if any) doesn't fire into a transitioning tree
    await stopTracking();
  }

  async function handleSave() {
    if (!localId || !startedAt) return;
    setSubmissionState('submitting');
    try {
      const result = await submitActivity(localId, type, startedAt);
      markPendingSubmitted(localId);
      setSubmissionResult(result);
      setSubmissionState('success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'submit_failed';
      setSubmissionError(friendlyError(msg));
      setSubmissionState('error');
    }
  }

  async function handleRetry() {
    await handleSave();
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
      Alert.alert(
        'Location Required',
        err instanceof Error ? err.message : 'Could not start GPS tracking.',
      );
    }
  }

  if (screen === 'summary') {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 justify-center">
        <PostActivityCard
          type={type}
          distanceM={distanceM}
          durationS={durationS}
          pointCount={points.length}
          submissionState={submissionState}
          submissionResult={submissionResult}
          submissionError={submissionError}
          onSave={handleSave}
          onRetry={handleRetry}
          onDiscard={handleDiscard}
          onDone={handleDone}
        />
      </SafeAreaView>
    );
  }

  if (screen === 'recording') {
    // durationS from store is GPS-accurate (excludes paused time).
    // Add the gap since the last GPS point so the clock ticks smoothly every second.
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

    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center gap-10 px-6">
          <View className="items-center">
            <Text className="text-7xl font-bold text-gray-900 tabular-nums">
              {(distanceM / 1000).toFixed(2)}
            </Text>
            <Text className="text-xl text-gray-400 mt-1">km</Text>
          </View>

          <View className="items-center">
            <Text className="text-4xl font-semibold text-gray-600 tabular-nums">
              {formatDuration(liveDurationS)}
            </Text>
            <Text className="text-sm text-gray-400 mt-1">duration</Text>
          </View>

          {paceMinKm !== null && (
            <View className="items-center">
              <Text className="text-2xl text-gray-600 tabular-nums">
                {Math.floor(paceMinKm)}:{String(Math.round((paceMinKm % 1) * 60)).padStart(2, '0')}
              </Text>
              <Text className="text-sm text-gray-400 mt-1">min/km pace</Text>
            </View>
          )}

          {isPaused && (
            <View className="bg-amber-100 px-6 py-2 rounded-full">
              <Text className="text-amber-700 font-semibold text-base">Paused</Text>
            </View>
          )}

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
    );
  }

  // idle screen
  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingVertical: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-2xl font-bold text-gray-900 text-center mb-8">
          Record Activity
        </Text>

        {hasPending && (
          <View className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
            <Text className="text-amber-800 font-semibold text-center mb-1">
              Previous activity in progress
            </Text>
            <Text className="text-amber-600 text-sm text-center mb-4">
              {(distanceM / 1000).toFixed(2)} km · {points.length} GPS points saved
            </Text>
            <TouchableOpacity
              onPress={handleContinuePending}
              className="bg-indigo-500 rounded-xl py-3 items-center"
              activeOpacity={0.8}
            >
              <Text className="text-white font-semibold">Continue Activity</Text>
            </TouchableOpacity>
          </View>
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
            <Text className="text-gray-400 text-sm mt-6 text-center">
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
