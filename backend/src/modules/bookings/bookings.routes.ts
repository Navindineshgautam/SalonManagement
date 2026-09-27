import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../core/http/asyncHandler';
import { validateBody, validateQuery, getValidatedQuery } from '../../core/middleware/validate';
import { authenticate, requirePrincipal } from '../../core/middleware/authenticate';
import { requireSalonRole } from '../../core/middleware/authorize';
import { salonIdOf } from '../../core/middleware/tenantContext';
import * as bookingsService from './bookings.service';

const createSchema = z
  .object({
    customerId: z.string().optional(),
    customer: z
      .object({
        name: z.string().min(1),
        phone: z.string().min(1),
        email: z.string().email().optional(),
      })
      .optional(),
    startAt: z.string().datetime({ offset: true }),
    items: z
      .array(
        z.object({
          serviceId: z.string().min(1),
          employeeId: z.string().min(1),
        }),
      )
      .min(1),
  })
  .refine((v) => v.customerId || v.customer, {
    message: 'Provide an existing customer or new customer info',
    path: ['customer'],
  });

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

const listSchema = z.object({
  from: dateSchema,
  to: dateSchema,
  employeeId: z.string().optional(),
});

export const bookingsRouter = Router();

bookingsRouter.use(authenticate, requireSalonRole);

// POST /bookings — concurrency-safe create
bookingsRouter.post(
  '/',
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const principal = requirePrincipal(req);
    const body = req.body as z.infer<typeof createSchema>;
    const booking = await bookingsService.createBooking(salonIdOf(req), principal.userId, body);
    res.status(201).json(booking);
  }),
);

// GET /bookings?from=&to=&employeeId=
bookingsRouter.get(
  '/',
  validateQuery(listSchema),
  asyncHandler(async (req, res) => {
    const query = getValidatedQuery<z.infer<typeof listSchema>>(req);
    res.status(200).json(await bookingsService.listBookings(salonIdOf(req), query));
  }),
);

// GET /bookings/:id
bookingsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.status(200).json(await bookingsService.getBooking(salonIdOf(req), req.params.id));
  }),
);
