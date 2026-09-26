import type { Role } from '@/core/api/types';

export interface NavItem {
  to: string;
  label: string;
  roles: Role[];
}

/** Role-aware navigation. Order matters for the sidebar. */
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', roles: ['OWNER', 'MANAGER', 'RECEPTIONIST'] },
  { to: '/bookings', label: 'Bookings', roles: ['OWNER', 'MANAGER', 'RECEPTIONIST'] },
  { to: '/bookings/new', label: 'New Booking', roles: ['OWNER', 'MANAGER', 'RECEPTIONIST'] },
  { to: '/availability', label: 'Availability', roles: ['OWNER', 'MANAGER', 'RECEPTIONIST'] },
  { to: '/customers', label: 'Customers', roles: ['OWNER', 'MANAGER', 'RECEPTIONIST'] },
  { to: '/employees', label: 'Professionals', roles: ['OWNER', 'MANAGER'] },
  { to: '/services', label: 'Services', roles: ['OWNER', 'MANAGER'] },
  { to: '/salon', label: 'Salon Settings', roles: ['OWNER', 'MANAGER'] },
  { to: '/platform/salons', label: 'Salons', roles: ['SUPER_ADMIN'] },
];

export const navItemsForRole = (role: Role): NavItem[] =>
  NAV_ITEMS.filter((item) => item.roles.includes(role));
