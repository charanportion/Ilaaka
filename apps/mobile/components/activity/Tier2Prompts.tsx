import { useState } from 'react';
import {
  ActivityIndicator,
  Share,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Check, Share2 } from 'lucide-react-native';
import { useAuthStore } from '@/stores/auth-store';
import { updateProfileTier2 } from '@/lib/users';
import { capture } from '@/lib/analytics';
import type { FrequencyKind, MotivationKind } from '@/types/api';

const MOTIVATIONS: { key: MotivationKind; label: string }[] = [
  { key: 'consistency', label: 'Stay consistent'    },
  { key: 'habit',       label: 'Build a habit'      },
  { key: 'compete',     label: 'Compete with friends' },
  { key: 'explore',     label: 'Explore my city'    },
  { key: 'curious',     label: 'Just curious'       },
];

const FREQUENCIES: { key: FrequencyKind; label: string }[] = [
  { key: 'daily',             label: 'Daily'              },
  { key: 'multiple_per_week', label: '3–4 times a week'   },
  { key: 'weekends',          label: 'On weekends'        },
  { key: 'flexible',          label: 'Whenever I feel like it' },
];

type RowState = 'visible' | 'saving' | 'done' | 'skipped';

export function Tier2Prompts() {
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const setProfile = useAuthStore((s) => s.setProfile);

  const initialMotivation: RowState = profile?.motivation ? 'done' : 'visible';
  const initialFrequency: RowState = profile?.target_frequency ? 'done' : 'visible';

  const [motivationState, setMotivationState] = useState<RowState>(initialMotivation);
  const [frequencyState, setFrequencyState] = useState<RowState>(initialFrequency);
  const [referralUsed, setReferralUsed] = useState(false);

  if (!user) return null;

  // Hide entirely when nothing to ask anymore.
  const allHidden =
    motivationState !== 'visible' &&
    frequencyState !== 'visible' &&
    referralUsed;
  if (allHidden) return null;

  async function pickMotivation(value: MotivationKind) {
    setMotivationState('saving');
    try {
      const updated = await updateProfileTier2(user!.id, { motivation: value });
      setProfile(updated);
      capture('onboarding_question_answered', {
        tier: 2,
        question: 'motivation',
        value,
      });
      setMotivationState('done');
    } catch {
      setMotivationState('visible');
    }
  }

  async function pickFrequency(value: FrequencyKind) {
    setFrequencyState('saving');
    try {
      const updated = await updateProfileTier2(user!.id, { target_frequency: value });
      setProfile(updated);
      capture('onboarding_question_answered', {
        tier: 2,
        question: 'frequency',
        value,
      });
      setFrequencyState('done');
    } catch {
      setFrequencyState('visible');
    }
  }

  function skipMotivation() {
    capture('onboarding_question_skipped', { tier: 2, question: 'motivation' });
    setMotivationState('skipped');
  }

  function skipFrequency() {
    capture('onboarding_question_skipped', { tier: 2, question: 'frequency' });
    setFrequencyState('skipped');
  }

  async function inviteFriends() {
    if (!profile?.username) return;
    const url = `https://ilaaka.app/u/${profile.username}`;
    capture('referral_link_shared');
    try {
      await Share.share({
        url,
        message: `I'm on Ilaaka — claim zones around your neighborhood. Come play: ${url}`,
      });
    } catch {
      /* user dismissed */
    }
    setReferralUsed(true);
  }

  return (
    <View className="mt-6 gap-4">
      {motivationState === 'visible' && (
        <PromptRow
          title="One quick thing — what's pulling you to Ilaaka?"
          onSkip={skipMotivation}
        >
          <ChipRow
            options={MOTIVATIONS}
            onPick={(k) => pickMotivation(k as MotivationKind)}
          />
        </PromptRow>
      )}
      {motivationState === 'saving' && <RowSpinner />}
      {motivationState === 'done' && profile?.motivation && (
        <DoneRow label={MOTIVATIONS.find((m) => m.key === profile.motivation)?.label ?? ''} />
      )}

      {frequencyState === 'visible' && (
        <PromptRow title="How often are you thinking?" onSkip={skipFrequency}>
          <ChipRow
            options={FREQUENCIES}
            onPick={(k) => pickFrequency(k as FrequencyKind)}
          />
        </PromptRow>
      )}
      {frequencyState === 'saving' && <RowSpinner />}
      {frequencyState === 'done' && profile?.target_frequency && (
        <DoneRow label={FREQUENCIES.find((f) => f.key === profile.target_frequency)?.label ?? ''} />
      )}

      {!referralUsed && (
        <View className="rounded-2xl border border-gray-100 p-4">
          <Text className="text-sm text-gray-700 mb-3">
            Ilaaka's better with a rival. Got someone in mind?
          </Text>
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={inviteFriends}
              className="flex-1 flex-row items-center justify-center bg-indigo-500 rounded-xl py-3"
            >
              <Share2 color="#fff" size={16} />
              <Text className="ml-2 text-white font-semibold">Invite friends</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setReferralUsed(true)}
              className="px-4 items-center justify-center"
            >
              <Text className="text-gray-500 font-medium text-sm">Maybe later</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

function PromptRow({
  title,
  onSkip,
  children,
}: {
  title: string;
  onSkip: () => void;
  children: React.ReactNode;
}) {
  return (
    <View className="rounded-2xl border border-gray-100 p-4">
      <View className="flex-row items-start justify-between mb-3">
        <Text className="text-sm text-gray-700 flex-1 pr-3">{title}</Text>
        <TouchableOpacity onPress={onSkip}>
          <Text className="text-xs text-gray-400 font-medium">Skip</Text>
        </TouchableOpacity>
      </View>
      {children}
    </View>
  );
}

function ChipRow({
  options,
  onPick,
}: {
  options: { key: string; label: string }[];
  onPick: (key: string) => void;
}) {
  return (
    <View className="flex-row flex-wrap -m-1">
      {options.map(({ key, label }) => (
        <View key={key} className="m-1">
          <TouchableOpacity
            onPress={() => onPick(key)}
            className="px-3 py-2 rounded-full bg-indigo-50 border border-indigo-100"
          >
            <Text className="text-indigo-700 text-sm font-medium">{label}</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

function RowSpinner() {
  return (
    <View className="rounded-2xl border border-gray-100 p-4 items-center">
      <ActivityIndicator size="small" color="#6366F1" />
    </View>
  );
}

function DoneRow({ label }: { label: string }) {
  return (
    <View className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 flex-row items-center">
      <Check color="#059669" size={18} />
      <Text className="ml-2 text-emerald-700 font-medium text-sm">{label}</Text>
    </View>
  );
}
