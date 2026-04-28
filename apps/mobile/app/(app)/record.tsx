import { useEffect, useState } from 'react';
import { View, Text, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Maximize2, Minimize2 } from 'lucide-react-native';
import { useActivityStore } from '@/stores/activity-store';
import { useAuthStore } from '@/stores/auth-store';
import { startTracking, stopTracking } from '@/lib/location';
import { submitActivity } from '@/lib/submit-activity';
import { markPendingSubmitted } from '@/db/trace-buffer';
import { ActivityTypePicker } from '@/components/activity/ActivityTypePicker';
import { RecorderControls } from '@/components/activity/RecorderControls';
import { PostActivityCard } from '@/components/activity/PostActivityCard';
import { SaveActivitySheet } from '@/components/activity/SaveActivitySheet';
import { RecorderMap } from '@/components/recorder/RecorderMap';
import { capture } from '@/lib/analytics';
import type { SubmissionState } from '@/components/activity/PostActivityCard';
import type { ActivityMetadata, ActivityType, SubmitActivityResponse } from '@/types/api';

type Screen = 'idle' | 'recording' | 'metadata' | 'summary';

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

  const [screen, setScreen] = useState<Screen>('idle');
  const [localType, setLocalType] = useState<ActivityType>(primaryActivity ?? 'walk');
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
  const [submissionResult, setSubmissionResult] = useState<SubmitActivityResponse | undefined>();
  const [submissionError, setSubmissionError] = useState<string | undefined>();
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null);
  const [expanded, setExpanded] = useState(false);
  // Force a re-render every second so duration ticks even between GPS arrivals
  const [, setTick] = useState(0);

  useEffect(() => {
    loadPending();
    // Best-effort one-shot for the map's initial center. The map will follow the
    // live UserLocation once recording starts; this is just so the idle screen
    // doesn't show an empty/wrong-region map while we wait for the first sample.
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then((pos) => setInitialCenter([pos.coords.longitude, pos.coords.latitude]))
      .catch(() => {/* permission denied or no fix yet — map renders a spinner */});
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
    // Batch store update + screen transition in the same render — no intermediate state.
    // Goes straight to the metadata sheet; submission happens once the user taps Publish.
    stop();
    setScreen('metadata');
    resetSubmissionState();
    // Defer GPS watcher removal until after React has committed the metadata screen,
    // so the final location callback (if any) doesn't fire into a transitioning tree.
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
    // Retry uses the same metadata the user already filled in. We don't keep a copy
    // around for v1, so fall back to publishing with no metadata defaults.
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
      Alert.alert(
        'Location Required',
        err instanceof Error ? err.message : 'Could not start GPS tracking.',
      );
    }
  }

  if (screen === 'metadata') {
    if (!userId || !localId || !startedAt) {
      // Defensive — these are set the moment recording starts. If we somehow
      // reach this screen without them, fall back to the result card so the
      // user has a way to discard.
      return (
        <SafeAreaView className="flex-1 bg-gray-50 justify-center">
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
      <SafeAreaView className="flex-1 bg-gray-50">
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
      <SafeAreaView className="flex-1 bg-gray-50 justify-center">
        <PostActivityCard
          type={type}
          distanceM={distanceM}
          durationS={durationS}
          pointCount={points.length}
          submissionState={submissionState}
          submissionResult={submissionResult}
          submissionError={submissionError}
          onSave={() => {/* metadata flow handles save; never invoked */}}
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

    const paceLabel =
      paceMinKm !== null
        ? `${Math.floor(paceMinKm)}:${String(Math.round((paceMinKm % 1) * 60)).padStart(2, '0')}`
        : '--:--';

    // ── Expanded (no map) — big metrics view ──────────────────────────────────
    if (expanded) {
      return (
        <View className="flex-1 bg-gray-900">
          <SafeAreaView edges={['top']}>
            <View className={`px-5 py-4 ${isPaused ? 'bg-amber-400' : 'bg-gray-900'}`}>
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  {isPaused && (
                    <Text className="text-gray-900 font-semibold text-sm text-center mb-1">
                      Paused
                    </Text>
                  )}
                  <Text className={`text-center text-4xl font-bold tabular-nums ${isPaused ? 'text-gray-900' : 'text-white'}`}>
                    {formatDuration(liveDurationS)}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setExpanded(false)} hitSlop={12} className="absolute right-0 top-2">
                  <Minimize2 size={20} color={isPaused ? '#1F2937' : '#FFFFFF'} />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>

          <View className="flex-1 items-center justify-center gap-12 px-6">
            <View className="items-center">
              <Text className="text-white text-7xl font-bold tabular-nums">
                {(distanceM / 1000).toFixed(2)}
              </Text>
              <Text className="text-gray-400 text-base mt-2">Distance (km)</Text>
            </View>
            <View className="items-center">
              <Text className="text-white text-5xl font-bold tabular-nums">
                {paceLabel}
              </Text>
              <Text className="text-gray-400 text-base mt-2">min/km pace</Text>
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

    // ── Compact — map + docked stats card ─────────────────────────────────────
    return (
      <View className="flex-1 bg-gray-50">
        <RecorderMap
          points={points}
          isFollowing={!isPaused}
          initialCenter={initialCenter}
        />

        <SafeAreaView edges={['bottom']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }} pointerEvents="box-none">
          {/* Paused banner — sits flush on top of the stats card */}
          {isPaused && (
            <View className="mx-4 bg-amber-400 rounded-t-2xl px-5 py-2">
              <Text className="text-gray-900 font-bold text-sm text-center">Paused</Text>
            </View>
          )}

          {/* Stats card */}
          <View className={`mx-4 mb-3 bg-gray-900/95 px-5 py-4 ${isPaused ? 'rounded-b-2xl' : 'rounded-2xl'}`}>
            <View className="flex-row items-center mb-2">
              <Text className="flex-1 text-center text-white/70 text-sm font-semibold">
                {type[0].toUpperCase() + type.slice(1)}
              </Text>
              <TouchableOpacity onPress={() => setExpanded(true)} hitSlop={10} className="absolute right-0">
                <Maximize2 size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <View className="flex-row">
              <View className="flex-1 items-center">
                <Text className="text-white text-2xl font-bold tabular-nums">
                  {formatDuration(liveDurationS)}
                </Text>
                <Text className="text-white/60 text-xs mt-1">Time</Text>
              </View>
              <View className="flex-1 items-center">
                <Text className="text-white text-3xl font-bold tabular-nums">
                  {(distanceM / 1000).toFixed(2)}
                </Text>
                <Text className="text-white/60 text-xs mt-1">Distance (km)</Text>
              </View>
              <View className="flex-1 items-center">
                <Text className="text-white text-2xl font-bold tabular-nums">
                  {paceLabel}
                </Text>
                <Text className="text-white/60 text-xs mt-1">min/km</Text>
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
