import { useState } from 'react';
import type { Task, TaskStatus, BoardMode } from '../types';
import { STATES } from '../types';
import { Column } from './Column';
import { ListView } from './ListView';

const STORAGE_KEY = 'board-view-mode';

interface Props {
  tasks: Task[];
  onCardClick: (task: Task) => void;
  onNewTask: () => void;
  onAddToColumn: (status: TaskStatus) => void;
  onMoveTask: (taskId: string, status: TaskStatus) => void;
  onLogout: () => void;
}

export function Board({ tasks, onCardClick, onNewTask, onAddToColumn, onMoveTask, onLogout }: Props) {
  const [mode, setMode] = useState<BoardMode>(
    () => (localStorage.getItem(STORAGE_KEY) as BoardMode) ?? 'kanban',
  );

  function switchMode(next: BoardMode) {
    setMode(next);
    localStorage.setItem(STORAGE_KEY, next);
  }

  const byState = Object.fromEntries(
    STATES.map((s) => [s, tasks.filter((t) => t.status === s)]),
  ) as Record<string, Task[]>;

  return (
    <>
      <div className="toolbar">
        <h2>Administrador de tareas personales</h2>
        <div className="mode-toggle">
          <button
            className={`mode-btn${mode === 'kanban' ? ' active' : ''}`}
            onClick={() => switchMode('kanban')}
          >
            Tablero
          </button>
          <button
            className={`mode-btn${mode === 'list' ? ' active' : ''}`}
            onClick={() => switchMode('list')}
          >
            Lista
          </button>
        </div>
        <button className="btn" onClick={onLogout} style={{ fontSize: '12px' }}>
          Salir
        </button>
        <button className="btn btn-primary" onClick={onNewTask}>
          + Nueva tarea
        </button>
      </div>

      {mode === 'kanban' ? (
        <div className="board">
          {STATES.map((s) => (
            <Column key={s} status={s} tasks={byState[s]} onCardClick={onCardClick} onAdd={() => onAddToColumn(s)} onMoveTask={(taskId) => onMoveTask(taskId, s)} />
          ))}
        </div>
      ) : (
        <ListView tasks={tasks} onCardClick={onCardClick} onAddToColumn={onAddToColumn} />
      )}
    </>
  );
}
