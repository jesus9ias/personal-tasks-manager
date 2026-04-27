import type { Task } from '../types';
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

export function Card({ task, onClick }: Props) {
  return (
    <div className="card" onClick={onClick} style={{ borderLeft: `2px solid ${STATE_COLORS[task.status]}` }}>
      <div className="card-title">{task.title}</div>
      {task.desc && <div className="card-desc">{task.desc}</div>}
      <div className="card-meta">
        <span className={`badge ${task.tipo === 'unica' ? 'badge-unica' : 'badge-recurrente'}`}>
          {task.tipo === 'unica' ? 'Única' : 'Recurrente'}
        </span>
        {task.tipo === 'unica' && task.deadline && (
          <span className="date-tag">📅 {fmt(task.deadline)}</span>
        )}
        {task.tipo === 'recurrente' && task.nextDate && (
          <span className="date-tag">🔁 {fmt(task.nextDate)}</span>
        )}
      </div>
    </div>
  );
}
