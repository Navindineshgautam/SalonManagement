import { useEffect, useState } from 'react';
import { api } from '@/core/api/client';
import type { SalonUser } from '@/core/api/types';
import { Card } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Input, Select } from '@/shared/components/Input';
import { Modal } from '@/shared/components/Modal';
import { EmptyState, ErrorState, Spinner } from '@/shared/components/states';
import { useToast } from '@/shared/components/Toast';
import { errorMessage, useAsync } from '@/shared/hooks/useAsync';
import { useAppSelector } from '@/store/hooks';

const COMMON_TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'Australia/Sydney',
  'UTC',
];

export function SalonSettingsPage() {
  const toast = useToast();
  const role = useAppSelector((s) => s.auth.user?.role);
  const isOwner = role === 'OWNER';

  const salon = useAsync(() => api.getSalon());
  const users = useAsync(() => api.listSalonUsers());

  const [form, setForm] = useState({ name: '', timezone: 'UTC', contactPhone: '', contactEmail: '' });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (salon.data) {
      setForm({
        name: salon.data.name,
        timezone: salon.data.timezone,
        contactPhone: salon.data.contactPhone ?? '',
        contactEmail: salon.data.contactEmail ?? '',
      });
    }
  }, [salon.data]);

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await api.updateSalon({
        name: form.name.trim(),
        timezone: form.timezone,
        contactPhone: form.contactPhone.trim() || undefined,
        contactEmail: form.contactEmail.trim() || undefined,
      });
      toast.success('Salon settings saved');
      salon.reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSavingSettings(false);
    }
  };

  // ----- user management -----
  const [userModal, setUserModal] = useState(false);
  const [userForm, setUserForm] = useState<{ name: string; email: string; password: string; role: 'MANAGER' | 'RECEPTIONIST' }>(
    { name: '', email: '', password: '', role: 'RECEPTIONIST' }
  );
  const [savingUser, setSavingUser] = useState(false);

  const createUser = async () => {
    setSavingUser(true);
    try {
      await api.createSalonUser({
        name: userForm.name.trim(),
        email: userForm.email.trim(),
        password: userForm.password,
        role: userForm.role,
      });
      toast.success('User created');
      setUserModal(false);
      setUserForm({ name: '', email: '', password: '', role: 'RECEPTIONIST' });
      users.reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSavingUser(false);
    }
  };

  const removeUser = async (u: SalonUser) => {
    if (!window.confirm(`Remove ${u.name}?`)) return;
    try {
      await api.deleteSalonUser(u.id);
      toast.success('User removed');
      users.reload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Salon settings</h1>
        <p className="text-sm text-slate-500">
          {isOwner ? 'Manage your salon and team.' : 'View settings and manage receptionists.'}
        </p>
      </div>

      <Card title="Salon details">
        {salon.loading && <Spinner />}
        {salon.error && <ErrorState message={salon.error} />}
        {salon.data && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Name"
                value={form.name}
                disabled={!isOwner}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <Select
                label="Timezone"
                value={form.timezone}
                disabled={!isOwner}
                onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </Select>
              <Input
                label="Contact phone"
                value={form.contactPhone}
                disabled={!isOwner}
                onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
              />
              <Input
                label="Contact email"
                value={form.contactEmail}
                disabled={!isOwner}
                onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
              />
            </div>
            {isOwner && (
              <div className="flex justify-end">
                <Button onClick={saveSettings} loading={savingSettings}>
                  Save settings
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card
        title="Team"
        actions={
          <Button variant="ghost" onClick={() => setUserModal(true)}>
            + Add user
          </Button>
        }
      >
        {users.loading && <Spinner />}
        {users.error && <ErrorState message={users.error} />}
        {users.data && users.data.length === 0 && <EmptyState message="No team members yet." />}
        {users.data && users.data.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Email</th>
                <th className="pb-2 font-medium">Role</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {users.data.map((u) => (
                <tr key={u.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-3 font-medium text-slate-700">{u.name}</td>
                  <td className="py-3 text-slate-600">{u.email}</td>
                  <td className="py-3 text-slate-600">{u.role}</td>
                  <td className="py-3 text-right">
                    {isOwner && u.role !== 'OWNER' && (
                      <Button variant="ghost" onClick={() => removeUser(u)}>
                        Remove
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal
        open={userModal}
        title="Add team member"
        onClose={() => setUserModal(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setUserModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={createUser}
              loading={savingUser}
              disabled={!userForm.name.trim() || !userForm.email.trim() || !userForm.password}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Name" value={userForm.name} onChange={(e) => setUserForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="Email" type="email" value={userForm.email} onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))} />
          <Input label="Temporary password" type="text" value={userForm.password} onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))} />
          <Select
            label="Role"
            value={userForm.role}
            onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value as 'MANAGER' | 'RECEPTIONIST' }))}
          >
            <option value="RECEPTIONIST">Receptionist</option>
            {isOwner && <option value="MANAGER">Manager</option>}
          </Select>
          {!isOwner && (
            <p className="text-xs text-slate-400">Managers can only add receptionists.</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
