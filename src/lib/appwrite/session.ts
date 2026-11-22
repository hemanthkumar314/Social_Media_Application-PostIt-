import { AppwriteException, Models } from 'appwrite';
import { account, appwriteConfig } from './config';

function fallbackCookies(): Record<string, string> {
  const raw = window.localStorage.getItem('cookieFallback');
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid cookie store');
    const entries = Object.entries(parsed);
    const cookies = Object.fromEntries(entries.filter(([, value]) => typeof value === 'string'));
    if (Object.keys(cookies).length !== entries.length) {
      window.localStorage.setItem('cookieFallback', JSON.stringify(cookies));
    }
    return cookies;
  } catch {
    window.localStorage.setItem('cookieFallback', '{}');
    return {};
  }
}

export function normalizeFallbackSession() { fallbackCookies(); }

export function clearFallbackSession() {
  const cookies = fallbackCookies();
  delete cookies[`a_session_${appwriteConfig.projectId}`];
  delete cookies[`a_session_${appwriteConfig.projectId}_legacy`];
  window.localStorage.setItem('cookieFallback', JSON.stringify(cookies));
}

// The function's session authenticates this one handoff only. Let the browser
// establish its own SDK session afterward, replacing any expired HttpOnly cookie.
// Reading the email here returns only the authenticated member's own Auth data.
export async function establishBrowserSession(session: string, password: string): Promise<Models.Session> {
  const endpoint = appwriteConfig.url.replace(/\/$/, '');
  const headers = {
    'X-Appwrite-Project': appwriteConfig.projectId,
    'X-Fallback-Cookies': JSON.stringify({[`a_session_${appwriteConfig.projectId}`]: session}),
  };
  let email: string | undefined;
  let failure: unknown;
  try {
    const response = await fetch(`${endpoint}/account`, {
      headers, credentials: 'omit', signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new AppwriteException('Unable to establish your sign-in session. Please try again.', response.status);
    const user = await response.json() as {email?: unknown};
    if (typeof user.email !== 'string' || !user.email) throw new AppwriteException('Sign-in service is temporarily unavailable.', 503);
    email = user.email;
  } catch (error) {
    failure = error;
  }
  // Always close the temporary session without masking an earlier auth error.
  // Its credential is never persisted.
  try {
    const closed = await fetch(`${endpoint}/account/sessions/current`, {
      method: 'DELETE', headers, credentials: 'omit', signal: AbortSignal.timeout(15000),
    });
    if (!closed.ok && ![401, 404].includes(closed.status)) {
      failure ??= new AppwriteException('Sign-in service is temporarily unavailable. Please try again.', closed.status);
    }
  } catch (error) {
    failure ??= error;
  }
  if (failure) throw failure;
  if (!email) throw new AppwriteException('Sign-in service is temporarily unavailable.', 503);
  clearFallbackSession();
  return account.createEmailPasswordSession(email, password);
}
