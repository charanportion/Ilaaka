# Auth

## Locked decisions

- **Provider:** Supabase Auth (built into the Supabase project — no extra service).
- **Methods in v0:** Google OAuth + email/password. Phone OTP deferred to v1.
- **Session storage on mobile:** `expo-secure-store` via the supabase-js storage adapter.
- **JWT lifetime:** 1 hour access token, refresh token rotates. `supabase-js` handles the refresh automatically.
- **Email confirmation:** OFF in v0 (closed beta, friction reduction). ON before public launch.

## Supabase project setup

1. Create a project at supabase.com (free tier).
2. **Authentication → Providers**:
   - **Email**: enabled. Toggle off "Confirm email" for v0.
   - **Google**: enabled (config below).
3. **Authentication → URL Configuration**:
   - Site URL: `ilaaka://` (mobile deep link)
   - Redirect URLs: add `ilaaka://auth-callback`
4. **Database → Extensions**: enable `postgis`, `h3`, `h3_postgis`, `pg_cron`.

## Google OAuth — GCP console setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Create a project named `ilaaka` (free).
3. **APIs & Services → OAuth consent screen**:
   - User type: **External**.
   - App name: `Ilaaka`.
   - User support email: yours.
   - Scopes: add `userinfo.email`, `userinfo.profile`, `openid` (the defaults).
   - Test users: add your dev email + a few beta testers.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - You'll create **three** clients:

| Type | Used for | Where the ID/secret goes |
| --- | --- | --- |
| **Web application** | The Supabase callback flow (used by `signInWithOAuth`) | Pasted into Supabase Auth → Providers → Google |
| **iOS** | Native sign-in on iOS dev builds | Passed to `@react-native-google-signin/google-signin` |
| **Android** | Native sign-in on Android dev builds | Same |

For the **Web** client:
- **Authorized redirect URIs**: `https://<your-project-ref>.supabase.co/auth/v1/callback` (find this in Supabase dashboard → Authentication → Providers → Google).

For the **iOS** client:
- Bundle ID: `com.sricharan.ilaaka` (or whatever you set in `app.json`).
- No secret (iOS clients are public).

For the **Android** client:
- Package name: `com.sricharan.ilaaka`.
- SHA-1 certificate fingerprint: `eas credentials` → Android → fetch the SHA-1 from your keystore.

5. Paste the **Web** client ID and secret into Supabase: **Authentication → Providers → Google** → enable, save.

## Mobile — Supabase client setup

```typescript
// apps/mobile/lib/supabase.ts
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,    // we handle deep links manually
    },
  },
);

// Tell Supabase to refresh tokens when the app comes back to foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
```

Required packages:

```bash
pnpm add @supabase/supabase-js react-native-url-polyfill expo-secure-store
```

## Email/password flows

Signup, sign-in, and sign-out:

```typescript
// apps/mobile/lib/auth.ts
import { supabase } from './supabase';

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}
```

## Google OAuth — two flows

### Flow A: web redirect (Expo Go-compatible, dev iteration)

Use this while you're still iterating in Expo Go. Opens an in-app browser, user picks a Google account, redirects back via deep link.

```typescript
// apps/mobile/lib/auth.ts
import { supabase } from './supabase';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

export async function signInWithGoogleWeb() {
  const redirectTo = Linking.createURL('auth-callback');     // ilaaka://auth-callback

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') throw new Error('OAuth cancelled');

  // The URL contains the access_token in its hash — extract and set the session.
  const url = new URL(result.url);
  const params = new URLSearchParams(url.hash.slice(1));     // hash starts with #
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) throw new Error('Missing tokens');

  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });
  if (sessionError) throw sessionError;
  return sessionData;
}
```

Required packages:

```bash
pnpm add expo-linking expo-web-browser
```

`app.json` must declare the scheme:

```json
{
  "expo": {
    "scheme": "ilaaka"
  }
}
```

### Flow B: native ID token (production-quality, requires dev build)

Switch to this once you've run `npx expo prebuild`. Native Sign-in with Google sheet, returns an ID token, exchanged with Supabase. This is the flow you ship in v0 release builds.

```typescript
// apps/mobile/lib/auth.ts
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase } from './supabase';

GoogleSignin.configure({
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID!,
  // androidClientId is auto-detected from google-services.json (EAS handles this)
  scopes: ['openid', 'profile', 'email'],
});

export async function signInWithGoogleNative() {
  await GoogleSignin.hasPlayServices();
  const userInfo = await GoogleSignin.signIn();
  const idToken = userInfo.data?.idToken;
  if (!idToken) throw new Error('No ID token from Google');

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });
  if (error) throw error;
  return data;
}
```

Required packages and config:

```bash
pnpm add @react-native-google-signin/google-signin
```

```json
// app.json
{
  "expo": {
    "scheme": "ilaaka",
    "ios": {
      "bundleIdentifier": "com.sricharan.ilaaka",
      "googleServicesFile": "./GoogleService-Info.plist"
    },
    "android": {
      "package": "com.sricharan.ilaaka",
      "googleServicesFile": "./google-services.json"
    },
    "plugins": [
      "@react-native-google-signin/google-signin"
    ]
  }
}
```

Download `GoogleService-Info.plist` (iOS) and `google-services.json` (Android) from the Firebase / GCP console for the matching bundle ID and place them at the project root.

## Session — auth gate pattern

```typescript
// apps/mobile/app/_layout.tsx (Expo Router root)
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoaded(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const inAuth = segments[0] === '(auth)';
    if (!session && !inAuth) router.replace('/(auth)/sign-in');
    else if (session && inAuth) router.replace('/(app)/map');
  }, [session, loaded, segments]);

  if (!loaded) return null;
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

## RLS — using `auth.uid()`

In any RLS policy, `auth.uid()` returns the JWT-bound user's UUID. Pattern:

```sql
create policy "<table>_read_own" on public.<table>
  for select using (auth.uid() = user_id);

create policy "<table>_write_own" on public.<table>
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

If you ever need to bypass RLS (e.g., the Edge Function writing zone ownership on behalf of a user), use the **service role key** in a server-side context. Never ship the service role key to the client.

## Dev vs prod checklist before public launch

- [ ] Email confirmation enabled.
- [ ] Custom email templates (Auth → Email Templates) — the default Supabase ones say "powered by Supabase".
- [ ] OAuth consent screen moved from "Testing" to "In production" in GCP (this enables sign-in for non-test users).
- [ ] Site URL and redirect URLs match the production app build's deep link scheme.
- [ ] Rate limits on Auth → Rate Limits set tighter than the Supabase defaults.
- [ ] At least one alternative way to recover an account (password reset email working, both for email/password users and Google users).
