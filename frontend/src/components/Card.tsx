import { useState } from 'react';
import type { Task } from '../types';
import { STATE_COLORS, URGENCY, TASK_TYPE_LABELS } from '../types';
import { fmt, dateUrgency } from '../lib/utils';

interface Props {
  task: Task;
  onClick: () => void;
}

export function Card({ task, onClick }: Props) {
  const [dragging, setDragging] = useState(false);

  return (
    <div
      className={`card${dragging ? ' dragging' : ''}`}
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('taskId', task.id); setDragging(true); }}
      onDragEnd={() => setDragging(false)}
      onClick={onClick}
      style={{ borderLeft: `2px solid ${STATE_COLORS[task.status]}` }}
    >
      <div className="card-title">{task.title}</div>
      {task.desc && <div className="card-desc">{task.desc}</div>}
      <div className="card-meta">
        <span className={`badge badge-${task.tipo}`}>
          {TASK_TYPE_LABELS[task.tipo]}
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
