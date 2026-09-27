import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../core/http/asyncHandler';
import { validateQuery, getValidatedQuery } from '../../core/middleware/validate';
import { authenticate } from '../../core/middleware/authenticate';
import { requireSalonRole } from '../../core/middleware/authorize';
import { salonIdOf } from '../../core/middleware/tenantContext';
import * as availabilityService from './availability.service';

/** serviceIds arrives as a repeated/CSV query param; normalize to string[]. */
const toArray = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
};

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
  serviceIds: z.preprocess(toArray, z.array(z.string()).min(1)),
  employeeId: z.string().optional(),
});

export const availabilityRouter = Router();

availabilityRouter.use(authenticate, requireSalonRole);

// GET /availability?date=&serviceIds=&employeeId=
availabilityRouter.get(
  '/',
  validateQuery(querySchema),
  asyncHandler(async (req, res) => {
    const query = getValidatedQuery<z.infer<typeof querySchema>>(req);
    res.status(200).json(await availabilityService.getAvailability(salonIdOf(req), query));
  }),
);
