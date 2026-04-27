import type { Task, TaskStatus } from '../types';
import { STATE_COLORS } from '../types';
import { Card } from './Card';

interface Props {
  status: TaskStatus;
  tasks: Task[];
  onCardClick: (task: Task) => void;
}

export function Column({ status, tasks, onCardClick }: Props) {
  return (
    <div className="col">
      <div className="col-header">
        <span className="col-title" style={{ color: STATE_COLORS[status] }}>
          {status}
        </span>
        <span className="col-count">{tasks.length}</span>
      </div>
      {tasks.length === 0 && <div className="empty-col">Sin tareas</div>}
      {tasks.map((task) => (
        <Card key={task.id} task={task} onClick={() => onCardClick(task)} />
      ))}
    </div>
  );
}
