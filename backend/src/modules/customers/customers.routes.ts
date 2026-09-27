import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../core/http/asyncHandler';
import { validateBody, validateQuery, getValidatedQuery } from '../../core/middleware/validate';
import { authenticate } from '../../core/middleware/authenticate';
import { requireSalonRole } from '../../core/middleware/authorize';
import { salonIdOf } from '../../core/middleware/tenantContext';
import * as customersService from './customers.service';

const searchSchema = z.object({ search: z.string().optional() });

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional(),
});

export const customersRouter = Router();

customersRouter.use(authenticate, requireSalonRole);

// GET /customers?search=
customersRouter.get(
  '/',
  validateQuery(searchSchema),
  asyncHandler(async (req, res) => {
    const { search } = getValidatedQuery<z.infer<typeof searchSchema>>(req);
    res.status(200).json(await customersService.searchCustomers(salonIdOf(req), search ?? ''));
  }),
);

// POST /customers — dedupe by (salonId, phone)
customersRouter.post(
  '/',
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;
    res.status(201).json(await customersService.createCustomer(salonIdOf(req), body));
  }),
);
