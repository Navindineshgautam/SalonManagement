import { useAppSelector } from '@/store/hooks';
import { Card } from '@/shared/components/Card';
import { navItemsForRole } from '@/core/auth/nav';
import { Link } from 'react-router-dom';

export function DashboardPage() {
  const { user } = useAppSelector((s) => s.auth);
  if (!user) return null;

  const shortcuts = navItemsForRole(user.role).filter((i) => i.to !== '/');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Welcome, {user.name}</h1>
        <p className="text-sm text-slate-500">
          {user.salonId
            ? 'Manage your salon operations from here.'
            : 'Platform administration.'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shortcuts.map((item) => (
          <Link key={item.to} to={item.to}>
            <Card className="transition hover:shadow-md">
              <p className="text-sm font-semibold text-slate-700">{item.label}</p>
              <p className="mt-1 text-xs text-slate-500">Open {item.label.toLowerCase()}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
