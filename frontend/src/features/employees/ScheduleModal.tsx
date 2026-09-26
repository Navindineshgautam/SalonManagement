import { useState } from 'react';
import { api } from '@/core/api/client';
import type { Employee, ScheduleOverrideType } from '@/core/api/types';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { Input, Select } from '@/shared/components/Input';
import { useToast } from '@/shared/components/Toast';
import { errorMessage } from '@/shared/hooks/useAsync';
import { formatDateLong } from '@/shared/utils/format';
import { minutesToHHMM, hhmmToMinutes } from '@/shared/utils/intervals';
import { todayIso } from '@/shared/utils/datetime';

export function ScheduleModal({
  employee,
  open,
  onClose,
  onChanged,
}: {
  employee: Employee;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [leaveStart, setLeaveStart] = useState(todayIso());
  const [leaveEnd, setLeaveEnd] = useState(todayIso());
  const [ovrDate, setOvrDate] = useState(todayIso());
  const [ovrType, setOvrType] = useState<ScheduleOverrideType>('TIME_OFF');
  const [ovrStart, setOvrStart] = useState('10:00');
  const [ovrEnd, setOvrEnd] = useState('14:00');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      onChanged();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title={`Schedule — ${employee.name}`} onClose={onClose} wide>
      <div className="space-y-6">
        {/* Leave */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Leave</h3>
          <div className="mb-3 flex items-end gap-2">
            <Input label="From" type="date" value={leaveStart} onChange={(e) => setLeaveStart(e.target.value)} />
            <Input label="To" type="date" value={leaveEnd} onChange={(e) => setLeaveEnd(e.target.value)} />
            <Button
              disabled={busy}
              onClick={() =>
                run(
                  () => api.addEmployeeLeave(employee.id, { startDate: leaveStart, endDate: leaveEnd }),
                  'Leave added'
                )
              }
            >
              Add leave
            </Button>
          </div>
          {employee.leaves.length === 0 ? (
            <p className="text-xs text-slate-400">No leave recorded.</p>
          ) : (
            <ul className="space-y-1">
              {employee.leaves.map((l) => (
                <li key={l.id} className="flex items-center justify-between text-xs text-slate-600">
                  <span>
                    {formatDateLong(l.startDate)} → {formatDateLong(l.endDate)}
                  </span>
                  <button
                    className="text-red-600 hover:underline"
                    onClick={() => run(() => api.removeEmployeeLeave(employee.id, l.id), 'Leave removed')}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Overrides */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Temporary schedule changes</h3>
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <Input label="Date" type="date" value={ovrDate} onChange={(e) => setOvrDate(e.target.value)} />
            <Select label="Type" value={ovrType} onChange={(e) => setOvrType(e.target.value as ScheduleOverrideType)}>
              <option value="TIME_OFF">Time off</option>
              <option value="EXTRA_HOURS">Extra hours</option>
            </Select>
            <Input label="From" type="time" value={ovrStart} onChange={(e) => setOvrStart(e.target.value)} />
            <Input label="To" type="time" value={ovrEnd} onChange={(e) => setOvrEnd(e.target.value)} />
            <Button
              disabled={busy}
              onClick={() =>
                run(
                  () =>
                    api.addEmployeeOverride(employee.id, {
                      date: ovrDate,
                      type: ovrType,
                      startMinute: hhmmToMinutes(ovrStart),
                      endMinute: hhmmToMinutes(ovrEnd),
                    }),
                  'Override added'
                )
              }
            >
              Add
            </Button>
          </div>
          {employee.overrides.length === 0 ? (
            <p className="text-xs text-slate-400">No temporary changes.</p>
          ) : (
            <ul className="space-y-1">
              {employee.overrides.map((o) => (
                <li key={o.id} className="flex items-center justify-between text-xs text-slate-600">
                  <span>
                    {formatDateLong(o.date)} · {o.type === 'TIME_OFF' ? 'Time off' : 'Extra hours'}
                    {o.startMinute != null && o.endMinute != null
                      ? ` ${minutesToHHMM(o.startMinute)}–${minutesToHHMM(o.endMinute)}`
                      : ''}
                  </span>
                  <button
                    className="text-red-600 hover:underline"
                    onClick={() => run(() => api.removeEmployeeOverride(employee.id, o.id), 'Override removed')}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  );
}
