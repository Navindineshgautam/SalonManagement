import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../core/http/asyncHandler';
import { validateBody } from '../../core/middleware/validate';
import { authenticate } from '../../core/middleware/authenticate';
import { authorize } from '../../core/middleware/authorize';
import { isValidTimezone } from '../../shared/time/timezone';
import { validationError } from '../../core/http/errors';
import * as platformService from './platform.service';

const createSalonSchema = z.object({
  name: z.string().min(1),
  timezone: z.string().min(1),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  owner: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6),
  }),
});

export const platformRouter = Router();

// All platform routes require SUPER_ADMIN.
platformRouter.use(authenticate, authorize('SUPER_ADMIN'));

// POST /platform/salons
platformRouter.post(
  '/salons',
  validateBody(createSalonSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSalonSchema>;
    if (!isValidTimezone(body.timezone)) {
      throw validationError('Invalid timezone', [
        { field: 'timezone', message: 'Unknown timezone' },
      ]);
    }
    const salon = await platformService.createSalon(body);
    res.status(201).json(salon);
  }),
);

// GET /platform/salons
platformRouter.get(
  '/salons',
  asyncHandler(async (_req, res) => {
    res.status(200).json(await platformService.listSalons());
  }),
);
