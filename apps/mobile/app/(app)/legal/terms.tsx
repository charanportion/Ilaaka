import { ScrollView, View, Text } from 'react-native';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-6">
      <Text className="text-base font-semibold text-gray-900 mb-2">{title}</Text>
      {children}
    </View>
  );
}

function P({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Text className={`text-sm text-gray-700 leading-6 mb-2 ${className ?? ''}`}>{children}</Text>;
}

function Bullet({ children }: { children: React.ReactNode }) {
  return <Text className="text-sm text-gray-700 leading-6 mb-1">• {children}</Text>;
}

export default function TermsScreen() {
  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 24 }}>
      <Text className="text-2xl font-bold text-gray-900 mb-2">Terms of Service</Text>
      <Text className="text-xs text-gray-400 mb-6">Last updated: April 2026</Text>

      <Section title="Your account">
        <P>
          You must be at least 13 years old to use Ilaaka. You are responsible for keeping your password confidential and for all activity that happens under your account.
        </P>
        <P>
          You may register only one account per person. Sharing accounts or operating multiple accounts to gain a competitive advantage is prohibited.
        </P>
      </Section>

      <Section title="Acceptable use">
        <P>
          You agree not to use Ilaaka to:
        </P>
        <Bullet>Submit falsified or simulated GPS data.</Bullet>
        <Bullet>Harass, threaten, or stalk other users.</Bullet>
        <Bullet>Reverse engineer, scrape, or place undue load on our servers.</Bullet>
        <Bullet>Violate any law or regulation in your jurisdiction.</Bullet>
        <P className="mt-2">
          We reserve the right to suspend or terminate accounts that violate these rules, including erasing their territories and activity history.
        </P>
      </Section>

      <Section title="Outdoor safety">
        <P>
          Ilaaka encourages outdoor movement. You are solely responsible for your own safety while using the app. Pay attention to your surroundings, follow traffic rules, and do not record activities in places that are unsafe or off-limits to you. Do not use the app while driving.
        </P>
      </Section>

      <Section title="Your content">
        <P>
          You retain ownership of your activity data. By using Ilaaka, you grant us a non-exclusive license to store, process, and display that data as required to operate the service (for example, to render your territory on the maps of users who can see it).
        </P>
      </Section>

      <Section title="Changes to the service">
        <P>
          Features, scoring rules, zone expiry timing, and other game mechanics may change as we iterate. We may add, remove, or modify any feature at any time. Where reasonable, we will notify you of major changes in-app.
        </P>
      </Section>

      <Section title="Disclaimer of warranty">
        <P>
          Ilaaka is provided &quot;as is&quot; without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, or non-infringement. We do not guarantee uninterrupted service.
        </P>
      </Section>

      <Section title="Limitation of liability">
        <P>
          To the maximum extent permitted by law, Ilaaka and its operators are not liable for any indirect, incidental, or consequential damages arising from your use of the app, including but not limited to physical injury, lost data, or loss of competitive standing in the app.
        </P>
      </Section>

      <Section title="Termination">
        <P>
          You may delete your account at any time by emailing sricharan.rayala@dotportion.com. We may suspend or terminate your access immediately if you violate these terms. Upon termination, your activities and zones will be deleted in line with our Privacy Policy.
        </P>
      </Section>

      <Section title="Governing law">
        <P>
          These terms are governed by the laws of India. Any disputes will be subject to the exclusive jurisdiction of the courts in Hyderabad, Telangana.
        </P>
      </Section>

      <Section title="Contact">
        <P>For questions about these terms, email sricharan.rayala@dotportion.com.</P>
      </Section>
    </ScrollView>
  );
}
