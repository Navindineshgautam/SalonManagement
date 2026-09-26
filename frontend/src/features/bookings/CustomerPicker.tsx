import { useEffect, useState } from 'react';
import { api } from '@/core/api/client';
import type { Customer } from '@/core/api/types';
import { Input } from '@/shared/components/Input';
import { errorMessage } from '@/shared/hooks/useAsync';
import { useToast } from '@/shared/components/Toast';

export interface CustomerSelection {
  customerId?: string;
  newCustomer?: { name: string; phone: string; email?: string };
  label: string;
}

/**
 * Lets the receptionist find an existing customer or enter a new walk-in.
 * Emits a CustomerSelection the booking can submit (existing id or new info).
 */
export function CustomerPicker({ onChange }: { onChange: (sel: CustomerSelection | null) => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<'search' | 'new'>('search');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [newC, setNewC] = useState({ name: '', phone: '', email: '' });

  useEffect(() => {
    if (mode !== 'search' || search.trim().length === 0) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        setResults(await api.searchCustomers(search));
      } catch (e) {
        toast.error(errorMessage(e));
      }
    }, 250);
    return () => clearTimeout(t);
  }, [search, mode, toast]);

  const pick = (c: Customer) => {
    setSelected(c);
    onChange({ customerId: c.id, label: `${c.name} · ${c.phone}` });
  };

  const updateNew = (patch: Partial<typeof newC>) => {
    const next = { ...newC, ...patch };
    setNewC(next);
    if (next.name.trim() && next.phone.trim()) {
      onChange({
        newCustomer: { name: next.name.trim(), phone: next.phone.trim(), email: next.email.trim() || undefined },
        label: `${next.name.trim()} · ${next.phone.trim()} (new)`,
      });
    } else {
      onChange(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setMode('search'); setSelected(null); onChange(null); }}
          className={`rounded-lg px-3 py-1 text-sm ${mode === 'search' ? 'bg-brand-50 text-brand-700' : 'text-slate-600'}`}
        >
          Existing
        </button>
        <button
          type="button"
          onClick={() => { setMode('new'); setSelected(null); onChange(null); }}
          className={`rounded-lg px-3 py-1 text-sm ${mode === 'new' ? 'bg-brand-50 text-brand-700' : 'text-slate-600'}`}
        >
          New / walk-in
        </button>
      </div>

      {mode === 'search' ? (
        <div className="space-y-2">
          <Input placeholder="Search by name or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
          {selected ? (
            <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800">
              Selected: {selected.name} · {selected.phone}
            </div>
          ) : (
            results.length > 0 && (
              <ul className="max-h-40 overflow-auto rounded-lg border border-slate-200">
                {results.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => pick(c)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      <span className="font-medium text-slate-700">{c.name}</span>
                      <span className="text-slate-500">{c.phone}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label="Name" value={newC.name} onChange={(e) => updateNew({ name: e.target.value })} />
          <Input label="Phone" value={newC.phone} onChange={(e) => updateNew({ phone: e.target.value })} />
          <Input label="Email (optional)" value={newC.email} onChange={(e) => updateNew({ email: e.target.value })} />
        </div>
      )}
    </div>
  );
}
