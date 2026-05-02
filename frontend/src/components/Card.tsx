import { useState } from 'react';
import type { Task } from '../types';
import { STATE_COLORS, URGENCY, TASK_KIND_LABELS } from '../types';
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
      <div className="card-title">{task.name}</div>
      {task.body && <div className="card-desc">{task.body}</div>}
      <div className="card-meta">
        <span className={`badge badge-${task.kind}`}>
          {TASK_KIND_LABELS[task.kind]}
        </span>
        {task.kind === 'ONE_TIME' && task.dueDate && (() => {
          const u = dateUrgency(task.dueDate, task.status);
          return (
            <span className="date-tag">
              📅 {fmt(task.dueDate)}
              {u && <span title={URGENCY[u].title}> {URGENCY[u].icon}</span>}
            </span>
          );
        })()}
        {task.kind === 'RECURRING' && task.nextDate && (() => {
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
