import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../core/http/asyncHandler';
import { validateBody } from '../../core/middleware/validate';
import { authenticate } from '../../core/middleware/authenticate';
import { authorize, requireSalonRole } from '../../core/middleware/authorize';
import { salonIdOf } from '../../core/middleware/tenantContext';
import * as employeesService from './employees.service';

const intervalSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1440),
  endMinute: z.number().int().min(0).max(1440),
});

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  role: z.string().min(1),
  specialization: z.string(),
  serviceIds: z.array(z.string()),
  weeklyOff: z.number().int().min(0).max(6).nullable(),
  workingHours: z.array(intervalSchema),
  breaks: z.array(intervalSchema),
});

const updateSchema = createSchema.partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

const leaveSchema = z.object({
  startDate: dateSchema,
  endDate: dateSchema,
});

const overrideSchema = z.object({
  date: dateSchema,
  type: z.enum(['EXTRA_HOURS', 'TIME_OFF']),
  startMinute: z.number().int().min(0).max(1440).optional(),
  endMinute: z.number().int().min(0).max(1440).optional(),
});

export const employeesRouter = Router();

employeesRouter.use(authenticate);

const writeRoles = authorize('OWNER', 'MANAGER');

// GET /employees
employeesRouter.get(
  '/',
  requireSalonRole,
  asyncHandler(async (req, res) => {
    res.status(200).json(await employeesService.listEmployees(salonIdOf(req)));
  }),
);

// GET /employees/:id
employeesRouter.get(
  '/:id',
  requireSalonRole,
  asyncHandler(async (req, res) => {
    res.status(200).json(await employeesService.getEmployee(salonIdOf(req), req.params.id));
  }),
);

// POST /employees
employeesRouter.post(
  '/',
  writeRoles,
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;
    res.status(201).json(await employeesService.createEmployee(salonIdOf(req), body));
  }),
);

// PUT /employees/:id
employeesRouter.put(
  '/:id',
  writeRoles,
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof updateSchema>;
    res
      .status(200)
      .json(await employeesService.updateEmployee(salonIdOf(req), req.params.id, body));
  }),
);

// DELETE /employees/:id
employeesRouter.delete(
  '/:id',
  writeRoles,
  asyncHandler(async (req, res) => {
    await employeesService.deleteEmployee(salonIdOf(req), req.params.id);
    res.status(204).send();
  }),
);

// POST /employees/:id/leave
employeesRouter.post(
  '/:id/leave',
  writeRoles,
  validateBody(leaveSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof leaveSchema>;
    const leave = await employeesService.addLeave(
      salonIdOf(req),
      req.params.id,
      body.startDate,
      body.endDate,
    );
    res.status(201).json(leave);
  }),
);

// DELETE /employees/:id/leave/:leaveId
employeesRouter.delete(
  '/:id/leave/:leaveId',
  writeRoles,
  asyncHandler(async (req, res) => {
    await employeesService.removeLeave(salonIdOf(req), req.params.id, req.params.leaveId);
    res.status(204).send();
  }),
);

// POST /employees/:id/overrides
employeesRouter.post(
  '/:id/overrides',
  writeRoles,
  validateBody(overrideSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof overrideSchema>;
    const override = await employeesService.addOverride(salonIdOf(req), req.params.id, body);
    res.status(201).json(override);
  }),
);

// DELETE /employees/:id/overrides/:overrideId
employeesRouter.delete(
  '/:id/overrides/:overrideId',
  writeRoles,
  asyncHandler(async (req, res) => {
    await employeesService.removeOverride(salonIdOf(req), req.params.id, req.params.overrideId);
    res.status(204).send();
  }),
);
