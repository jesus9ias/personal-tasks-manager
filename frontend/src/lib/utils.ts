import type { TaskStatus } from '../types';
import { INACTIVE_STATUSES } from '../types';
import type { UrgencyLevel } from '../types';

export function fmt(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function dateUrgency(dateStr?: string, status?: TaskStatus): UrgencyLevel | null {
  if (!dateStr || !status || INACTIVE_STATUSES.includes(status)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr + 'T00:00:00');
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'alert';
  if (diff <= 5) return 'warning';
  return null;
}
