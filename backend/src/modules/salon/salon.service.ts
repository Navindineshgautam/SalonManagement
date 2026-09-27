import { prisma } from '../../core/db/prisma';
import { hashPassword } from '../../core/auth/password';
import { forbidden, notFound, validationError } from '../../core/http/errors';
import { toSalon, toSalonUser } from '../../core/http/mappers';
import { isValidTimezone } from '../../shared/time/timezone';
import type { Role, Salon, SalonUser } from '../../core/http/contract';

export const getSalon = async (salonId: string): Promise<Salon> => {
  const salon = await prisma.salon.findUnique({ where: { id: salonId } });
  if (!salon) throw notFound('Salon not found');
  return toSalon(salon);
};

export interface UpdateSalonInput {
  name: string;
  timezone: string;
  contactPhone?: string;
  contactEmail?: string;
}

export const updateSalon = async (salonId: string, input: UpdateSalonInput): Promise<Salon> => {
  const salon = await prisma.salon.findUnique({ where: { id: salonId } });
  if (!salon) throw notFound('Salon not found');
  if (!isValidTimezone(input.timezone)) {
    throw validationError('Invalid timezone', [
      { field: 'timezone', message: 'Unknown timezone' },
    ]);
  }
  const updated = await prisma.salon.update({
    where: { id: salonId },
    data: {
      name: input.name,
      timezone: input.timezone,
      contactPhone: input.contactPhone ?? null,
      contactEmail: input.contactEmail ?? null,
    },
  });
  return toSalon(updated);
};

export const listSalonUsers = async (salonId: string): Promise<SalonUser[]> => {
  const users = await prisma.user.findMany({
    where: { salonId, role: { not: 'SUPER_ADMIN' } },
    orderBy: { createdAt: 'asc' },
  });
  return users.map(toSalonUser);
};

export interface CreateSalonUserInput {
  name: string;
  email: string;
  password: string;
  role: 'MANAGER' | 'RECEPTIONIST';
}

export const createSalonUser = async (
  salonId: string,
  actorRole: Role,
  input: CreateSalonUserInput,
): Promise<SalonUser> => {
  // Managers may only create receptionists.
  if (actorRole === 'MANAGER' && input.role !== 'RECEPTIONIST') {
    throw forbidden('Managers can only create receptionists');
  }
  const existing = await prisma.user.findFirst({
    where: { email: { equals: input.email, mode: 'insensitive' } },
  });
  if (existing) {
    throw validationError('Email already in use', [
      { field: 'email', message: 'This email is already registered' },
    ]);
  }
  const passwordHash = await hashPassword(input.password);
  const created = await prisma.user.create({
    data: {
      salonId,
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
      status: 'ACTIVE',
    },
  });
  return toSalonUser(created);
};

export interface UpdateSalonUserInput {
  name?: string;
  role?: 'MANAGER' | 'RECEPTIONIST';
  status?: 'ACTIVE' | 'INACTIVE';
}

export const updateSalonUser = async (
  salonId: string,
  actorRole: Role,
  id: string,
  input: UpdateSalonUserInput,
): Promise<SalonUser> => {
  const user = await prisma.user.findFirst({ where: { id, salonId } });
  // Cross-tenant or super admin => indistinguishable from not found.
  if (!user || user.role === 'SUPER_ADMIN') throw notFound('User not found');
  // Managers cannot manage owners nor promote anyone to manager.
  if (actorRole === 'MANAGER' && (user.role === 'OWNER' || input.role === 'MANAGER')) {
    throw forbidden('Managers cannot manage owners or promote to manager');
  }
  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(input.name != null ? { name: input.name } : {}),
      ...(input.role != null ? { role: input.role } : {}),
      ...(input.status != null ? { status: input.status } : {}),
    },
  });
  return toSalonUser(updated);
};

export const deleteSalonUser = async (salonId: string, id: string): Promise<void> => {
  const user = await prisma.user.findFirst({ where: { id, salonId } });
  if (!user || user.role === 'SUPER_ADMIN') throw notFound('User not found');
  if (user.role === 'OWNER') throw forbidden('Cannot delete the owner');
  await prisma.user.delete({ where: { id } });
};
