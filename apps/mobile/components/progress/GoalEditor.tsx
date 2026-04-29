import { useEffect, useState } from 'react';
import { Modal, View, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { X } from 'lucide-react-native';
import { useTokens } from '@/lib/useTokens';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import type { UserGoals } from '@/types/api';

type Props = {
  visible: boolean;
  initial: UserGoals;
  onClose: () => void;
  onSave: (goals: UserGoals) => Promise<void>;
};

export function GoalEditor({ visible, initial, onClose, onSave }: Props) {
  const { colors } = useTokens();
  const [distanceKm, setDistanceKm] = useState('');
  const [areaHa, setAreaHa] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setDistanceKm((initial.weekly_distance_m / 1000).toFixed(1).replace(/\.0$/, ''));
      setAreaHa((initial.weekly_area_m2 / 10_000).toFixed(2).replace(/\.?0+$/, ''));
      setError(null);
    }
  }, [visible, initial.weekly_distance_m, initial.weekly_area_m2]);

  async function handleSave() {
    const dKm = parseFloat(distanceKm);
    const aHa = parseFloat(areaHa);
    if (!Number.isFinite(dKm) || dKm <= 0 || dKm > 1000) {
      setError('Enter a distance between 0 and 1000 km.');
      return;
    }
    if (!Number.isFinite(aHa) || aHa <= 0 || aHa > 10_000) {
      setError('Enter an area between 0 and 10,000 ha.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        weekly_distance_m: Math.round(dKm * 1000),
        weekly_area_m2: Math.round(aHa * 10_000),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 24,
            paddingBottom: 36,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <Text variant="h3" tone="strong">Weekly goals</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <X size={20} color={colors.ink} />
            </TouchableOpacity>
          </View>

          <Input
            label="Distance (km)"
            // decimal-pad is iOS-only; numeric falls back gracefully on Android.
            keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
            value={distanceKm}
            onChangeText={setDistanceKm}
            placeholder="10"
            containerStyle={{ marginBottom: 14 }}
          />

          <Input
            label="Area (hectares)"
            keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
            value={areaHa}
            onChangeText={setAreaHa}
            placeholder="5"
            containerStyle={{ marginBottom: 6 }}
          />

          {error ? (
            <Text variant="caption" tone="danger" style={{ marginTop: 8 }}>
              {error}
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', marginTop: 20, gap: 12 }}>
            <Button label="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <Button label="Save" onPress={handleSave} loading={saving} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
