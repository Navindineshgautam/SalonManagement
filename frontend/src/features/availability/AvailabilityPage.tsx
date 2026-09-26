import { useEffect, useState } from 'react';
import { api } from '@/core/api/client';
import type { Employee, ProfessionalAvailability, Service } from '@/core/api/types';
import { Card } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Input, Select } from '@/shared/components/Input';
import { EmptyState, ErrorState, Spinner } from '@/shared/components/states';
import { errorMessage, useAsync } from '@/shared/hooks/useAsync';
import { formatDuration } from '@/shared/utils/format';
import { formatTimeInTz, todayIso } from '@/shared/utils/datetime';

export function AvailabilityPage() {
  const meta = useAsync(async () => {
    const [services, employees, salon] = await Promise.all([
      api.listServices(),
      api.listEmployees(),
      api.getSalon(),
    ]);
    return { services, employees, salon };
  });

  const [date, setDate] = useState(todayIso());
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [result, setResult] = useState<ProfessionalAvailability[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const services: Service[] = meta.data?.services ?? [];
  const employees: Employee[] = meta.data?.employees ?? [];
  const timezone = meta.data?.salon.timezone ?? 'UTC';

  const totalDuration = services
    .filter((s) => selectedServices.includes(s.id))
    .reduce((sum, s) => sum + s.durationMinutes, 0);

  const toggleService = (id: string) =>
    setSelectedServices((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  const check = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.getAvailability({
        date,
        serviceIds: selectedServices,
        employeeId: employeeId || undefined,
      });
      setResult(res);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  // reset results when inputs change
  useEffect(() => setResult(null), [date, selectedServices, employeeId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Availability</h1>
        <p className="text-sm text-slate-500">See open slots for a date and service selection.</p>
      </div>

      {meta.loading && <Spinner />}
      {meta.error && <ErrorState message={meta.error} />}

      {meta.data && (
        <>
          <Card>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <Select
                label="Professional (optional)"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              >
                <option value="">Any eligible professional</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </Select>
              <div className="flex items-end">
                <Button onClick={check} disabled={selectedServices.length === 0} className="w-full">
                  Check availability
                </Button>
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-slate-700">
                Services {totalDuration > 0 && <span className="text-slate-400">· total {formatDuration(totalDuration)}</span>}
              </p>
              <div className="flex flex-wrap gap-2">
                {services.map((svc) => {
                  const active = selectedServices.includes(svc.id);
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => toggleService(svc.id)}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        active
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {svc.name} · {formatDuration(svc.durationMinutes)}
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          {loading && <Spinner label="Calculating slots..." />}
          {error && <ErrorState message={error} />}
          {result && result.length === 0 && (
            <Card>
              <EmptyState message="No eligible professionals for the selected services." />
            </Card>
          )}
          {result && result.length > 0 && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {result.map((pa) => (
                <Card key={pa.employeeId} title={pa.employeeName}>
                  {pa.slots.length === 0 ? (
                    <p className="text-sm text-slate-400">No open slots on this date.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {pa.slots.map((slot) => (
                        <span
                          key={slot.startAt}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700"
                        >
                          {formatTimeInTz(slot.startAt, timezone)}
                        </span>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
