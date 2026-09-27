import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../core/http/asyncHandler';
import { validateBody } from '../../core/middleware/validate';
import { authenticate } from '../../core/middleware/authenticate';
import { authorize, requireSalonRole } from '../../core/middleware/authorize';
import { salonIdOf } from '../../core/middleware/tenantContext';
import * as servicesService from './services.service';

const createSchema = z.object({
  name: z.string().min(1),
  durationMinutes: z.number().int().positive(),
  price: z.number().nonnegative(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  durationMinutes: z.number().int().positive().optional(),
  price: z.number().nonnegative().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const servicesRouter = Router();

servicesRouter.use(authenticate);

// GET /services — any salon role
servicesRouter.get(
  '/',
  requireSalonRole,
  asyncHandler(async (req, res) => {
    res.status(200).json(await servicesService.listServices(salonIdOf(req)));
  }),
);

// POST /services — OWNER, MANAGER
servicesRouter.post(
  '/',
  authorize('OWNER', 'MANAGER'),
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;
    res.status(201).json(await servicesService.createService(salonIdOf(req), body));
  }),
);

// PUT /services/:id — OWNER, MANAGER
servicesRouter.put(
  '/:id',
  authorize('OWNER', 'MANAGER'),
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof updateSchema>;
    res.status(200).json(await servicesService.updateService(salonIdOf(req), req.params.id, body));
  }),
);

// DELETE /services/:id — OWNER, MANAGER
servicesRouter.delete(
  '/:id',
  authorize('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    await servicesService.deleteService(salonIdOf(req), req.params.id);
    res.status(204).send();
  }),
);
