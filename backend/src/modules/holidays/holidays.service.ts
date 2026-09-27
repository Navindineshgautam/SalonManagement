import { prisma } from '../../core/db/prisma';
import { conflict, notFound } from '../../core/http/errors';
import { toHoliday } from '../../core/http/mappers';
import type { Holiday } from '../../core/http/contract';

const toDate = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

export const listHolidays = async (salonId: string): Promise<Holiday[]> => {
  const holidays = await prisma.holiday.findMany({ where: { salonId }, orderBy: { date: 'asc' } });
  return holidays.map(toHoliday);
};

export const createHoliday = async (
  salonId: string,
  date: string,
  name: string,
): Promise<Holiday> => {
  const existing = await prisma.holiday.findUnique({
    where: { salonId_date: { salonId, date: toDate(date) } },
  });
  if (existing) throw conflict('A holiday already exists on this date');
  const created = await prisma.holiday.create({
    data: { salonId, date: toDate(date), name },
  });
  return toHoliday(created);
};

export const deleteHoliday = async (salonId: string, id: string): Promise<void> => {
  const existing = await prisma.holiday.findFirst({ where: { id, salonId } });
  if (!existing) throw notFound('Holiday not found');
  await prisma.holiday.delete({ where: { id } });
};
