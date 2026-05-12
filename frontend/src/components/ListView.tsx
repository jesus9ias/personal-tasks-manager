import * as Accordion from '@radix-ui/react-accordion';
import type { Task, TaskStatus } from '../types';
import { STATES, STATE_COLORS, URGENCY, TASK_KIND_LABELS, TASK_KIND_ICONS } from '../types';
import { fmt, dateUrgency, getTaskDate } from '../lib/utils';

interface Props {
  tasks: Task[];
  onCardClick: (task: Task) => void;
  onAddToColumn: (status: TaskStatus) => void;
}

export function ListView({ tasks, onCardClick, onAddToColumn }: Props) {
  const byState = Object.fromEntries(
    STATES.map((s) => [s, tasks.filter((t) => t.status === s)]),
  ) as Record<TaskStatus, Task[]>;

  return (
    <Accordion.Root type="multiple" defaultValue={[...STATES]} className="list-view">
      {STATES.map((s) => {
        const group = byState[s];
        return (
          <Accordion.Item key={s} value={s} className="list-group">

            <Accordion.Header asChild>
              <div className="list-group-header">
                <Accordion.Trigger className="list-collapse-btn" title="Colapsar/Expandir">
                  <span className="list-collapse-icon" />
                </Accordion.Trigger>
                <span className="list-group-title" style={{ color: STATE_COLORS[s] }}>{s}</span>
                <span className="col-count">{group.length}</span>
                <button
                  className="col-add-btn"
                  onClick={() => onAddToColumn(s)}
                  title={`Nueva tarea en ${s}`}
                >
                  +
                </button>
              </div>
            </Accordion.Header>

            <Accordion.Content className="accordion-content list-group-body">
              {group.length === 0 ? (
                <div className="empty-col" style={{ padding: '10px 12px' }}>Sin tareas</div>
              ) : (
                group.map((task) => {
                  const dateStr = getTaskDate(task);
                  const u = dateUrgency(dateStr, task.status);
                  return (
                    <div key={task.id} className="list-row" onClick={() => onCardClick(task)}>
                      <span className="list-cell-title">{task.name}</span>
                      {u && <span className="list-cell-urgency" title={URGENCY[u].title}>{URGENCY[u].icon}</span>}
                      <span className="list-cell-kind" title={TASK_KIND_LABELS[task.kind]}>
                        {TASK_KIND_ICONS[task.kind]}
                      </span>
                      <span className="list-cell-date">
                        {dateStr ? <span className="date-tag">{fmt(dateStr)}</span> : null}
                      </span>
                    </div>
                  );
                })
              )}
            </Accordion.Content>

          </Accordion.Item>
        );
      })}
    </Accordion.Root>
  );
}
