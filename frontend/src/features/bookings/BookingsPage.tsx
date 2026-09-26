import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '@/core/api/client';
import type { Booking, Employee } from '@/core/api/types';
import { Card } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Input, Select } from '@/shared/components/Input';
import { EmptyState, ErrorState, Spinner } from '@/shared/components/states';
import { useAsync } from '@/shared/hooks/useAsync';
import { formatTimeInTz, todayIso, addDaysIso } from '@/shared/utils/datetime';
import { formatDateLong } from '@/shared/utils/format';
import { DayCalendar } from './DayCalendar';
import { BookingDetailModal } from './BookingDetailModal';

type View = 'calendar' | 'list';

export function BookingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [date, setDate] = useState(searchParams.get('date') || todayIso());
  const [employeeId, setEmployeeId] = useState('');
  const [view, setView] = useState<View>('calendar');
  const [selected, setSelected] = useState<Booking | null>(null);

  useEffect(() => {
    setSearchParams(date === todayIso() ? {} : { date }, { replace: true });
  }, [date, setSearchParams]);

  const meta = useAsync(async () => {
    const [employees, salon] = await Promise.all([api.listEmployees(), api.getSalon()]);
    return { employees, salon };
  });

  const bookingsState = useAsync(
    () => api.listBookings({ from: date, to: date, employeeId: employeeId || undefined }),
    [date, employeeId]
  );

  const employees: Employee[] = meta.data?.employees ?? [];
  const timezone = meta.data?.salon.timezone ?? 'UTC';

  const visibleEmployees = useMemo(
    () => (employeeId ? employees.filter((e) => e.id === employeeId) : employees),
    [employees, employeeId]
  );

  const bookings = bookingsState.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Bookings</h1>
          <p className="text-sm text-slate-500">{formatDateLong(date)}</p>
        </div>
        <Link to="/bookings/new">
          <Button>New booking</Button>
        </Link>
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-end gap-1">
            <Button variant="secondary" onClick={() => setDate((d) => addDaysIso(d, -1))}>
              ‹
            </Button>
            <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Button variant="secondary" onClick={() => setDate((d) => addDaysIso(d, 1))}>
              ›
            </Button>
            <Button variant="ghost" onClick={() => setDate(todayIso())}>
              Today
            </Button>
          </div>

          <Select
            label="Professional"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            <option value="">All professionals</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </Select>

          <div className="ml-auto flex items-end gap-1">
            <Button
              variant={view === 'calendar' ? 'primary' : 'secondary'}
              onClick={() => setView('calendar')}
            >
              Calendar
            </Button>
            <Button
              variant={view === 'list' ? 'primary' : 'secondary'}
              onClick={() => setView('list')}
            >
              List
            </Button>
          </div>
        </div>
      </Card>

      {(meta.loading || bookingsState.loading) && <Spinner />}
      {(meta.error || bookingsState.error) && (
        <ErrorState message={meta.error || bookingsState.error || 'Failed to load'} />
      )}

      {!meta.loading && !bookingsState.loading && meta.data && (
        <Card>
          {view === 'calendar' ? (
            visibleEmployees.length === 0 ? (
              <EmptyState message="No professionals to show." />
            ) : (
              <DayCalendar
                employees={visibleEmployees}
                bookings={bookings}
                timezone={timezone}
                onSelect={setSelected}
              />
            )
          ) : bookings.length === 0 ? (
            <EmptyState message="No bookings for this date." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
                  <th className="pb-2 font-medium">Time</th>
                  <th className="pb-2 font-medium">Customer</th>
                  <th className="pb-2 font-medium">Services</th>
                  <th className="pb-2 font-medium">Professionals</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr
                    key={b.id}
                    className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50"
                    onClick={() => setSelected(b)}
                  >
                    <td className="py-3 text-slate-600">
                      {formatTimeInTz(b.startAt, timezone)}–{formatTimeInTz(b.endAt, timezone)}
                    </td>
                    <td className="py-3 font-medium text-slate-700">{b.customerName}</td>
                    <td className="py-3 text-slate-600">
                      {b.items.map((i) => i.serviceName).join(', ')}
                    </td>
                    <td className="py-3 text-slate-600">
                      {[...new Set(b.items.map((i) => i.employeeName))].join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      <BookingDetailModal booking={selected} timezone={timezone} onClose={() => setSelected(null)} />
    </div>
  );
}
