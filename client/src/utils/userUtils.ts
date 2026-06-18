import type { User } from '../types';

const protectedDefaultUserEmails = new Set(['admin@example.com', 'staff@example.com', 'chef@example.com']);

export function isProtectedDefaultUser(user: User) {
  return protectedDefaultUserEmails.has(user.email);
}
