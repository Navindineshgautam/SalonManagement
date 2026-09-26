import type {
  Booking,
  Customer,
  Employee,
  Holiday,
  Salon,
  Service,
} from '@/core/api/types';

export interface MockUserRecord {
  id: string;
  salonId: string | null;
  name: string;
  email: string;
  password: string;
  role: 'SUPER_ADMIN' | 'OWNER' | 'MANAGER' | 'RECEPTIONIST';
  status: 'ACTIVE' | 'INACTIVE';
}

export interface MockDb {
  salons: Salon[];
  users: MockUserRecord[];
  services: Service[];
  employees: Employee[];
  customers: Customer[];
  bookings: Booking[];
  holidays: Holiday[];
}

const SALON_ID = 'salon-1';

const fullWeekHours = (startMinute: number, endMinute: number) =>
  [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinute, endMinute }));

const lunchBreaks = () =>
  [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinute: 780, endMinute: 840 })); // 13:00-14:00

/** Build a fresh seeded database (called once per adapter instance). */
export const buildSeedDb = (): MockDb => {
  const salons: Salon[] = [
    {
      id: SALON_ID,
      name: 'Glow & Go Salon',
      timezone: 'Asia/Kolkata',
      contactPhone: '+91 98765 43210',
      contactEmail: 'hello@glowandgo.example',
      status: 'ACTIVE',
    },
  ];

  const users: MockUserRecord[] = [
    {
      id: 'user-super',
      salonId: null,
      name: 'Platform Admin',
      email: 'super@platform.example',
      password: 'password',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
    {
      id: 'user-owner',
      salonId: SALON_ID,
      name: 'Olivia Owner',
      email: 'owner@glowandgo.example',
      password: 'password',
      role: 'OWNER',
      status: 'ACTIVE',
    },
    {
      id: 'user-manager',
      salonId: SALON_ID,
      name: 'Manish Manager',
      email: 'manager@glowandgo.example',
      password: 'password',
      role: 'MANAGER',
      status: 'ACTIVE',
    },
    {
      id: 'user-reception',
      salonId: SALON_ID,
      name: 'Riya Receptionist',
      email: 'reception@glowandgo.example',
      password: 'password',
      role: 'RECEPTIONIST',
      status: 'ACTIVE',
    },
  ];

  const services: Service[] = [
    { id: 'svc-haircut', salonId: SALON_ID, name: 'Haircut', durationMinutes: 45, price: 500, status: 'ACTIVE' },
    { id: 'svc-color', salonId: SALON_ID, name: 'Hair Color', durationMinutes: 90, price: 2500, status: 'ACTIVE' },
    { id: 'svc-shave', salonId: SALON_ID, name: 'Shave & Beard', durationMinutes: 30, price: 300, status: 'ACTIVE' },
    { id: 'svc-mani', salonId: SALON_ID, name: 'Manicure', durationMinutes: 45, price: 700, status: 'ACTIVE' },
    { id: 'svc-pedi', salonId: SALON_ID, name: 'Pedicure', durationMinutes: 60, price: 900, status: 'ACTIVE' },
    { id: 'svc-facial', salonId: SALON_ID, name: 'Facial', durationMinutes: 60, price: 1500, status: 'ACTIVE' },
  ];

  const employees: Employee[] = [
    {
      id: 'emp-arya',
      salonId: SALON_ID,
      name: 'Arya Stylist',
      phone: '+91 90000 00001',
      email: 'arya@glowandgo.example',
      role: 'Senior Stylist',
      specialization: 'Hair',
      status: 'ACTIVE',
      serviceIds: ['svc-haircut', 'svc-color', 'svc-shave'],
      weeklyOff: 0, // Sunday
      workingHours: fullWeekHours(600, 1140), // 10:00-19:00
      breaks: lunchBreaks(),
      leaves: [],
      overrides: [],
    },
    {
      id: 'emp-kabir',
      salonId: SALON_ID,
      name: 'Kabir Barber',
      phone: '+91 90000 00002',
      email: 'kabir@glowandgo.example',
      role: 'Barber',
      specialization: 'Grooming',
      status: 'ACTIVE',
      serviceIds: ['svc-haircut', 'svc-shave'],
      weeklyOff: 2, // Tuesday
      workingHours: fullWeekHours(540, 1080), // 09:00-18:00
      breaks: lunchBreaks(),
      leaves: [],
      overrides: [],
    },
    {
      id: 'emp-meera',
      salonId: SALON_ID,
      name: 'Meera Beautician',
      phone: '+91 90000 00003',
      email: 'meera@glowandgo.example',
      role: 'Beautician',
      specialization: 'Nails & Skin',
      status: 'ACTIVE',
      serviceIds: ['svc-mani', 'svc-pedi', 'svc-facial'],
      weeklyOff: 1, // Monday
      workingHours: fullWeekHours(600, 1200), // 10:00-20:00
      breaks: lunchBreaks(),
      leaves: [],
      overrides: [],
    },
  ];

  const customers: Customer[] = [
    { id: 'cust-1', salonId: SALON_ID, name: 'Neha Sharma', phone: '+91 99111 11111', email: 'neha@example.com' },
    { id: 'cust-2', salonId: SALON_ID, name: 'Rahul Verma', phone: '+91 99222 22222' },
  ];

  const bookings: Booking[] = [];
  const holidays: Holiday[] = [];

  return { salons, users, services, employees, customers, bookings, holidays };
};

export const SEED_SALON_ID = SALON_ID;
