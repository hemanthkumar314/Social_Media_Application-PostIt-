import { UsernameValidation } from '@/lib/validation';

// Reserve the canonical username atomically using Appwrite Auth's unique user ID.
// A server function resolves it to the private recovery email for password login.
export function usernameToAccountId(username: string) {
  return 'u_' + UsernameValidation.parse(username);
}

// Keep existing username-only accounts usable while the email backend is staged.
export function usernameToLegacyEmail(username: string) {
  return UsernameValidation.parse(username) + '@users.postit.invalid';
}
