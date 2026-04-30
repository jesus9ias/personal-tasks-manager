import type { Task, TaskStatus } from '../types';
import { STATES } from '../types';
import { Column } from './Column';

interface Props {
  tasks: Task[];
  onCardClick: (task: Task) => void;
  onNewTask: () => void;
  onAddToColumn: (status: TaskStatus) => void;
  onLogout: () => void;
}

export function Board({ tasks, onCardClick, onNewTask, onAddToColumn, onLogout }: Props) {
  const byState = Object.fromEntries(
    STATES.map((s) => [s, tasks.filter((t) => t.status === s)]),
  ) as Record<string, Task[]>;

  return (
    <>
      <div className="toolbar">
        <h2>Administrador de tareas personales</h2>
        <button className="btn" onClick={onLogout} style={{ fontSize: '12px' }}>
          Salir
        </button>
        <button className="btn btn-primary" onClick={onNewTask}>
          + Nueva tarea
        </button>
      </div>
      <div className="board">
        {STATES.map((s) => (
          <Column key={s} status={s} tasks={byState[s]} onCardClick={onCardClick} onAdd={() => onAddToColumn(s)} />
        ))}
      </div>
    </>
  );
}
