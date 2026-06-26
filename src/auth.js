import { supabase } from './supabaseClient';

// ============================================================
// AUTH — thin wrapper around Supabase Auth.
// Replaces the old localStorage/OTP-based account system entirely.
// Sessions are persisted by supabase-js itself (in localStorage, but as an
// opaque encrypted-at-rest session token, not raw account/password data —
// this is what makes "log in from any device" work: the actual account
// record lives in Supabase, not in this browser).
// ============================================================

/**
 * Create a new account. Supabase sends a confirmation email automatically
 * if email confirmation is enabled on the project (Authentication →
 * Providers → Email → "Confirm email"). If you'd rather skip email
 * confirmation entirely (so signup logs the user in immediately), turn
 * that toggle off in the Supabase dashboard — no code change needed here.
 */
export async function signUp(email, password, name) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name }, // becomes raw_user_meta_data, read by the handle_new_user() trigger
    },
  });
  if (error) throw error;
  return data; // { user, session } — session is null if email confirmation is required
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data; // { user, session }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Sends a password-reset email with a link back to `redirectTo`. The user
 * clicks the link, lands back on your app with a recovery session, and you
 * call updatePassword() below to actually set the new password.
 *
 * IMPORTANT: redirectTo must be added to Authentication → URL Configuration
 * → Redirect URLs in the Supabase dashboard, or the link will fail.
 */
export async function sendPasswordReset(email, redirectTo) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectTo || window.location.origin,
  });
  if (error) throw error;
}

/** Call this after the user lands back on your app via the reset-password link. */
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function updateEmail(newEmail) {
  // Supabase sends a confirmation email to the NEW address; the email only
  // actually changes once the user clicks the confirmation link.
  const { error } = await supabase.auth.updateUser({ email: newEmail });
  if (error) throw error;
}

export async function updateProfileName(name) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { error } = await supabase
    .from('profiles')
    .update({ name })
    .eq('id', user.id);
  if (error) throw error;
}

/** Returns the current session (or null), reading from local storage —
 *  resolves instantly without a network call. */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

/** Fetches the profiles row for the current user (name, email, etc). */
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Subscribes to auth state changes (sign in, sign out, token refresh,
 * password recovery). Call the returned unsubscribe function on cleanup.
 */
export function onAuthStateChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return () => subscription.unsubscribe();
}
