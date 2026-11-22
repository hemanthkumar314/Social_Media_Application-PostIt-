export function signInErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  if (code === 401) return 'Incorrect username or password. Please try again.';
  if (code === 429) return 'Too many sign-in attempts. Please wait a few minutes and try again.';
  if (typeof code === 'number' && code >= 500) return 'Sign-in service is temporarily unavailable. Please try again shortly.';
  return 'Unable to sign in. Please check your connection and try again.';
}
