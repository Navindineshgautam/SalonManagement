import { prisma } from '../../core/db/prisma';
import { hashPassword } from '../../core/auth/password';
import { validationError } from '../../core/http/errors';
import { toSalon } from '../../core/http/mappers';
import type { Salon } from '../../core/http/contract';

export interface CreateSalonInput {
  name: string;
  timezone: string;
  contactPhone?: string;
  contactEmail?: string;
  owner: { name: string; email: string; password: string };
}

/** Create a salon plus its initial OWNER user in one transaction. */
export const createSalon = async (input: CreateSalonInput): Promise<Salon> => {
  const existing = await prisma.user.findFirst({
    where: { email: { equals: input.owner.email, mode: 'insensitive' } },
  });
  if (existing) {
    throw validationError('Owner email already in use', [
      { field: 'owner.email', message: 'This email is already registered' },
    ]);
  }
  const passwordHash = await hashPassword(input.owner.password);

  const salon = await prisma.$transaction(async (tx) => {
    const created = await tx.salon.create({
      data: {
        name: input.name,
        timezone: input.timezone,
        contactPhone: input.contactPhone,
        contactEmail: input.contactEmail,
        status: 'ACTIVE',
      },
    });
    await tx.user.create({
      data: {
        salonId: created.id,
        name: input.owner.name,
        email: input.owner.email,
        passwordHash,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    return created;
  });

  return toSalon(salon);
};

export const listSalons = async (): Promise<Salon[]> => {
  const salons = await prisma.salon.findMany({ orderBy: { createdAt: 'asc' } });
  return salons.map(toSalon);
};
