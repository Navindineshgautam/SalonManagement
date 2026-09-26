import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/core/api/client';
import type { Employee, Service } from '@/core/api/types';
import { Card } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Input, Select } from '@/shared/components/Input';
import { ErrorState, Spinner } from '@/shared/components/states';
import { useToast } from '@/shared/components/Toast';
import { errorMessage, useAsync } from '@/shared/hooks/useAsync';
import { formatCurrency, formatDuration } from '@/shared/utils/format';
import { formatTimeInTz, todayIso } from '@/shared/utils/datetime';
import { CustomerPicker, type CustomerSelection } from './CustomerPicker';

interface ItemDraft {
  key: number;
  serviceId: string;
  employeeId: string;
}

let itemKey = 1;

export function NewBookingPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const meta = useAsync(async () => {
    const [services, employees, salon] = await Promise.all([
      api.listServices(),
      api.listEmployees(),
      api.getSalon(),
    ]);
    return { services, employees, salon };
  });

  const [customer, setCustomer] = useState<CustomerSelection | null>(null);
  const [date, setDate] = useState(todayIso());
  const [items, setItems] = useState<ItemDraft[]>([{ key: itemKey, serviceId: '', employeeId: '' }]);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);

  const services: Service[] = meta.data?.services ?? [];
  const employees: Employee[] = meta.data?.employees ?? [];
  const timezone = meta.data?.salon.timezone ?? 'UTC';

  const serviceById = (id: string) => services.find((s) => s.id === id);
  const eligibleEmployees = (serviceId: string) =>
    employees.filter((e) => e.status === 'ACTIVE' && e.serviceIds.includes(serviceId));

  const validItems = items.filter((i) => i.serviceId && i.employeeId);
  const itemsComplete = validItems.length === items.length && items.length > 0;

  const total = useMemo(() => {
    const price = validItems.reduce((sum, i) => sum + (serviceById(i.serviceId)?.price ?? 0), 0);
    const duration = validItems.reduce(
      (sum, i) => sum + (serviceById(i.serviceId)?.durationMinutes ?? 0),
      0
    );
    return { price, duration };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, services]);

  // reset computed slots when inputs change
  useEffect(() => {
    setSlots(null);
    setSelectedStart(null);
  }, [date, items]);

  const addItem = () => setItems((prev) => [...prev, { key: ++itemKey, serviceId: '', employeeId: '' }]);
  const removeItem = (key: number) => setItems((prev) => prev.filter((i) => i.key !== key));
  const updateItem = (key: number, patch: Partial<ItemDraft>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  /**
   * Find candidate start times by intersecting availability across each
   * professional for the services assigned to them. Services on the same
   * professional run sequentially; different professionals run in parallel, so a
   * start time works if every professional has a slot at that start for their
   * combined duration.
   */
  const checkSlots = async () => {
    setChecking(true);
    setSlotError(null);
    setSlots(null);
    setSelectedStart(null);
    try {
      // group services by professional
      const byEmp = new Map<string, string[]>();
      for (const it of validItems) {
        byEmp.set(it.employeeId, [...(byEmp.get(it.employeeId) ?? []), it.serviceId]);
      }

      const perEmpStarts: Set<string>[] = [];
      for (const [employeeId, serviceIds] of byEmp) {
        const res = await api.getAvailability({ date, serviceIds, employeeId });
        const forEmp = res.find((r) => r.employeeId === employeeId);
        perEmpStarts.push(new Set((forEmp?.slots ?? []).map((s) => s.startAt)));
      }

      // intersect start times across professionals
      let common: string[] = perEmpStarts.length ? [...perEmpStarts[0]] : [];
      for (let i = 1; i < perEmpStarts.length; i++) {
        common = common.filter((s) => perEmpStarts[i].has(s));
      }
      common.sort();
      setSlots(common);
      if (common.length === 0) setSlotError('No common start time works for all professionals on this date.');
    } catch (e) {
      setSlotError(errorMessage(e));
    } finally {
      setChecking(false);
    }
  };

  const confirm = async () => {
    if (!customer || !selectedStart) return;
    setCreating(true);
    try {
      const booking = await api.createBooking({
        customerId: customer.customerId,
        customer: customer.newCustomer,
        startAt: selectedStart,
        items: validItems.map((i) => ({ serviceId: i.serviceId, employeeId: i.employeeId })),
      });
      toast.success('Booking created');
      navigate(`/bookings?date=${date}`, { replace: true });
      return booking;
    } catch (e) {
      // 409 conflict or validation surfaces here (backend re-validates).
      toast.error(errorMessage(e));
      setSlots(null);
      setSelectedStart(null);
    } finally {
      setCreating(false);
    }
  };

  if (meta.loading) return <Spinner />;
  if (meta.error) return <ErrorState message={meta.error} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">New booking</h1>
        <p className="text-sm text-slate-500">Client → services → professionals → slot → confirm.</p>
      </div>

      <Card title="1. Customer">
        <CustomerPicker onChange={setCustomer} />
      </Card>

      <Card
        title="2. Services & professionals"
        actions={
          <Button variant="ghost" onClick={addItem}>
            + Add service
          </Button>
        }
      >
        <div className="space-y-3">
          {items.map((item) => {
            const eligible = item.serviceId ? eligibleEmployees(item.serviceId) : [];
            return (
              <div key={item.key} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr,1fr,auto]">
                <Select
                  label="Service"
                  value={item.serviceId}
                  onChange={(e) => updateItem(item.key, { serviceId: e.target.value, employeeId: '' })}
                >
                  <option value="">Select service</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {formatDuration(s.durationMinutes)}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Professional"
                  value={item.employeeId}
                  disabled={!item.serviceId}
                  onChange={(e) => updateItem(item.key, { employeeId: e.target.value })}
                >
                  <option value="">
                    {item.serviceId && eligible.length === 0 ? 'No eligible professional' : 'Select professional'}
                  </option>
                  {eligible.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </Select>
                <div className="flex items-end">
                  {items.length > 1 && (
                    <Button variant="ghost" onClick={() => removeItem(item.key)}>
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {itemsComplete && (
          <p className="mt-3 text-sm text-slate-600">
            Total: {formatCurrency(total.price)} · {formatDuration(total.duration)}
          </p>
        )}
      </Card>

      <Card title="3. Date & slot">
        <div className="flex flex-wrap items-end gap-3">
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Button onClick={checkSlots} disabled={!itemsComplete} loading={checking}>
            Find available slots
          </Button>
        </div>

        {slotError && <div className="mt-3"><ErrorState message={slotError} /></div>}

        {slots && slots.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-slate-700">Available start times</p>
            <div className="flex flex-wrap gap-2">
              {slots.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedStart(s)}
                  className={`rounded-lg border px-3 py-1 text-sm ${
                    selectedStart === s
                      ? 'border-brand-500 bg-brand-600 text-white'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {formatTimeInTz(s, timezone)}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {customer ? customer.label : 'Select a customer'}
          {selectedStart && ` · starts ${formatTimeInTz(selectedStart, timezone)}`}
        </p>
        <Button onClick={confirm} disabled={!customer || !selectedStart} loading={creating}>
          Confirm booking
        </Button>
      </div>
    </div>
  );
}
