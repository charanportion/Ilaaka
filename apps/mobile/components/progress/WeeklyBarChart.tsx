import { View } from 'react-native';
import Svg, { Rect, Text as SvgText, Line } from 'react-native-svg';
import { useTokens } from '@/lib/useTokens';

type Bucket = { week_start: string; value: number };

type Props = {
  data: Bucket[];
  height?: number;
  formatValue: (n: number) => string;
};

const PAD_LEFT = 36;
const PAD_RIGHT = 8;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;

export function WeeklyBarChart({ data, height = 180, formatValue }: Props) {
  const { colors } = useTokens();
  if (!data.length) return <View style={{ height }} />;

  return (
    <View>
      <ChartSvg
        data={data}
        height={height}
        formatValue={formatValue}
        accentColor={colors.accent}
        gridColor={colors.border}
        labelColor={colors.inkSubtle}
      />
    </View>
  );
}

function ChartSvg({
  data,
  height,
  formatValue,
  accentColor,
  gridColor,
  labelColor,
}: {
  data: Bucket[];
  height: number;
  formatValue: (n: number) => string;
  accentColor: string;
  gridColor: string;
  labelColor: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const width = 320;
  const innerW = width - PAD_LEFT - PAD_RIGHT;
  const innerH = height - PAD_TOP - PAD_BOTTOM;
  const slot = innerW / data.length;
  const barW = Math.max(6, slot * 0.6);

  const ticks = [0, max / 2, max];

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
      {ticks.map((t, i) => {
        const y = PAD_TOP + innerH - (t / max) * innerH;
        return (
          <Line
            key={`g-${i}`}
            x1={PAD_LEFT}
            x2={width - PAD_RIGHT}
            y1={y}
            y2={y}
            stroke={gridColor}
            strokeWidth={1}
            strokeDasharray={i === 0 ? undefined : '3,3'}
          />
        );
      })}

      {ticks.map((t, i) => {
        const y = PAD_TOP + innerH - (t / max) * innerH;
        return (
          <SvgText
            key={`tl-${i}`}
            x={PAD_LEFT - 6}
            y={y + 3}
            fontSize={9}
            fill={labelColor}
            textAnchor="end"
          >
            {formatValue(t)}
          </SvgText>
        );
      })}

      {data.map((d, i) => {
        const h = (d.value / max) * innerH;
        const x = PAD_LEFT + slot * i + (slot - barW) / 2;
        const y = PAD_TOP + innerH - h;
        const isCurrent = i === data.length - 1;
        return (
          <Rect
            key={d.week_start}
            x={x}
            y={y}
            width={barW}
            height={Math.max(2, h)}
            rx={2}
            fill={accentColor}
            opacity={isCurrent ? 1 : 0.45}
          />
        );
      })}

      {data.map((d, i) => {
        if (i % 4 !== 0 && i !== data.length - 1) return null;
        const x = PAD_LEFT + slot * i + slot / 2;
        const y = height - 6;
        const label = labelForWeek(d.week_start);
        return (
          <SvgText
            key={`xl-${i}`}
            x={x}
            y={y}
            fontSize={9}
            fill={labelColor}
            textAnchor="middle"
          >
            {label}
          </SvgText>
        );
      })}
    </Svg>
  );
}

function labelForWeek(iso: string): string {
  const d = new Date(iso);
  const m = d.toLocaleString('en-US', { month: 'short' });
  return `${m} ${d.getDate()}`;
}
