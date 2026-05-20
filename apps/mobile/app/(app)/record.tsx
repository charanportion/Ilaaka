import { useEffect, useState } from 'react';
import { View, Alert, AppState, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Maximize2, Minimize2 } from 'lucide-react-native';
import { useActivityStore } from '@/stores/activity-store';
import { useAuthStore } from '@/stores/auth-store';
import { reconcileTrackingOnLaunch } from '@/lib/location';
import { submitActivity } from '@/lib/submit-activity';
import { markPendingSubmitted } from '@/db/trace-buffer';
import { showLocationDenied } from '@/lib/permissions';
import { ActivityTypePicker } from '@/components/activity/ActivityTypePicker';
import { RecorderControls } from '@/components/activity/RecorderControls';
import { PostActivityCard } from '@/components/activity/PostActivityCard';
import { SaveActivitySheet } from '@/components/activity/SaveActivitySheet';
import { CaptureCelebration } from '@/components/celebration/CaptureCelebration';
import { RecorderMap } from '@/components/recorder/RecorderMap';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useTokens } from '@/lib/useTokens';
import { capture } from '@/lib/analytics';
import type { SubmissionState } from '@/components/activity/PostActivityCard';
import type { ActivityMetadata, ActivityType, SubmitActivityResponse } from '@/types/api';

type Screen = 'idle' | 'recording' | 'metadata' | 'summary';

/* HUD overlay during recording is always dark (dashboard aesthetic),
   regardless of theme. Anchored to the new ink palette so it stays in
   sync with the rest of the system. PR 2 retypesets the HUD with
   Fraunces stat numerics + JetBrains Mono eyebrow labels — the
   structure here stays the same for now. */
const HUD_BG = 'rgba(22,22,20,0.96)';   // darkPalette.surface @ 96% alpha
const HUD_FG = '#f8f1e3';               // paper-cream
const HUD_FG_MUTED = 'rgba(248,241,227,0.6)';
const PAUSE_AMBER = '#d8923a';          // darkPalette.warning

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
    isBackgroundResumed,
    type,
    localId,
    startedAt,
    points,
    distanceM,
    durationS,
    start,
    continuePending,
    pause,
    resume,
    stop,
    reset,
    loadPending,
    syncFromSession,
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
    // Reconcile any task that survived a previous app launch (e.g. user
    // killed the app then reopened), then hydrate the store from SQLite.
    reconcileTrackingOnLaunch().finally(() => {
      void loadPending();
    });
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then((pos) => setInitialCenter([pos.coords.longitude, pos.coords.latitude]))
      .catch(() => {/* permission denied or no fix yet */});
  }, []);

  // When the app returns to foreground, pull the latest session state from
  // SQLite — the background task may have written fixes while we were away,
  // or a notification button may have flipped pause/resume.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        syncFromSession();
      }
    });
    return () => sub.remove();
  }, [syncFromSession]);

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
    const result = await start(localType);
    if (result.ok) {
      setScreen('recording');
      return;
    }
    if (result.reason === 'foreground_denied' || result.reason === 'background_denied') {
      showLocationDenied();
      return;
    }
    Alert.alert('Already Recording', 'A previous activity is still in progress. Tap "Continue Activity" to resume it.');
  }

  async function handleStop() {
    resetSubmissionState();
    await stop();
    setScreen('metadata');
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
    const result = await continuePending();
    if (result.ok) {
      setScreen('recording');
      return;
    }
    if (result.reason === 'foreground_denied' || result.reason === 'background_denied') {
      showLocationDenied();
      return;
    }
    Alert.alert('Could not resume', 'This activity may have already been completed.');
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
    /* Successful submissions get the full-screen celebration treatment.
       Failed / pending / idle states fall back to PostActivityCard so
       the user can retry, discard, or wait. */
    if (submissionState === 'success' && submissionResult) {
      return (
        <SafeAreaView edges={['top']} className="flex-1 bg-bg">
          <CaptureCelebration
            result={submissionResult}
            distanceM={distanceM}
            onDone={handleDone}
          />
        </SafeAreaView>
      );
    }
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
        <View style={{ flex: 1, backgroundColor: '#0d0d0c' }}>
          <SafeAreaView edges={['top']}>
            <View
              style={{
                paddingHorizontal: 20,
                paddingVertical: 16,
                backgroundColor: isPaused ? PAUSE_AMBER : '#0d0d0c',
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1 items-center">
                  <View style={{ marginBottom: 6 }}>
                    <Text
                      variant="eyebrow"
                      align="center"
                      style={{ color: isPaused ? '#0d0d0c' : HUD_FG_MUTED }}
                    >
                      {isPaused ? 'Paused' : 'Time'}
                    </Text>
                  </View>
                  <Text
                    variant="h1"
                    align="center"
                    style={{ color: isPaused ? '#0d0d0c' : HUD_FG, fontVariant: ['tabular-nums'] }}
                  >
                    {formatDuration(liveDurationS)}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setExpanded(false)} hitSlop={12} style={{ position: 'absolute', right: 0, top: 8 }}>
                  <Minimize2 size={20} color={isPaused ? '#0d0d0c' : HUD_FG} />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>

          <View className="flex-1 items-center justify-center gap-12 px-6">
            <View className="items-center">
              <Text variant="display" style={{ color: HUD_FG, fontVariant: ['tabular-nums'] }}>
                {(distanceM / 1000).toFixed(2)}
              </Text>
              <Text variant="eyebrow" style={{ color: HUD_FG_MUTED, marginTop: 12 }}>
                Distance · km
              </Text>
            </View>
            <View className="items-center">
              <Text variant="h1" style={{ color: HUD_FG, fontVariant: ['tabular-nums'] }}>
                {paceLabel}
              </Text>
              <Text variant="eyebrow" style={{ color: HUD_FG_MUTED, marginTop: 10 }}>
                Pace · min/km
              </Text>
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
              <Text variant="captionStrong" align="center" style={{ color: '#0d0d0c' }}>Paused</Text>
            </View>
          )}

          <View
            style={{
              marginHorizontal: 16,
              marginBottom: 12,
              backgroundColor: HUD_BG,
              paddingHorizontal: 20,
              paddingTop: 14,
              paddingBottom: 18,
              borderTopLeftRadius:    isPaused ? 0 : 20,
              borderTopRightRadius:   isPaused ? 0 : 20,
              borderBottomLeftRadius: 20,
              borderBottomRightRadius: 20,
              borderWidth: 1,
              borderColor: 'rgba(248,241,227,0.08)',
            }}
          >
            <View className="flex-row items-center mb-3">
              <Text variant="eyebrow" align="center" style={{ flex: 1, color: HUD_FG_MUTED }}>
                {type[0].toUpperCase() + type.slice(1)} · live
              </Text>
              <TouchableOpacity onPress={() => setExpanded(true)} hitSlop={10} style={{ position: 'absolute', right: 0 }}>
                <Maximize2 size={16} color={HUD_FG} />
              </TouchableOpacity>
            </View>
            <View className="flex-row">
              <View className="flex-1 items-center">
                <Text variant="h2" style={{ color: HUD_FG, fontSize: 28, lineHeight: 30, fontVariant: ['tabular-nums'] }}>
                  {formatDuration(liveDurationS)}
                </Text>
                <Text variant="eyebrow" style={{ color: HUD_FG_MUTED, marginTop: 6 }}>Time</Text>
              </View>
              <View className="flex-1 items-center">
                <Text variant="h2" style={{ color: HUD_FG, fontSize: 32, lineHeight: 34, fontVariant: ['tabular-nums'] }}>
                  {(distanceM / 1000).toFixed(2)}
                </Text>
                <Text variant="eyebrow" style={{ color: HUD_FG_MUTED, marginTop: 6 }}>km</Text>
              </View>
              <View className="flex-1 items-center">
                <Text variant="h2" style={{ color: HUD_FG, fontSize: 28, lineHeight: 30, fontVariant: ['tabular-nums'] }}>
                  {paceLabel}
                </Text>
                <Text variant="eyebrow" style={{ color: HUD_FG_MUTED, marginTop: 6 }}>min/km</Text>
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
              {isBackgroundResumed
                ? (isPaused ? 'Recording paused' : 'Recording in background')
                : 'Previous activity in progress'}
            </Text>
            <Text variant="caption" tone="muted" align="center" style={{ marginBottom: 16 }}>
              {(distanceM / 1000).toFixed(2)} km · {points.length} GPS points saved
              {isBackgroundResumed && !isPaused ? ' · open notification to control' : ''}
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
    too_few_points:
      "Your activity ended before we picked up enough GPS points. Next time, keep moving outdoors for at least a minute before stopping.",
    too_short:
      "Your activity was less than 60 seconds. Record for at least a minute before stopping.",
    too_short_distance:
      "You covered less than 250 m. Walk, run, or cycle a bit further before stopping.",
    gps_quality:
      "GPS signal was weak during this activity. Move into the open (away from tall buildings or indoors) and try again.",
    discontinuous_trace:
      "GPS dropped out for more than 2 minutes during your activity. Keep the app open and your phone unblocked while recording.",
    implausible_pace:
      "Your pace looked too fast or too slow for this activity type. Make sure you're not in a vehicle, and that you picked the right activity (walk / run / cycle).",
    too_large:
      "This route is too large for us to process. Try recording a shorter activity.",
    too_long:
      "Your activity is longer than 24 hours. Tap Stop sooner next time — leaving the recorder running for days isn't supported.",
    too_long_distance:
      "Your activity covered more than 500 km, which we can't process. Did you forget to stop the recorder?",
    sample_length_mismatch:
      "Something went wrong with the GPS data on your device. Discard this activity and start a fresh one.",
    rate_limited:
      "You've saved a lot of activities in the last hour. Wait a few minutes and try again.",
    unauthorized:
      "Your session expired. Sign in again and retry — your activity is still saved on this device.",
    invalid_json:
      "Something went wrong sending this activity. Tap Retry, or close and reopen the app.",
    invalid:
      "Some of the activity data looked off to the server. Tap Retry; if it keeps failing, please contact support.",
    processing_failed:
      "We saved your activity but couldn't compute your zones. Tap Retry — if it keeps failing, please contact support.",
    submit_failed:
      "Couldn't reach the server. Check your internet connection and tap Retry.",
  };
  return (
    messages[reason] ??
    "Something unexpected went wrong. Check your internet and tap Retry — if it keeps failing, please contact support."
  );
}
