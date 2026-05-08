import { useEffect, useState } from 'react';
import { Modal, View, Linking, BackHandler } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTokens } from '@/lib/useTokens';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { capture } from '@/lib/analytics';
import {
  checkForUpdate,
  dismissUpdatePrompt,
  wasRecentlyDismissed,
  type UpdateStatus,
  type VersionInfo,
} from '@/lib/check-update';

type Props = {
  children: React.ReactNode;
};

/**
 * Wrap the app shell. On mount, checks the landing site's /api/version
 * once and surfaces a prompt if the installed version is behind. The check
 * is fire-and-forget — failures (offline, server down) are silent.
 */
export function UpdateGate({ children }: Props) {
  const [prompt, setPrompt] = useState<
    Extract<UpdateStatus, { status: 'update_available' | 'force_update' }> | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await checkForUpdate();
      if (cancelled) return;

      if (result.status === 'force_update') {
        capture('update_prompt_shown', {
          force: true,
          current: result.current,
          latest: result.info.latest,
        });
        setPrompt(result);
        return;
      }

      if (result.status === 'update_available') {
        const dismissed = await wasRecentlyDismissed(result.info.latest);
        if (cancelled || dismissed) return;
        capture('update_prompt_shown', {
          force: false,
          current: result.current,
          latest: result.info.latest,
        });
        setPrompt(result);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {children}
      <UpdatePrompt prompt={prompt} onDismiss={() => setPrompt(null)} />
    </>
  );
}

function UpdatePrompt({
  prompt,
  onDismiss,
}: {
  prompt:
    | Extract<UpdateStatus, { status: 'update_available' | 'force_update' }>
    | null;
  onDismiss: () => void;
}) {
  const { colors } = useTokens();

  /* Force-update is non-dismissable. Block the Android hardware back button
     while it's up — there's no path forward except updating. */
  useEffect(() => {
    if (prompt?.status !== 'force_update') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [prompt?.status]);

  if (!prompt) return null;

  const { info } = prompt;
  const isForced = prompt.status === 'force_update';

  async function handleUpdate() {
    Haptics.selectionAsync().catch(() => {});
    capture('update_prompt_action', {
      action: 'update',
      force: isForced,
      latest: info.latest,
    });
    try {
      await Linking.openURL(info.downloadUrl);
    } catch {
      /* If the OS can't open the URL, leave the prompt up so the user can
         retry. Better than vanishing silently. */
      return;
    }
  }

  async function handleLater() {
    Haptics.selectionAsync().catch(() => {});
    capture('update_prompt_action', {
      action: 'dismiss',
      force: false,
      latest: info.latest,
    });
    await dismissUpdatePrompt(info.latest);
    onDismiss();
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={isForced ? () => {} : onDismiss}
      statusBarTranslucent
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(0,0,0,0.55)',
        }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 28,
            paddingBottom: 40,
            gap: 16,
            borderTopWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text
            variant="eyebrow"
            tone="subtle"
            style={{ letterSpacing: 2.5 }}
          >
            {isForced ? 'Update required' : 'New version available'}
          </Text>

          <Text variant="h2" tone="strong">
            {isForced
              ? 'Time to update Ilaaka.'
              : `Ilaaka v${info.latest} is out.`}
          </Text>

          <Body isForced={isForced} info={info} current={prompt.current} />

          <View style={{ gap: 10, marginTop: 10 }}>
            <Button
              label={isForced ? 'Open download page' : 'Update now'}
              variant="primary"
              size="lg"
              fullWidth
              onPress={handleUpdate}
            />
            {!isForced ? (
              <Button
                label="Later"
                variant="ghost"
                size="md"
                fullWidth
                onPress={handleLater}
              />
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Body({
  isForced,
  info,
  current,
}: {
  isForced: boolean;
  info: VersionInfo;
  current: string;
}) {
  if (isForced) {
    return (
      <Text variant="body" tone="muted">
        This version of Ilaaka (v{current}) can&apos;t talk to the latest
        server. Tap below to download the new APK from
        ilaaka.dotportion.com — installing it replaces the current app and
        keeps all your zones and history.
      </Text>
    );
  }
  return (
    <Text variant="body" tone="muted">
      You&apos;re on v{current}. Released {info.releasedAt}. Tap update and
      we&apos;ll send you to the install page — the new APK replaces this
      one and keeps your zones, friends, and history intact.
    </Text>
  );
}
