# Ilaaka — Android release runbook

Audience: whoever ships an APK / AAB to the Play Store. Read top to bottom the first time, then use as a checklist.

---

## One-time setup (before the first production build)

### 1. Generate the production keystore

```bash
keytool -genkey -v \
  -keystore ilaaka-release.keystore \
  -alias ilaaka \
  -keyalg RSA -keysize 2048 -validity 10000
```

You'll be prompted for two passwords (store + key) — record them in a password manager. **You cannot rotate this keystore on the Play Store.** If lost, the app must be republished under a new package name.

### 2. Upload to EAS (recommended)

```bash
cd apps/mobile
eas credentials
# Choose: Android → production → Keystore → Upload
```

EAS now signs every `eas build --profile production` automatically.

### 3. Local signing fallback (only for emergency builds)

Add to `~/.gradle/gradle.properties` (NOT in the repo):

```properties
ILAAKA_RELEASE_STORE_FILE=/abs/path/to/ilaaka-release.keystore
ILAAKA_RELEASE_STORE_PASSWORD=...
ILAAKA_RELEASE_KEY_ALIAS=ilaaka
ILAAKA_RELEASE_KEY_PASSWORD=...
```

`apps/mobile/android/app/build.gradle` reads these at build time. If they're missing, release builds fall back to the debug keystore and emit a loud warning. Such APKs are NOT installable on devices that already have a real production build.

### 4. Rotate the Firebase API key

The historical `apps/mobile/google-services.json` was committed and is now in git history. Treat the API key in there as compromised:

1. Firebase Console → Project Settings → General → Web API Key → restrict it to package `com.dotportion.ilaaka` and the production keystore SHA-1.
2. Download a fresh `google-services.json` and place it at `apps/mobile/google-services.json`.
3. The file is now in `.gitignore`. Distribute via EAS:
   ```bash
   eas secret:create --scope project --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json
   ```

### 5. Supabase OAuth redirect URLs

Supabase dashboard → Auth → URL Configuration → Additional Redirect URLs must include:

```
ilaaka://auth-callback
exp+ilaaka://auth-callback     (optional, for dev builds)
```

Without these, Google sign-in fails with `redirect_to is not allowed` on the production APK.

### 6. Edge Function secrets

```bash
supabase secrets set MAPBOX_TOKEN=pk.xxxxxx
supabase secrets set CORS_ALLOWED_ORIGINS=https://your-marketing-site.com
# DEBUG_MATCH=1 only when actively debugging map matching; leave unset in prod.
```

### 7. Apply the security migration

```bash
supabase db push          # applies 0029_security_hardening.sql
supabase functions deploy submit-activity
supabase functions deploy weekly-stats
```

### 8. Privacy policy + Play Store data safety

Play Store requires a public privacy policy URL for any app collecting location.

- Host the contents of `apps/mobile/app/(app)/legal/privacy.tsx` (or a converted version) at a stable HTTPS URL.
- Play Console → App Content → Data Safety: declare precise location (used + shared with friends), photos (used), email (auth), device ID (push), HTTPS in transit, and "users can request deletion" once the deletion flow ships.

---

## Per-release checklist

Run before every `eas submit`:

```bash
cd apps/mobile

# 1. Static checks
pnpm verify        # typecheck + lint

# 2. Bump version in app.json
#    "version": "1.0.x"  → bumped manually for marketing
#    versionCode is auto-incremented by EAS Build (see eas.json autoIncrement: true)

# 3. Build
pnpm build:android   # equivalent to: eas build --platform android --profile production
```

EAS will:

- inject the keystore + Google services file from secrets
- run R8 / minify (because `android.enableMinifyInReleaseBuilds=true` in gradle.properties)
- output a signed AAB

Smoke-test on a physical Android device (GPS needs hardware):

- [ ] Sign in via Google
- [ ] Onboarding → permissions → record a 5-min walk
- [ ] Save with title + photo → see in feed
- [ ] Tap activity → like + comment
- [ ] Friends search + follow
- [ ] Sign out → sign in as different user → verify no data leak (SQLite cleared on sign-out)
- [ ] Airplane mode → open feed → see the error state with retry, not a frozen spinner
- [ ] Background app for 60s mid-record, foreground → trace continues

Then:

```bash
pnpm submit:android      # eas submit --platform android --latest
```

---

## OTA updates (no Play Store round-trip)

For JS-only changes (bug fixes, copy edits):

```bash
eas update --channel production --message "Fix feed crash"
```

Requires no version bump if `runtimeVersion.policy = "appVersion"` (already set in `app.json`). If the change touches native code or app config, ship a new build instead.

Rollback:

```bash
eas channel:edit production --branch <previous-branch>
```

---

## Emergency procedures

### Revoke a leaked secret

- **Supabase service role key**: Dashboard → Settings → API → Reset service_role JWT secret. Then `supabase secrets set` and redeploy Edge Functions, and invalidate any pg_cron jobs that hold the old key.
- **Mapbox token**: Mapbox account → Tokens → revoke + create new → `supabase secrets set MAPBOX_TOKEN=...` → `supabase functions deploy submit-activity`.
- **Firebase API key**: Firebase Console → revoke + regenerate. Update `google-services.json` in EAS secrets and ship a new build (no OTA possible).

### Rate-limit a runaway user

```sql
-- Block all submits for 7 days
update public.submit_rate_limit
set window_start = now() - interval '7 days', count_in_window = 999
where user_id = '...';
```

### Rollback a bad migration

```bash
supabase migration repair <version> --status reverted
# Then write a forward-fix migration; never edit deployed migration files in place.
```

---

## Files that must NEVER be committed

- `apps/mobile/google-services.json` — Firebase API key
- `apps/mobile/.env`, `supabase/.env.local` — anon/service keys
- `*.keystore`, `*.jks` — production signing material (debug.keystore is fine)
- `apps/mobile/android/app/google-services.json` — copy generated by Expo plugin

`.gitignore` already lists all of these. If `git status` shows any of them tracked, run `git rm --cached <file>` immediately.
