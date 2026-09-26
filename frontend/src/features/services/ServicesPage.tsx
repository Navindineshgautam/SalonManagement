import { useState } from 'react';
import { api } from '@/core/api/client';
import type { Service } from '@/core/api/types';
import { SLOT_MINUTES } from '@/core/config';
import { Card } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Modal } from '@/shared/components/Modal';
import { Input } from '@/shared/components/Input';
import { EmptyState, ErrorState, Spinner } from '@/shared/components/states';
import { useToast } from '@/shared/components/Toast';
import { useAsync, errorMessage } from '@/shared/hooks/useAsync';
import { formatCurrency, formatDuration } from '@/shared/utils/format';

interface FormState {
  name: string;
  durationMinutes: string;
  price: string;
}

const emptyForm: FormState = { name: '', durationMinutes: '45', price: '0' };

export function ServicesPage() {
  const toast = useToast();
  const { data: services, loading, error, reload } = useAsync(() => api.listServices());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (svc: Service) => {
    setEditing(svc);
    setForm({
      name: svc.name,
      durationMinutes: String(svc.durationMinutes),
      price: String(svc.price),
    });
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        durationMinutes: Number(form.durationMinutes),
        price: Number(form.price),
      };
      if (editing) {
        await api.updateService(editing.id, payload);
        toast.success('Service updated');
      } else {
        await api.createService(payload);
        toast.success('Service created');
      }
      setModalOpen(false);
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (svc: Service) => {
    if (!window.confirm(`Delete "${svc.name}"?`)) return;
    try {
      await api.deleteService(svc.id);
      toast.success('Service deleted');
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Services</h1>
          <p className="text-sm text-slate-500">Offerings, durations, and pricing.</p>
        </div>
        <Button onClick={openCreate}>Add service</Button>
      </div>

      <Card>
        {loading && <Spinner />}
        {error && <ErrorState message={error} />}
        {!loading && !error && services && services.length === 0 && (
          <EmptyState message="No services yet. Add your first service." />
        )}
        {!loading && !error && services && services.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Duration</th>
                <th className="pb-2 font-medium">Price</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {services.map((svc) => (
                <tr key={svc.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-3 font-medium text-slate-700">{svc.name}</td>
                  <td className="py-3 text-slate-600">{formatDuration(svc.durationMinutes)}</td>
                  <td className="py-3 text-slate-600">{formatCurrency(svc.price)}</td>
                  <td className="py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        svc.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {svc.status}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => openEdit(svc)}>
                        Edit
                      </Button>
                      <Button variant="ghost" onClick={() => remove(svc)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal
        open={modalOpen}
        title={editing ? 'Edit service' : 'Add service'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Duration (minutes)"
            type="number"
            step={SLOT_MINUTES}
            min={SLOT_MINUTES}
            hint={`Must be a multiple of ${SLOT_MINUTES} minutes`}
            value={form.durationMinutes}
            onChange={(e) => setForm((f) => ({ ...f, durationMinutes: e.target.value }))}
          />
          <Input
            label="Price"
            type="number"
            min={0}
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
          />
        </div>
      </Modal>
    </div>
  );
}
