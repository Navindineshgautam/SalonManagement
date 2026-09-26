import type { Booking } from '@/core/api/types';
import { Modal } from '@/shared/components/Modal';
import { formatTimeInTz } from '@/shared/utils/datetime';

export function BookingDetailModal({
  booking,
  timezone,
  onClose,
}: {
  booking: Booking | null;
  timezone: string;
  onClose: () => void;
}) {
  if (!booking) return null;
  return (
    <Modal open={!!booking} title="Booking details" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div>
          <p className="text-xs uppercase text-slate-400">Customer</p>
          <p className="font-medium text-slate-800">{booking.customerName}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-400">When</p>
          <p className="text-slate-700">
            {formatTimeInTz(booking.startAt, timezone)} – {formatTimeInTz(booking.endAt, timezone)}
          </p>
        </div>
        <div>
          <p className="mb-1 text-xs uppercase text-slate-400">Services</p>
          <ul className="space-y-1">
            {booking.items.map((it) => (
              <li key={it.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="font-medium text-slate-700">{it.serviceName}</span>
                <span className="text-slate-500">
                  {it.employeeName} · {formatTimeInTz(it.startAt, timezone)}–{formatTimeInTz(it.endAt, timezone)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
