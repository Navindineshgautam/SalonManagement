import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../core/http/asyncHandler';
import { validateBody } from '../../core/middleware/validate';
import { authenticate, requirePrincipal } from '../../core/middleware/authenticate';
import { authorize, requireSalonRole } from '../../core/middleware/authorize';
import { salonIdOf } from '../../core/middleware/tenantContext';
import * as salonService from './salon.service';

const updateSalonSchema = z.object({
  name: z.string().min(1),
  timezone: z.string().min(1),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
});

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['MANAGER', 'RECEPTIONIST']),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['MANAGER', 'RECEPTIONIST']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const salonRouter = Router();

salonRouter.use(authenticate);

// GET /salon — any salon role
salonRouter.get(
  '/',
  requireSalonRole,
  asyncHandler(async (req, res) => {
    res.status(200).json(await salonService.getSalon(salonIdOf(req)));
  }),
);

// PUT /salon — OWNER only
salonRouter.put(
  '/',
  authorize('OWNER'),
  validateBody(updateSalonSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof updateSalonSchema>;
    res.status(200).json(await salonService.updateSalon(salonIdOf(req), body));
  }),
);

// GET /salon/users — OWNER, MANAGER
salonRouter.get(
  '/users',
  authorize('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    res.status(200).json(await salonService.listSalonUsers(salonIdOf(req)));
  }),
);

// POST /salon/users — OWNER, MANAGER (manager -> receptionist only, enforced in service)
salonRouter.post(
  '/users',
  authorize('OWNER', 'MANAGER'),
  validateBody(createUserSchema),
  asyncHandler(async (req, res) => {
    const principal = requirePrincipal(req);
    const body = req.body as z.infer<typeof createUserSchema>;
    const user = await salonService.createSalonUser(salonIdOf(req), principal.role, body);
    res.status(201).json(user);
  }),
);

// PATCH /salon/users/:id — OWNER, MANAGER
salonRouter.patch(
  '/users/:id',
  authorize('OWNER', 'MANAGER'),
  validateBody(updateUserSchema),
  asyncHandler(async (req, res) => {
    const principal = requirePrincipal(req);
    const body = req.body as z.infer<typeof updateUserSchema>;
    const user = await salonService.updateSalonUser(
      salonIdOf(req),
      principal.role,
      req.params.id,
      body,
    );
    res.status(200).json(user);
  }),
);

// DELETE /salon/users/:id — OWNER only
salonRouter.delete(
  '/users/:id',
  authorize('OWNER'),
  asyncHandler(async (req, res) => {
    await salonService.deleteSalonUser(salonIdOf(req), req.params.id);
    res.status(204).send();
  }),
);
