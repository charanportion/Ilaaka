import PostHog from 'posthog-react-native';

let _client: PostHog | null = null;

export function initAnalytics() {
  const apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
  if (!apiKey) return;
  try {
    _client = new PostHog(apiKey, { host: 'https://app.posthog.com' });
  } catch {
    // PostHog unavailable in this environment — skip
  }
}

type JsonValue = string | number | boolean | null;
type EventProperties = Record<string, JsonValue | JsonValue[]>;

export function capture(event: string, properties?: EventProperties) {
  _client?.capture(event, properties);
}
