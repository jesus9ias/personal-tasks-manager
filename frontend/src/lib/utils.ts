import type { Task, TaskStatus, UrgencyLevel } from '../types';
import { INACTIVE_STATUSES } from '../types';

export function fmt(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function getTaskDate(task: Task): string | undefined {
  return task.kind === 'ONE_TIME' ? task.dueDate : task.nextDate;
}

export const LABEL_MAX_LENGTH = 50;
const LABEL_REGEX = /^[a-zA-Z0-9\-_ ]+$/;
export function isValidLabelName(name: string): boolean {
  return name.length > 0 && name.length <= LABEL_MAX_LENGTH && LABEL_REGEX.test(name);
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
