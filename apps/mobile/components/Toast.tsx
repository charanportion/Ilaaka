import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { View, Pressable, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { useTokens } from '@/lib/useTokens';
import { radius } from '@/lib/design-tokens';

export type ToastTone = 'default' | 'success' | 'error' | 'warning';

type ToastInput = {
  id?: string;
  message: string;
  tone?: ToastTone;
  durationMs?: number;
  action?: { label: string; onPress: () => void };
};

type Toast = Required<Omit<ToastInput, 'id' | 'action'>> & {
  id: string;
  action?: { label: string; onPress: () => void };
};

type ToastContextValue = {
  show: (t: ToastInput) => void;
  dismiss: (id?: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

// Tiny global toast queue. Renders a single bottom snackbar at a time.
// Mount <ToastProvider> once near the root; call useToast().show() anywhere.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<Toast[]>([]);

  const dismiss = useCallback((id?: string) => {
    setQueue((q) => (id ? q.filter((t) => t.id !== id) : q.slice(1)));
  }, []);

  const show = useCallback((t: ToastInput) => {
    const id = t.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const next: Toast = {
      id,
      message: t.message,
      tone: t.tone ?? 'default',
      durationMs: t.durationMs ?? 3000,
      action: t.action,
    };
    setQueue((q) => [...q, next]);
  }, []);

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <ToastViewport queue={queue} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fall back to a no-op so callers don't have to null-check. Useful when
    // a component renders outside the provider (e.g. error boundary fallback).
    return { show: () => {}, dismiss: () => {} };
  }
  return ctx;
}

function ToastViewport({ queue, onDismiss }: { queue: Toast[]; onDismiss: (id?: string) => void }) {
  const current = queue[0];
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const { colors } = useTokens();

  useEffect(() => {
    if (!current) return;
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 80, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => onDismiss(current.id));
    }, current.durationMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  if (!current) return null;

  const bg =
    current.tone === 'error'   ? colors.danger :
    current.tone === 'success' ? colors.success :
    current.tone === 'warning' ? colors.warning :
                                  colors.inkStrong;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0, right: 0, bottom: 0,
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 16,
      }}
    >
      <Animated.View
        style={{
          transform: [{ translateY }],
          opacity,
          backgroundColor: bg,
          borderRadius: radius.md,
          paddingVertical: 12,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
        <Text tone="inverse" style={{ flex: 1 }}>{current.message}</Text>
        {current.action ? (
          <Pressable
            onPress={() => { current.action?.onPress(); onDismiss(current.id); }}
            style={({ pressed }) => ({ marginLeft: 16, opacity: pressed ? 0.65 : 1 })}
          >
            <Text tone="inverse" style={{ fontWeight: '600' }}>{current.action.label}</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}
