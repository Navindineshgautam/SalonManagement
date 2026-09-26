import { useEffect, useState } from 'react';
import { api } from '@/core/api/client';
import type { Customer } from '@/core/api/types';
import { Card } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Modal } from '@/shared/components/Modal';
import { Input } from '@/shared/components/Input';
import { EmptyState, ErrorState, Spinner } from '@/shared/components/states';
import { useToast } from '@/shared/components/Toast';
import { errorMessage } from '@/shared/hooks/useAsync';

export function CustomersPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [saving, setSaving] = useState(false);

  const load = async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      setCustomers(await api.searchCustomers(q));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => load(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const create = async () => {
    setSaving(true);
    try {
      const created = await api.createCustomer({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
      });
      // Dedupe: if a customer with the phone already existed, the adapter returns it.
      const existed = customers.some((c) => c.id === created.id);
      toast.success(existed ? 'Existing customer matched by phone' : 'Customer created');
      setModalOpen(false);
      setForm({ name: '', phone: '', email: '' });
      load(search);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Customers</h1>
          <p className="text-sm text-slate-500">Search existing clients or add a walk-in.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>Add customer</Button>
      </div>

      <Card>
        <div className="mb-4">
          <Input
            placeholder="Search by name or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading && <Spinner />}
        {error && <ErrorState message={error} />}
        {!loading && !error && customers.length === 0 && (
          <EmptyState message={search ? 'No customers match your search.' : 'No customers yet.'} />
        )}
        {!loading && !error && customers.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Phone</th>
                <th className="pb-2 font-medium">Email</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-3 font-medium text-slate-700">{c.name}</td>
                  <td className="py-3 text-slate-600">{c.phone}</td>
                  <td className="py-3 text-slate-600">{c.email ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal
        open={modalOpen}
        title="Add customer"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={create} loading={saving} disabled={!form.name.trim() || !form.phone.trim()}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input
            label="Phone"
            value={form.phone}
            hint="Used to detect duplicates within the salon"
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <Input label="Email (optional)" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </div>
      </Modal>
    </div>
  );
}
