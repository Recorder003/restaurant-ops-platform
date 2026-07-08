import type { User } from '../../types';

export function getWorkspaceLayoutClassName(role: User['role']) {
  if (role === 'chef') {
    return 'layout kitchen-layout';
  }

  if (role === 'staff') {
    return 'layout staff-layout';
  }

  return 'layout';
}
