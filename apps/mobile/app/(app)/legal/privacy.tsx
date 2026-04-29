import { ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/Text';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-6">
      <Text variant="bodyStrong" tone="strong" style={{ marginBottom: 8 }}>{title}</Text>
      {children}
    </View>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <Text variant="caption" style={{ marginBottom: 8, lineHeight: 22 }}>{children}</Text>;
}

function Bullet({ children }: { children: React.ReactNode }) {
  return <Text variant="caption" style={{ marginBottom: 4, lineHeight: 22 }}>• {children}</Text>;
}

export default function PrivacyScreen() {
  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 24 }}>
      <Text variant="h2" tone="strong" style={{ marginBottom: 8 }}>Privacy Policy</Text>
      <Text variant="tag" tone="subtle" style={{ marginBottom: 24 }}>Last updated: April 2026</Text>

      <Section title="What we collect">
        <P>
          When you record an activity, Ilaaka collects your device&apos;s GPS coordinates while the recording is active. We also store your account email, display name, and the territory polygons computed from your traces.
        </P>
        <P>
          We collect minimal device metadata for crash reporting and product analytics: app version, OS version, device model, and anonymous interaction events (e.g. which screens you opened). We never log raw GPS coordinates to analytics or crash-reporting providers.
        </P>
      </Section>

      <Section title="How we use it">
        <Bullet>To compute and display your territories on the map.</Bullet>
        <Bullet>To deliver push notifications when someone captures your territory or your friend captures one nearby.</Bullet>
        <Bullet>To show your activity stats on your profile and on shared feeds with people you follow.</Bullet>
        <Bullet>To diagnose crashes and improve the app.</Bullet>
      </Section>

      <Section title="Who we share it with">
        <P>We process your data through these vendors strictly to operate the app:</P>
        <Bullet>Supabase — database, authentication, file storage.</Bullet>
        <Bullet>Mapbox — used server-side to snap GPS traces to roads. Coordinates leave our servers only for this purpose.</Bullet>
        <Bullet>Expo Push Notifications — to deliver notifications to your device.</Bullet>
        <Bullet>Sentry — anonymized crash reports (no GPS).</Bullet>
        <Bullet>PostHog — anonymized usage events (no GPS, no email).</Bullet>
        <P>
          We do not sell your data. We do not share your raw GPS traces with any other user — only the smoothed territory polygons are visible to others.
        </P>
      </Section>

      <Section title="What other users see">
        <P>
          Other users see your username, display name, color, and the territory polygons your activities created. They never see your raw GPS trace, your email, or your contact info.
        </P>
      </Section>

      <Section title="Data retention">
        <P>
          Captured zones expire 30 days after the originating activity unless reclaimed by walking. Activity records (distance, duration, calories) remain on your profile until you delete your account.
        </P>
      </Section>

      <Section title="Account deletion">
        <P>
          You can request deletion of your account and all associated data at any time by emailing sricharan.rayala@dotportion.com from the address registered to your account. Deletion is permanent and cascades through activities, zones, follows, and push tokens.
        </P>
      </Section>

      <Section title="Children">
        <P>Ilaaka is not directed to children under 13. If we discover an account belongs to a child, we will delete it.</P>
      </Section>

      <Section title="Changes to this policy">
        <P>We will notify you in-app of any material changes. Continued use of the app after a change indicates acceptance of the updated policy.</P>
      </Section>

      <Section title="Contact">
        <P>Questions? Reach us at sricharan.rayala@dotportion.com.</P>
      </Section>
    </ScrollView>
  );
}
