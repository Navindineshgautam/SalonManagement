/**
 * Seed script — mirrors the frontend mock seed (`frontend/src/core/api/mock/seed.ts`)
 * so the real backend has demo parity with the mock: one SUPER_ADMIN, one salon
 * (Glow & Go, Asia/Kolkata) with owner/manager/receptionist, three employees
 * with skills + schedules, six services, two customers.
 *
 * Idempotent: clears salon-scoped data and re-inserts on each run.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PASSWORD = 'password';

const fullWeekHours = (startMinute: number, endMinute: number) =>
  [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinute, endMinute }));

const lunchBreaks = () =>
  [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinute: 780, endMinute: 840 }));

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  // Clean slate (order respects FK constraints).
  await prisma.bookingItem.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.employeeService.deleteMany();
  await prisma.workingHour.deleteMany();
  await prisma.break.deleteMany();
  await prisma.leave.deleteMany();
  await prisma.scheduleOverride.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.service.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.salon.deleteMany();

  // Salon
  const salon = await prisma.salon.create({
    data: {
      name: 'Glow & Go Salon',
      timezone: 'Asia/Kolkata',
      contactPhone: '+91 98765 43210',
      contactEmail: 'hello@glowandgo.example',
      status: 'ACTIVE',
    },
  });

  // Users
  await prisma.user.create({
    data: {
      salonId: null,
      name: 'Platform Admin',
      email: 'super@platform.example',
      passwordHash,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });
  await prisma.user.createMany({
    data: [
      {
        salonId: salon.id,
        name: 'Olivia Owner',
        email: 'owner@glowandgo.example',
        passwordHash,
        role: 'OWNER',
        status: 'ACTIVE',
      },
      {
        salonId: salon.id,
        name: 'Manish Manager',
        email: 'manager@glowandgo.example',
        passwordHash,
        role: 'MANAGER',
        status: 'ACTIVE',
      },
      {
        salonId: salon.id,
        name: 'Riya Receptionist',
        email: 'reception@glowandgo.example',
        passwordHash,
        role: 'RECEPTIONIST',
        status: 'ACTIVE',
      },
    ],
  });

  // Services (stable keys used to wire employee skills)
  const serviceDefs = [
    { key: 'haircut', name: 'Haircut', durationMinutes: 45, price: 500 },
    { key: 'color', name: 'Hair Color', durationMinutes: 90, price: 2500 },
    { key: 'shave', name: 'Shave & Beard', durationMinutes: 30, price: 300 },
    { key: 'mani', name: 'Manicure', durationMinutes: 45, price: 700 },
    { key: 'pedi', name: 'Pedicure', durationMinutes: 60, price: 900 },
    { key: 'facial', name: 'Facial', durationMinutes: 60, price: 1500 },
  ];
  const serviceIdByKey: Record<string, string> = {};
  for (const def of serviceDefs) {
    const svc = await prisma.service.create({
      data: {
        salonId: salon.id,
        name: def.name,
        durationMinutes: def.durationMinutes,
        price: def.price,
        status: 'ACTIVE',
      },
    });
    serviceIdByKey[def.key] = svc.id;
  }

  // Employees with skills + schedules
  const employeeDefs = [
    {
      name: 'Arya Stylist',
      phone: '+91 90000 00001',
      email: 'arya@glowandgo.example',
      role: 'Senior Stylist',
      specialization: 'Hair',
      serviceKeys: ['haircut', 'color', 'shave'],
      weeklyOff: 0, // Sunday
      workingHours: fullWeekHours(600, 1140), // 10:00-19:00
    },
    {
      name: 'Kabir Barber',
      phone: '+91 90000 00002',
      email: 'kabir@glowandgo.example',
      role: 'Barber',
      specialization: 'Grooming',
      serviceKeys: ['haircut', 'shave'],
      weeklyOff: 2, // Tuesday
      workingHours: fullWeekHours(540, 1080), // 09:00-18:00
    },
    {
      name: 'Meera Beautician',
      phone: '+91 90000 00003',
      email: 'meera@glowandgo.example',
      role: 'Beautician',
      specialization: 'Nails & Skin',
      serviceKeys: ['mani', 'pedi', 'facial'],
      weeklyOff: 1, // Monday
      workingHours: fullWeekHours(600, 1200), // 10:00-20:00
    },
  ];
  for (const def of employeeDefs) {
    await prisma.employee.create({
      data: {
        salonId: salon.id,
        name: def.name,
        phone: def.phone,
        email: def.email,
        role: def.role,
        specialization: def.specialization,
        weeklyOff: def.weeklyOff,
        status: 'ACTIVE',
        employeeServices: {
          create: def.serviceKeys.map((k) => ({ serviceId: serviceIdByKey[k] })),
        },
        workingHours: { create: def.workingHours },
        breaks: { create: lunchBreaks() },
      },
    });
  }

  // Customers
  await prisma.customer.createMany({
    data: [
      {
        salonId: salon.id,
        name: 'Neha Sharma',
        phone: '+91 99111 11111',
        email: 'neha@example.com',
      },
      { salonId: salon.id, name: 'Rahul Verma', phone: '+91 99222 22222' },
    ],
  });

  // eslint-disable-next-line no-console
  console.log('Seed complete: salon', salon.id);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
