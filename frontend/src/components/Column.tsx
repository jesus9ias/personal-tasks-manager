import type { Task, TaskStatus } from '../types';
import { STATE_COLORS } from '../types';
import { Card } from './Card';

interface Props {
  status: TaskStatus;
  tasks: Task[];
  onCardClick: (task: Task) => void;
  onAdd: () => void;
}

export function Column({ status, tasks, onCardClick, onAdd }: Props) {
  return (
    <div className="col">
      <div className="col-header">
        <span className="col-title" style={{ color: STATE_COLORS[status] }}>
          {status}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span className="col-count">{tasks.length}</span>
          <button
            className="col-add-btn"
            onClick={onAdd}
            title={`Nueva tarea en ${status}`}
          >
            +
          </button>
        </span>
      </div>
      {tasks.length === 0 && <div className="empty-col">Sin tareas</div>}
      {tasks.map((task) => (
        <Card key={task.id} task={task} onClick={() => onCardClick(task)} />
      ))}
    </div>
  );
}
