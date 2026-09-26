import { useState } from 'react';
import { api } from '@/core/api/client';
import type { Employee, Service } from '@/core/api/types';
import { WEEKDAY_LABELS } from '@/core/config';
import { Card } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Modal } from '@/shared/components/Modal';
import { EmptyState, ErrorState, Spinner } from '@/shared/components/states';
import { useToast } from '@/shared/components/Toast';
import { useAsync, errorMessage } from '@/shared/hooks/useAsync';
import { EmployeeForm, type EmployeeFormValue } from './EmployeeForm';
import { ScheduleModal } from './ScheduleModal';

export function EmployeesPage() {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(async () => {
    const [employees, services] = await Promise.all([api.listEmployees(), api.listServices()]);
    return { employees, services };
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [formValue, setFormValue] = useState<EmployeeFormValue | null>(null);
  const [saving, setSaving] = useState(false);
  const [scheduleFor, setScheduleFor] = useState<Employee | null>(null);

  const services: Service[] = data?.services ?? [];

  const openCreate = () => {
    setEditing(null);
    setFormValue(null);
    setFormOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditing(emp);
    setFormValue(null);
    setFormOpen(true);
  };

  const save = async () => {
    if (!formValue) return;
    setSaving(true);
    try {
      if (editing) {
        await api.updateEmployee(editing.id, formValue);
        toast.success('Professional updated');
      } else {
        await api.createEmployee(formValue);
        toast.success('Professional added');
      }
      setFormOpen(false);
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (emp: Employee) => {
    if (!window.confirm(`Remove ${emp.name}?`)) return;
    try {
      await api.deleteEmployee(emp.id);
      toast.success('Professional removed');
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const serviceName = (id: string) => services.find((s) => s.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Professionals</h1>
          <p className="text-sm text-slate-500">Roster, skills, and schedules.</p>
        </div>
        <Button onClick={openCreate}>Add professional</Button>
      </div>

      {loading && <Spinner />}
      {error && <ErrorState message={error} />}
      {!loading && !error && data && data.employees.length === 0 && (
        <Card>
          <EmptyState message="No professionals yet." />
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data?.employees.map((emp) => (
          <Card key={emp.id}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">{emp.name}</p>
                <p className="text-xs text-slate-500">
                  {emp.role} · {emp.specialization}
                </p>
                <p className="mt-1 text-xs text-slate-500">{emp.phone} · {emp.email}</p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  emp.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {emp.status}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-1">
              {emp.serviceIds.map((id) => (
                <span key={id} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                  {serviceName(id)}
                </span>
              ))}
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Weekly off: {emp.weeklyOff == null ? 'None' : WEEKDAY_LABELS[emp.weeklyOff]}
              {emp.leaves.length > 0 && ` · ${emp.leaves.length} leave period(s)`}
              {emp.overrides.length > 0 && ` · ${emp.overrides.length} override(s)`}
            </p>

            <div className="mt-4 flex gap-2">
              <Button variant="secondary" onClick={() => openEdit(emp)}>
                Edit
              </Button>
              <Button variant="secondary" onClick={() => setScheduleFor(emp)}>
                Schedule
              </Button>
              <Button variant="ghost" onClick={() => remove(emp)}>
                Remove
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={formOpen}
        title={editing ? 'Edit professional' : 'Add professional'}
        onClose={() => setFormOpen(false)}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving} disabled={!formValue}>
              Save
            </Button>
          </>
        }
      >
        <EmployeeForm
          key={editing?.id ?? 'new'}
          employee={editing ?? undefined}
          services={services}
          onValidChange={setFormValue}
        />
      </Modal>

      {scheduleFor && (
        <ScheduleModal
          employee={data?.employees.find((e) => e.id === scheduleFor.id) ?? scheduleFor}
          open={!!scheduleFor}
          onClose={() => setScheduleFor(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
}
