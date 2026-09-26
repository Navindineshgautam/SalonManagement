import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/core/auth/ProtectedRoute';
import { AppLayout } from '@/shared/components/AppLayout';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { ServicesPage } from '@/features/services/ServicesPage';
import { EmployeesPage } from '@/features/employees/EmployeesPage';
import { CustomersPage } from '@/features/customers/CustomersPage';
import { AvailabilityPage } from '@/features/availability/AvailabilityPage';
import { NewBookingPage } from '@/features/bookings/NewBookingPage';
import { BookingsPage } from '@/features/bookings/BookingsPage';
import { SalonSettingsPage } from '@/features/salon/SalonSettingsPage';
import { SalonsPage } from '@/features/platform/SalonsPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'bookings', element: <BookingsPage /> },
      { path: 'bookings/new', element: <NewBookingPage /> },
      { path: 'availability', element: <AvailabilityPage /> },
      { path: 'customers', element: <CustomersPage /> },
      {
        path: 'employees',
        element: (
          <ProtectedRoute roles={['OWNER', 'MANAGER']}>
            <EmployeesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'services',
        element: (
          <ProtectedRoute roles={['OWNER', 'MANAGER']}>
            <ServicesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'salon',
        element: (
          <ProtectedRoute roles={['OWNER', 'MANAGER']}>
            <SalonSettingsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'platform/salons',
        element: (
          <ProtectedRoute roles={['SUPER_ADMIN']}>
            <SalonsPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
