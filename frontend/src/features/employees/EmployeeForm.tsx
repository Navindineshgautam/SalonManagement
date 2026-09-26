import { useState } from 'react';
import type {
  BreakInterval,
  CreateEmployeeRequest,
  Employee,
  Service,
  WorkingHour,
} from '@/core/api/types';
import { DAY_END_MINUTE, DAY_START_MINUTE, WEEKDAY_LABELS } from '@/core/config';
import { Input } from '@/shared/components/Input';
import { hhmmToMinutes, minutesToHHMM } from '@/shared/utils/intervals';

export interface EmployeeFormValue extends CreateEmployeeRequest {}

interface DayScheduleRow {
  enabled: boolean;
  start: string; // HH:MM
  end: string;
  breakStart: string;
  breakEnd: string;
}

const defaultRow: DayScheduleRow = {
  enabled: true,
  start: '10:00',
  end: '19:00',
  breakStart: '13:00',
  breakEnd: '14:00',
};

const buildRows = (employee?: Employee): DayScheduleRow[] =>
  WEEKDAY_LABELS.map((_, weekday) => {
    if (!employee) return { ...defaultRow, enabled: weekday !== 0 };
    const wh = employee.workingHours.find((w) => w.weekday === weekday);
    const br = employee.breaks.find((b) => b.weekday === weekday);
    return {
      enabled: !!wh,
      start: wh ? minutesToHHMM(wh.startMinute) : defaultRow.start,
      end: wh ? minutesToHHMM(wh.endMinute) : defaultRow.end,
      breakStart: br ? minutesToHHMM(br.startMinute) : defaultRow.breakStart,
      breakEnd: br ? minutesToHHMM(br.endMinute) : defaultRow.breakEnd,
    };
  });

/**
 * Controlled employee form. Exposes `getValue()` via the `onChange` callback so
 * the parent can submit. Working hours and breaks are edited per weekday.
 */
export function EmployeeForm({
  employee,
  services,
  onValidChange,
}: {
  employee?: Employee;
  services: Service[];
  onValidChange: (value: EmployeeFormValue | null) => void;
}) {
  const [name, setName] = useState(employee?.name ?? '');
  const [phone, setPhone] = useState(employee?.phone ?? '');
  const [email, setEmail] = useState(employee?.email ?? '');
  const [role, setRole] = useState(employee?.role ?? 'Stylist');
  const [specialization, setSpecialization] = useState(employee?.specialization ?? '');
  const [serviceIds, setServiceIds] = useState<string[]>(employee?.serviceIds ?? []);
  const [weeklyOff, setWeeklyOff] = useState<number | null>(employee?.weeklyOff ?? 0);
  const [rows, setRows] = useState<DayScheduleRow[]>(buildRows(employee));

  const emit = (next: Partial<{
    name: string;
    phone: string;
    email: string;
    role: string;
    specialization: string;
    serviceIds: string[];
    weeklyOff: number | null;
    rows: DayScheduleRow[];
  }>) => {
    const v = {
      name: next.name ?? name,
      phone: next.phone ?? phone,
      email: next.email ?? email,
      role: next.role ?? role,
      specialization: next.specialization ?? specialization,
      serviceIds: next.serviceIds ?? serviceIds,
      weeklyOff: next.weeklyOff !== undefined ? next.weeklyOff : weeklyOff,
      rows: next.rows ?? rows,
    };

    const valid = v.name.trim() && v.phone.trim() && v.email.trim() && v.serviceIds.length > 0;
    if (!valid) {
      onValidChange(null);
      return;
    }

    const workingHours: WorkingHour[] = [];
    const breaks: BreakInterval[] = [];
    v.rows.forEach((row, weekday) => {
      if (!row.enabled || weekday === v.weeklyOff) return;
      const s = hhmmToMinutes(row.start);
      const e = hhmmToMinutes(row.end);
      if (e > s && s >= DAY_START_MINUTE && e <= DAY_END_MINUTE) {
        workingHours.push({ weekday, startMinute: s, endMinute: e });
        const bs = hhmmToMinutes(row.breakStart);
        const be = hhmmToMinutes(row.breakEnd);
        if (be > bs && bs >= s && be <= e) {
          breaks.push({ weekday, startMinute: bs, endMinute: be });
        }
      }
    });

    onValidChange({
      name: v.name.trim(),
      phone: v.phone.trim(),
      email: v.email.trim(),
      role: v.role,
      specialization: v.specialization,
      serviceIds: v.serviceIds,
      weeklyOff: v.weeklyOff,
      workingHours,
      breaks,
    });
  };

  const toggleService = (id: string) => {
    const next = serviceIds.includes(id)
      ? serviceIds.filter((s) => s !== id)
      : [...serviceIds, id];
    setServiceIds(next);
    emit({ serviceIds: next });
  };

  const updateRow = (weekday: number, patch: Partial<DayScheduleRow>) => {
    const next = rows.map((r, i) => (i === weekday ? { ...r, ...patch } : r));
    setRows(next);
    emit({ rows: next });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Name" value={name} onChange={(e) => { setName(e.target.value); emit({ name: e.target.value }); }} />
        <Input label="Phone" value={phone} onChange={(e) => { setPhone(e.target.value); emit({ phone: e.target.value }); }} />
        <Input label="Email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); emit({ email: e.target.value }); }} />
        <Input label="Role" value={role} onChange={(e) => { setRole(e.target.value); emit({ role: e.target.value }); }} />
        <Input
          label="Specialization"
          className="col-span-2"
          value={specialization}
          onChange={(e) => { setSpecialization(e.target.value); emit({ specialization: e.target.value }); }}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Services performed</p>
        <div className="flex flex-wrap gap-2">
          {services.map((svc) => {
            const active = serviceIds.includes(svc.id);
            return (
              <button
                type="button"
                key={svc.id}
                onClick={() => toggleService(svc.id)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  active
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {svc.name}
              </button>
            );
          })}
        </div>
        {serviceIds.length === 0 && (
          <p className="mt-1 text-xs text-red-600">Select at least one service.</p>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700">Weekly off</label>
          <select
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
            value={weeklyOff ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : Number(e.target.value);
              setWeeklyOff(v);
              emit({ weeklyOff: v });
            }}
          >
            <option value="">None</option>
            {WEEKDAY_LABELS.map((label, i) => (
              <option key={label} value={i}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <p className="mb-2 text-sm font-medium text-slate-700">Working hours &amp; breaks</p>
        <div className="space-y-1">
          {rows.map((row, weekday) => {
            const isOff = weekday === weeklyOff;
            return (
              <div
                key={weekday}
                className={`flex flex-wrap items-center gap-2 rounded-lg px-2 py-1 text-xs ${
                  isOff ? 'bg-slate-50 text-slate-400' : ''
                }`}
              >
                <span className="w-10 font-medium">{WEEKDAY_LABELS[weekday]}</span>
                {isOff ? (
                  <span>Weekly off</span>
                ) : (
                  <>
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(e) => updateRow(weekday, { enabled: e.target.checked })}
                    />
                    <input type="time" value={row.start} disabled={!row.enabled} onChange={(e) => updateRow(weekday, { start: e.target.value })} className="rounded border border-slate-200 px-1" />
                    <span>–</span>
                    <input type="time" value={row.end} disabled={!row.enabled} onChange={(e) => updateRow(weekday, { end: e.target.value })} className="rounded border border-slate-200 px-1" />
                    <span className="ml-2 text-slate-400">break</span>
                    <input type="time" value={row.breakStart} disabled={!row.enabled} onChange={(e) => updateRow(weekday, { breakStart: e.target.value })} className="rounded border border-slate-200 px-1" />
                    <span>–</span>
                    <input type="time" value={row.breakEnd} disabled={!row.enabled} onChange={(e) => updateRow(weekday, { breakEnd: e.target.value })} className="rounded border border-slate-200 px-1" />
                  </>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-1 text-xs text-slate-400">Operating window: 06:00–24:00.</p>
      </div>
    </div>
  );
}
