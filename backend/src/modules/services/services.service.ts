import { prisma } from '../../core/db/prisma';
import { SLOT_MINUTES } from '../../config';
import { notFound, validationError } from '../../core/http/errors';
import { toService } from '../../core/http/mappers';
import type { Service } from '../../core/http/contract';

const validateDuration = (duration: number): void => {
  if (duration <= 0 || duration % SLOT_MINUTES !== 0) {
    throw validationError('Invalid duration', [
      {
        field: 'durationMinutes',
        message: `Must be a positive multiple of ${SLOT_MINUTES} minutes`,
      },
    ]);
  }
};

export const listServices = async (salonId: string): Promise<Service[]> => {
  const services = await prisma.service.findMany({ where: { salonId }, orderBy: { name: 'asc' } });
  return services.map(toService);
};

export interface CreateServiceInput {
  name: string;
  durationMinutes: number;
  price: number;
}

export const createService = async (
  salonId: string,
  input: CreateServiceInput,
): Promise<Service> => {
  validateDuration(input.durationMinutes);
  const svc = await prisma.service.create({
    data: {
      salonId,
      name: input.name,
      durationMinutes: input.durationMinutes,
      price: input.price,
      status: 'ACTIVE',
    },
  });
  return toService(svc);
};

export interface UpdateServiceInput {
  name?: string;
  durationMinutes?: number;
  price?: number;
  status?: 'ACTIVE' | 'INACTIVE';
}

export const updateService = async (
  salonId: string,
  id: string,
  input: UpdateServiceInput,
): Promise<Service> => {
  const existing = await prisma.service.findFirst({ where: { id, salonId } });
  if (!existing) throw notFound('Service not found');
  if (input.durationMinutes != null) validateDuration(input.durationMinutes);
  const svc = await prisma.service.update({
    where: { id },
    data: {
      ...(input.name != null ? { name: input.name } : {}),
      ...(input.durationMinutes != null ? { durationMinutes: input.durationMinutes } : {}),
      ...(input.price != null ? { price: input.price } : {}),
      ...(input.status != null ? { status: input.status } : {}),
    },
  });
  return toService(svc);
};

export const deleteService = async (salonId: string, id: string): Promise<void> => {
  const existing = await prisma.service.findFirst({ where: { id, salonId } });
  if (!existing) throw notFound('Service not found');
  await prisma.service.delete({ where: { id } });
};
