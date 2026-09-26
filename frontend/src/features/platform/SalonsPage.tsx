import { useState } from 'react';
import { api } from '@/core/api/client';
import { Card } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Modal } from '@/shared/components/Modal';
import { Input, Select } from '@/shared/components/Input';
import { EmptyState, ErrorState, Spinner } from '@/shared/components/states';
import { useToast } from '@/shared/components/Toast';
import { errorMessage, useAsync } from '@/shared/hooks/useAsync';

const COMMON_TIMEZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'America/New_York', 'UTC'];

export function SalonsPage() {
  const toast = useToast();
  const salons = useAsync(() => api.listSalons());
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    timezone: 'Asia/Kolkata',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
  });

  const create = async () => {
    setSaving(true);
    try {
      await api.createSalon({
        name: form.name.trim(),
        timezone: form.timezone,
        owner: {
          name: form.ownerName.trim(),
          email: form.ownerEmail.trim(),
          password: form.ownerPassword,
        },
      });
      toast.success('Salon created with owner');
      setOpen(false);
      setForm({ name: '', timezone: 'Asia/Kolkata', ownerName: '', ownerEmail: '', ownerPassword: '' });
      salons.reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const valid =
    form.name.trim() && form.ownerName.trim() && form.ownerEmail.trim() && form.ownerPassword;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Salons</h1>
          <p className="text-sm text-slate-500">Onboard new salons and their owners.</p>
        </div>
        <Button onClick={() => setOpen(true)}>Create salon</Button>
      </div>

      <Card>
        {salons.loading && <Spinner />}
        {salons.error && <ErrorState message={salons.error} />}
        {salons.data && salons.data.length === 0 && <EmptyState message="No salons yet." />}
        {salons.data && salons.data.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Timezone</th>
                <th className="pb-2 font-medium">Contact</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {salons.data.map((s) => (
                <tr key={s.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-3 font-medium text-slate-700">{s.name}</td>
                  <td className="py-3 text-slate-600">{s.timezone}</td>
                  <td className="py-3 text-slate-600">{s.contactEmail ?? s.contactPhone ?? '—'}</td>
                  <td className="py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        s.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal
        open={open}
        title="Create salon"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={create} loading={saving} disabled={!valid}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Salon name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Select label="Timezone" value={form.timezone} onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}>
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </Select>
          <div className="border-t border-slate-100 pt-4">
            <p className="mb-2 text-sm font-medium text-slate-700">Initial owner</p>
            <div className="space-y-3">
              <Input label="Owner name" value={form.ownerName} onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))} />
              <Input label="Owner email" type="email" value={form.ownerEmail} onChange={(e) => setForm((f) => ({ ...f, ownerEmail: e.target.value }))} />
              <Input label="Owner password" type="text" value={form.ownerPassword} onChange={(e) => setForm((f) => ({ ...f, ownerPassword: e.target.value }))} />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
