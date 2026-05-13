import { useState } from 'react';
import type { Task } from '../types';
import { STATE_COLORS, URGENCY, TASK_KIND_LABELS, TASK_KIND_ICONS } from '../types';
import { fmt, dateUrgency, getTaskDate } from '../lib/utils';

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
      <div className="card-id">{task.id}</div>
      <div className="card-title">{task.name}</div>
      {task.body && <div className="card-desc">{task.body}</div>}
      <div className="card-meta">
        {(() => {
          const date = getTaskDate(task);
          const u = date ? dateUrgency(date, task.status) : null;
          return (
            <>
              {date && <span className="date-tag">{fmt(date)}</span>}
              <div className="card-meta-right">
                {u && <span title={URGENCY[u].title}>{URGENCY[u].icon}</span>}
                <span title={TASK_KIND_LABELS[task.kind]}>{TASK_KIND_ICONS[task.kind]}</span>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}
