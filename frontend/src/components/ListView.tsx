import { useState } from 'react';
import type { Task, TaskStatus } from '../types';
import { STATES, STATE_COLORS, URGENCY, TASK_KIND_LABELS } from '../types';
import { fmt, dateUrgency } from '../lib/utils';

interface Props {
  tasks: Task[];
  onCardClick: (task: Task) => void;
  onAddToColumn: (status: TaskStatus) => void;
}

export function ListView({ tasks, onCardClick, onAddToColumn }: Props) {
  const [collapsed, setCollapsed] = useState<Set<TaskStatus>>(new Set());

  function toggleCollapse(status: TaskStatus) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(status) ? next.delete(status) : next.add(status);
      return next;
    });
  }

  const byState = Object.fromEntries(
    STATES.map((s) => [s, tasks.filter((t) => t.status === s)]),
  ) as Record<TaskStatus, Task[]>;

  return (
    <div className="list-view">
      {STATES.map((s) => {
        const group = byState[s];
        const isCollapsed = collapsed.has(s);
        return (
          <div key={s} className="list-group">
            <div className="list-group-header">
              <button
                className="list-collapse-btn"
                onClick={() => toggleCollapse(s)}
                title={isCollapsed ? 'Expandir' : 'Colapsar'}
              >
                {isCollapsed ? '▶' : '▼'}
              </button>
              <span className="list-group-title" style={{ color: STATE_COLORS[s] }}>
                {s}
              </span>
              <span className="col-count">{group.length}</span>
              <button
                className="col-add-btn"
                onClick={() => onAddToColumn(s)}
                title={`Nueva tarea en ${s}`}
              >
                +
              </button>
            </div>

            {!isCollapsed && (
              <div className="list-group-body">
                {group.length === 0 ? (
                  <div className="empty-col" style={{ padding: '10px 12px' }}>Sin tareas</div>
                ) : (
                  group.map((task) => {
                    const dateStr = task.kind === 'ONE_TIME' ? task.dueDate : task.nextDate;
                    const u = dateUrgency(dateStr, task.status);
                    return (
                      <div key={task.id} className="list-row" onClick={() => onCardClick(task)}>
                        <span className="list-cell-title">{task.name}</span>
                        <span className="list-cell-badge">
                          <span className={`badge badge-${task.kind}`}>
                            {TASK_KIND_LABELS[task.kind]}
                          </span>
                        </span>
                        <span className="list-cell-date">
                          {dateStr && (
                            <span className="date-tag">
                              {task.kind === 'ONE_TIME' ? '📅' : '🔁'} {fmt(dateStr)}
                              {u && <span title={URGENCY[u].title}> {URGENCY[u].icon}</span>}
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
