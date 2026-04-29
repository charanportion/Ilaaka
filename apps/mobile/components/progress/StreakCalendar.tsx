import { View, TouchableOpacity } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTokens } from '@/lib/useTokens';
import { Text } from '@/components/ui/Text';

type Props = {
  monthStart: Date;
  activeDays: Set<string>;
  onPrevMonth: () => void;
  onNextMonth: () => void;
};

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function StreakCalendar({ monthStart, activeDays, onPrevMonth, onNextMonth }: Props) {
  const { colors } = useTokens();

  const monthLabel = monthStart.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const cells = buildMonthGrid(monthStart);
  const todayIso = isoDate(new Date());
  const monthIso = isoDate(monthStart);
  const todayMonth = todayIso.slice(0, 7);
  const showingMonth = monthIso.slice(0, 7);
  const isFuture = showingMonth > todayMonth;

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <TouchableOpacity onPress={onPrevMonth} hitSlop={12}>
          <ChevronLeft size={18} color={colors.ink} />
        </TouchableOpacity>
        <Text variant="bodyStrong" tone="strong">{monthLabel}</Text>
        <TouchableOpacity onPress={onNextMonth} hitSlop={12} disabled={isFuture}>
          <ChevronRight size={18} color={isFuture ? colors.inkSubtle : colors.ink} />
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', marginBottom: 4 }}>
        {DOW.map((d, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text variant="caption" tone="subtle">{d}</Text>
          </View>
        ))}
      </View>

      {cells.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row', marginBottom: 4 }}>
          {row.map((cell, ci) => {
            if (!cell) {
              return <View key={ci} style={{ flex: 1, aspectRatio: 1 }} />;
            }
            const iso = isoDate(cell);
            const active = activeDays.has(iso);
            const isToday = iso === todayIso;
            return (
              <View key={ci} style={{ flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}>
                <View
                  style={{
                    width: '78%',
                    aspectRatio: 1,
                    borderRadius: 999,
                    backgroundColor: active ? colors.accent : 'transparent',
                    borderWidth: isToday && !active ? 1.5 : 0,
                    borderColor: colors.accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    variant="caption"
                    style={{
                      color: active ? colors.ctaFg : isToday ? colors.accent : colors.inkMuted,
                      fontWeight: active || isToday ? '700' : '500',
                    }}
                  >
                    {cell.getDate()}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function buildMonthGrid(monthStart: Date): (Date | null)[][] {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const first = new Date(year, month, 1);
  // Treat Monday as first day of week (firstDay=0 means Monday).
  const firstDay = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
