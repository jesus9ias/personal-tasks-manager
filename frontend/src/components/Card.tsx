import type { Task, TaskStatus } from '../types';
import { STATE_COLORS } from '../types';

interface Props {
  task: Task;
  onClick: () => void;
}

function fmt(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

const INACTIVE: TaskStatus[] = ['Pausado', 'Finalizado', 'Cancelado'];

function dateUrgency(dateStr?: string, status?: TaskStatus): 'warning' | 'alert' | 'overdue' | null {
  if (!dateStr || !status || INACTIVE.includes(status)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr + 'T00:00:00');
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'alert';
  if (diff <= 5) return 'warning';
  return null;
}

const URGENCY: Record<'warning' | 'alert' | 'overdue', { icon: string; title: string }> = {
  warning: { icon: '⚠️', title: 'Faltan 5 días o menos' },
  alert:   { icon: '🔴', title: 'Vence hoy' },
  overdue: { icon: '🚨', title: 'Fecha vencida' },
};

export function Card({ task, onClick }: Props) {
  return (
    <div className="card" onClick={onClick} style={{ borderLeft: `2px solid ${STATE_COLORS[task.status]}` }}>
      <div className="card-title">{task.title}</div>
      {task.desc && <div className="card-desc">{task.desc}</div>}
      <div className="card-meta">
        <span className={`badge ${task.tipo === 'unica' ? 'badge-unica' : 'badge-recurrente'}`}>
          {task.tipo === 'unica' ? 'Única' : 'Recurrente'}
        </span>
        {task.tipo === 'unica' && task.deadline && (() => {
          const u = dateUrgency(task.deadline, task.status);
          return (
            <span className="date-tag">
              📅 {fmt(task.deadline)}
              {u && <span title={URGENCY[u].title}> {URGENCY[u].icon}</span>}
            </span>
          );
        })()}
        {task.tipo === 'recurrente' && task.nextDate && (() => {
          const u = dateUrgency(task.nextDate, task.status);
          return (
            <span className="date-tag">
              🔁 {fmt(task.nextDate)}
              {u && <span title={URGENCY[u].title}> {URGENCY[u].icon}</span>}
            </span>
          );
        })()}
      </div>
    </div>
  );
}
