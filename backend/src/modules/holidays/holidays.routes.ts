import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../core/http/asyncHandler';
import { validateBody } from '../../core/middleware/validate';
import { authenticate } from '../../core/middleware/authenticate';
import { authorize, requireSalonRole } from '../../core/middleware/authorize';
import { salonIdOf } from '../../core/middleware/tenantContext';
import * as holidaysService from './holidays.service';

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
  name: z.string().min(1),
});

export const holidaysRouter = Router();

holidaysRouter.use(authenticate);

// GET /holidays — any salon role
holidaysRouter.get(
  '/',
  requireSalonRole,
  asyncHandler(async (req, res) => {
    res.status(200).json(await holidaysService.listHolidays(salonIdOf(req)));
  }),
);

// POST /holidays — OWNER, MANAGER (extends the frozen contract; UI to follow)
holidaysRouter.post(
  '/',
  authorize('OWNER', 'MANAGER'),
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;
    res.status(201).json(await holidaysService.createHoliday(salonIdOf(req), body.date, body.name));
  }),
);

// DELETE /holidays/:id — OWNER, MANAGER
holidaysRouter.delete(
  '/:id',
  authorize('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    await holidaysService.deleteHoliday(salonIdOf(req), req.params.id);
    res.status(204).send();
  }),
);
