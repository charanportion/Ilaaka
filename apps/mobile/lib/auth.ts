import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
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

// Flow A (web): same-window redirect — no popup so browsers don't block it.
// Supabase redirects the page to Google, then back to /auth-callback with tokens
// in the URL hash. detectSessionInUrl:true in supabase.ts auto-processes them.
//
// Flow B (native/Expo Go): WebBrowser custom tab. Switch to signInWithGoogleNative
// once a dev build with @react-native-google-signin/google-signin is prebuilt.
export async function signInWithGoogleWeb() {
  if (Platform.OS === 'web') {
    const redirectTo = typeof window !== 'undefined'
      ? `${window.location.origin}/auth-callback`
      : Linking.createURL('auth-callback');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
      // no skipBrowserRedirect — Supabase navigates the current page to Google
    });
    if (error) throw error;
    return; // browser is now redirecting to Google; nothing more to do here
  }

  // Native: open Google OAuth in an in-app browser tab
  const redirectTo = Linking.createURL('auth-callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url!, redirectTo);
  if (result.type !== 'success') throw new Error('OAuth cancelled');

  const url = new URL(result.url);
  const params = new URLSearchParams(url.hash.slice(1));
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) throw new Error('Missing tokens in redirect');

  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });
  if (sessionError) throw sessionError;
  return sessionData;
}
