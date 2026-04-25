import { create } from 'zustand';
import type { LocationObject } from 'expo-location';
import type { ActivityType } from '@/types/api';
import { traceDistance } from '@/lib/distance';
import {
  bufferPoint,
  createPendingActivity,
  endPendingActivity,
  getPendingActivity,
  readBufferedTrace,
  clearBuffer,
} from '@/db/trace-buffer';

type TracePoint = { lng: number; lat: number; ts: number; accuracy: number };

type ActivityState = {
  isRecording: boolean;
  isPaused: boolean;
  hasPending: boolean;
  type: ActivityType;
  localId: string | null;
  startedAt: Date | null;
  points: TracePoint[];
  distanceM: number;
  durationS: number;
  start: (type: ActivityType) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  addPoint: (loc: LocationObject) => void;
  reset: () => void;
  loadPending: () => Promise<void>;
};

export const useActivityStore = create<ActivityState>((set, get) => ({
  isRecording: false,
  isPaused: false,
  hasPending: false,
  type: 'run',
  localId: null,
  startedAt: null,
  points: [],
  distanceM: 0,
  durationS: 0,

  start: (type) => {
    const localId = Date.now().toString();
    createPendingActivity(localId, type, Date.now());
    set({
      isRecording: true,
      isPaused: false,
      hasPending: false,
      type,
      localId,
      startedAt: new Date(),
      points: [],
      distanceM: 0,
      durationS: 0,
    });
  },

  pause: () => set({ isPaused: true }),

  resume: () => set({ isPaused: false }),

  stop: () => {
    const { localId } = get();
    if (localId) endPendingActivity(localId, Date.now());
    set({ isRecording: false, isPaused: false });
  },

  addPoint: (loc) => {
    const s = get();
    if (!s.isRecording || s.isPaused || !s.localId) return;
    const point: TracePoint = {
      lng: loc.coords.longitude,
      lat: loc.coords.latitude,
      ts: loc.timestamp,
      accuracy: loc.coords.accuracy ?? 999,
    };
    bufferPoint(s.localId, s.points.length, point);
    const newPoints = [...s.points, point];
    const durationDelta =
      newPoints.length > 1
        ? (point.ts - s.points[s.points.length - 1].ts) / 1000
        : 0;
    set({
      points: newPoints,
      distanceM: traceDistance(newPoints),
      durationS: s.durationS + durationDelta,
    });
  },

  reset: () => {
    const { localId } = get();
    if (localId) clearBuffer(localId);
    set({
      isRecording: false,
      isPaused: false,
      hasPending: false,
      points: [],
      startedAt: null,
      localId: null,
      distanceM: 0,
      durationS: 0,
    });
  },

  loadPending: async () => {
    const pending = getPendingActivity();
    if (!pending) return;
    const points = readBufferedTrace(pending.local_id);
    if (!points.length) {
      clearBuffer(pending.local_id);
      return;
    }
    const distanceM = traceDistance(points);
    const durationS =
      points.length > 1
        ? (points[points.length - 1].ts - points[0].ts) / 1000
        : 0;
    set({
      isRecording: false,
      isPaused: false,
      hasPending: true,
      type: pending.type as ActivityType,
      localId: pending.local_id,
      startedAt: new Date(pending.started_at),
      points,
      distanceM,
      durationS,
    });
  },
}));
