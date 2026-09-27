import type { Prisma } from '@prisma/client';
import { prisma } from '../../core/db/prisma';
import { toCustomer } from '../../core/http/mappers';
import type { Customer } from '../../core/http/contract';

export interface CreateCustomerInput {
  name: string;
  phone: string;
  email?: string;
}

/**
 * Resolve an existing customer by (salonId, phone) or create a new one.
 * Dedupe by phone means a duplicate create returns the existing record rather
 * than erroring (matches the mock, Req 9.3). Accepts an optional transaction
 * client so booking creation can reuse it inside its serializable transaction.
 */
export const resolveOrCreateCustomer = async (
  salonId: string,
  input: CreateCustomerInput,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<Customer> => {
  const existing = await client.customer.findUnique({
    where: { salonId_phone: { salonId, phone: input.phone } },
  });
  if (existing) return toCustomer(existing);
  const created = await client.customer.create({
    data: { salonId, name: input.name, phone: input.phone, email: input.email ?? null },
  });
  return toCustomer(created);
};

export const searchCustomers = async (salonId: string, search: string): Promise<Customer[]> => {
  const q = search.trim();
  const customers = await prisma.customer.findMany({
    where: {
      salonId,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { name: 'asc' },
  });
  return customers.map(toCustomer);
};

export const createCustomer = async (
  salonId: string,
  input: CreateCustomerInput,
): Promise<Customer> => resolveOrCreateCustomer(salonId, input);
