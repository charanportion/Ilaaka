import { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Flame, Pencil, Footprints, Clock, Mountain } from 'lucide-react-native';
import { useAuthStore } from '@/stores/auth-store';
import { useTokens } from '@/lib/useTokens';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { ScreenState } from '@/components/ScreenState';
import { useToast } from '@/components/Toast';
import { WeeklyBarChart } from '@/components/progress/WeeklyBarChart';
import { StreakCalendar } from '@/components/progress/StreakCalendar';
import { GoalEditor } from '@/components/progress/GoalEditor';
import {
  fetchCurrentWeekMetrics,
  fetchWeeklyHistory,
  fetchStreakStats,
  fetchActivityDays,
  fetchUserGoals,
  upsertUserGoals,
} from '@/lib/progress';
import {
  formatDistance,
  formatArea,
  formatDuration,
  formatElevation,
} from '@/lib/format';
import { capture } from '@/lib/analytics';
import type {
  WeekMetrics,
  WeeklyBucket,
  StreakStats,
  ActivityDay,
  UserGoals,
} from '@/types/api';

type ChartMetric = 'distance' | 'area';

export default function ProgressScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const { colors } = useTokens();

  const [metrics, setMetrics] = useState<WeekMetrics | null>(null);
  const [history, setHistory] = useState<WeeklyBucket[]>([]);
  const [streak, setStreak] = useState<StreakStats | null>(null);
  const [goals, setGoals] = useState<UserGoals | null>(null);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => firstOfMonth(new Date()));
  const [calendarDays, setCalendarDays] = useState<ActivityDay[]>([]);
  const [chartMetric, setChartMetric] = useState<ChartMetric>('distance');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const toast = useToast();

  const loadAll = useCallback(async () => {
    if (!userId) return;
    try {
      const [m, h, s, g] = await Promise.all([
        fetchCurrentWeekMetrics(userId),
        fetchWeeklyHistory(userId, 12),
        fetchStreakStats(userId),
        fetchUserGoals(userId),
      ]);
      setMetrics(m);
      setHistory(h);
      setStreak(s);
      setGoals(g);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'fetch_failed');
      if (__DEV__) console.error('[progress] load error:', e);
    }
  }, [userId]);

  const loadCalendar = useCallback(async (month: Date) => {
    if (!userId) return;
    try {
      const days = await fetchActivityDays(userId, month);
      setCalendarDays(days);
    } catch (e) {
      if (__DEV__) console.error('[progress] calendar error:', e);
      setCalendarDays([]);
    }
  }, [userId]);

  useEffect(() => {
    capture('progress_viewed');
  }, []);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadAll();
      await loadCalendar(calendarMonth);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [loadAll, loadCalendar, calendarMonth]));

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([loadAll(), loadCalendar(calendarMonth)]);
    setRefreshing(false);
  }

  function handlePrevMonth() {
    const next = new Date(calendarMonth);
    next.setMonth(next.getMonth() - 1);
    setCalendarMonth(next);
    capture('progress_calendar_month_changed');
  }

  function handleNextMonth() {
    const next = new Date(calendarMonth);
    next.setMonth(next.getMonth() + 1);
    const today = firstOfMonth(new Date());
    if (next.getTime() > today.getTime()) return;
    setCalendarMonth(next);
    capture('progress_calendar_month_changed');
  }

  function toggleMetric(m: ChartMetric) {
    if (m === chartMetric) return;
    setChartMetric(m);
    capture('progress_chart_metric_toggled', { metric: m });
  }

  async function handleSaveGoals(next: UserGoals) {
    if (!userId) return;
    try {
      await upsertUserGoals(userId, next);
      setGoals(next);
      toast.show({ tone: 'success', message: 'Goals updated.' });
      capture('goal_set', {
        weekly_distance_m: next.weekly_distance_m,
        weekly_area_m2: next.weekly_area_m2,
      });
    } catch (e) {
      // Re-throw so the editor can keep its busy state and show its own error,
      // but also surface a toast so the user sees confirmation outside the modal.
      toast.show({ tone: 'error', message: 'Couldn’t save goals. Try again.' });
      throw e;
    }
  }

  const activeDays = new Set(calendarDays.map((d) => d.day));

  const chartData = history.map((b) => ({
    week_start: b.week_start,
    value: chartMetric === 'distance' ? b.distance_m : b.area_m2,
  }));

  const currentWeekArea = history.length ? history[history.length - 1].area_m2 : 0;
  const distancePct = goals && goals.weekly_distance_m > 0 && metrics
    ? Math.min(1, metrics.distance_m / goals.weekly_distance_m)
    : 0;
  const areaPct = goals && goals.weekly_area_m2 > 0
    ? Math.min(1, currentWeekArea / goals.weekly_area_m2)
    : 0;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={{ padding: 4 }}>
          <ChevronLeft size={22} color={colors.ink} />
        </TouchableOpacity>
        <Text variant="h3" tone="strong" style={{ marginLeft: 4 }}>Progress</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
      >
        {loading && !metrics ? (
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : null}

        {loadError && !metrics && !loading ? (
          <ScreenState
            variant="error"
            title="Couldn’t load your progress"
            message="Pull down to refresh, or tap retry."
            retry={handleRefresh}
          />
        ) : null}

        {metrics ? (
          <Card padding={20} elevation="whisper" style={{ marginBottom: 16 }}>
            <Text variant="tagStrong" tone="muted" style={{ textTransform: 'uppercase', marginBottom: 14 }}>
              This week
            </Text>
            <View style={{ flexDirection: 'row' }}>
              <MetricCol
                Icon={Footprints}
                value={formatDistance(metrics.distance_m)}
                label="Distance"
              />
              <Divider />
              <MetricCol
                Icon={Clock}
                value={formatDuration(metrics.duration_s)}
                label="Time"
              />
              <Divider />
              <MetricCol
                Icon={Mountain}
                value={formatElevation(metrics.activity_count > 0 && metrics.elevation_gain_m === 0 ? null : metrics.elevation_gain_m)}
                label="Elevation"
              />
            </View>

            {goals ? (
              <View style={{ marginTop: 18 }}>
                <ProgressRow
                  label="Distance goal"
                  current={formatDistance(metrics.distance_m)}
                  target={formatDistance(goals.weekly_distance_m)}
                  pct={distancePct}
                />
                <View style={{ height: 10 }} />
                <ProgressRow
                  label="Area goal"
                  current={formatArea(currentWeekArea)}
                  target={formatArea(goals.weekly_area_m2)}
                  pct={areaPct}
                />
              </View>
            ) : null}
          </Card>
        ) : null}

        {history.length > 0 ? (
          <Card padding={20} elevation="whisper" style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text variant="tagStrong" tone="muted" style={{ textTransform: 'uppercase' }}>
                Last 12 weeks
              </Text>
              <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceAlt, padding: 3, borderRadius: 999 }}>
                {(['distance', 'area'] as ChartMetric[]).map((m) => {
                  const active = chartMetric === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      onPress={() => toggleMetric(m)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 5,
                        borderRadius: 999,
                        backgroundColor: active ? colors.surface : 'transparent',
                      }}
                    >
                      <Text
                        variant="captionStrong"
                        style={{ color: active ? colors.accent : colors.inkMuted }}
                      >
                        {m === 'distance' ? 'Distance' : 'Area'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <WeeklyBarChart
              data={chartData}
              formatValue={chartMetric === 'distance' ? formatDistance : formatArea}
            />
          </Card>
        ) : null}

        {streak ? (
          <Card padding={20} elevation="whisper" style={{ marginBottom: 16 }}>
            <Text variant="tagStrong" tone="muted" style={{ textTransform: 'uppercase', marginBottom: 14 }}>
              Streak
            </Text>
            <View style={{ flexDirection: 'row', marginBottom: 18 }}>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Flame size={22} color={colors.accent} />
                  <Text variant="h1" tone="strong" style={{ marginLeft: 6 }}>{streak.current_streak}</Text>
                </View>
                <Text variant="tag" tone="muted" style={{ marginTop: 4 }}>
                  Current
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: colors.border }} />
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text variant="h1" tone="strong">{streak.max_streak}</Text>
                <Text variant="tag" tone="muted" style={{ marginTop: 4 }}>
                  Best
                </Text>
              </View>
            </View>
            <StreakCalendar
              monthStart={calendarMonth}
              activeDays={activeDays}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
            />
          </Card>
        ) : null}

        {goals ? (
          <Card padding={20} elevation="whisper" style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text variant="tagStrong" tone="muted" style={{ textTransform: 'uppercase' }}>
                Weekly goals
              </Text>
              <TouchableOpacity onPress={() => setEditorOpen(true)} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Pencil size={14} color={colors.accent} />
                <Text variant="captionStrong" style={{ color: colors.accent, marginLeft: 4 }}>Edit</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1 }}>
                <Text variant="h3" tone="strong">{formatDistance(goals.weekly_distance_m)}</Text>
                <Text variant="tag" tone="muted" style={{ marginTop: 2 }}>Distance / week</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="h3" tone="strong">{formatArea(goals.weekly_area_m2)}</Text>
                <Text variant="tag" tone="muted" style={{ marginTop: 2 }}>Area / week</Text>
              </View>
            </View>
          </Card>
        ) : null}
      </ScrollView>

      {goals ? (
        <GoalEditor
          visible={editorOpen}
          initial={goals}
          onClose={() => setEditorOpen(false)}
          onSave={handleSaveGoals}
        />
      ) : null}
    </SafeAreaView>
  );
}

function MetricCol({ Icon, value, label }: { Icon: React.ComponentType<{ size: number; color: string }>; value: string; label: string }) {
  const { colors } = useTokens();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Icon size={16} color={colors.inkMuted} />
      <Text variant="h3" tone="strong" style={{ marginTop: 6 }}>{value}</Text>
      <Text variant="tag" tone="muted" style={{ marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function Divider() {
  const { colors } = useTokens();
  return <View style={{ width: 1, backgroundColor: colors.border }} />;
}

function ProgressRow({ label, current, target, pct }: { label: string; current: string; target: string; pct: number }) {
  const { colors } = useTokens();
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text variant="caption" tone="muted">{label}</Text>
        <Text variant="captionStrong" tone="strong">
          {current} <Text variant="caption" tone="subtle">/ {target}</Text>
        </Text>
      </View>
      <View style={{ height: 6, backgroundColor: colors.surfaceAlt, borderRadius: 3, overflow: 'hidden' }}>
        <View style={{ width: `${Math.round(pct * 100)}%`, height: '100%', backgroundColor: colors.accent }} />
      </View>
    </View>
  );
}

function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
