import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import './core/middleware/principal'; // load Express Request augmentation
import { config } from './config';
import { errorHandler, notFoundHandler } from './core/middleware/errorHandler';
import { openApiSpec } from './core/openapi/spec';
import { authRouter } from './modules/auth/auth.routes';
import { platformRouter } from './modules/platform/platform.routes';
import { salonRouter } from './modules/salon/salon.routes';
import { servicesRouter } from './modules/services/services.routes';
import { employeesRouter } from './modules/employees/employees.routes';
import { holidaysRouter } from './modules/holidays/holidays.routes';
import { customersRouter } from './modules/customers/customers.routes';
import { availabilityRouter } from './modules/availability/availability.routes';
import { bookingsRouter } from './modules/bookings/bookings.routes';

/** Assemble the Express application (middleware + routes). */
export const createApp = (): Express => {
  const app = express();

  app.use(
    cors({
      origin: config.cors.origins,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  // Health check.
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  // API surface.
  const api = express.Router();
  api.use('/auth', authRouter);
  api.use('/platform', platformRouter);
  api.use('/salon', salonRouter);
  api.use('/services', servicesRouter);
  api.use('/employees', employeesRouter);
  api.use('/holidays', holidaysRouter);
  api.use('/customers', customersRouter);
  api.use('/availability', availabilityRouter);
  api.use('/bookings', bookingsRouter);
  app.use('/api', api);

  // API docs.
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  // Fallbacks.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
