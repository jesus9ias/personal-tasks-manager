import type { Task, TaskStatus, BoardMode } from '../types';
import { STATES, STATE_COLORS } from '../types';
import { Column } from './Column';
import { ListView } from './ListView';

function SkeletonCard() {
  return (
    <div className="sk-card">
      <div className="sk sk-line sk-line-title" />
      <div className="sk sk-line sk-line-short" />
      <div className="sk sk-badge" />
    </div>
  );
}

function KanbanSkeleton() {
  return (
    <div className="board">
      {STATES.map((s) => (
        <div key={s} className="col">
          <div className="col-header">
            <div className="sk sk-col-header" style={{ color: STATE_COLORS[s] }} />
          </div>
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ))}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="list-view">
      {STATES.slice(0, 4).map((s) => (
        <div key={s} className="list-group">
          <div className="sk-group-header">
            <div className="sk sk-group-count" />
            <div className="sk sk-group-title" />
          </div>
          <div className="list-group-body">
            {[0, 1, 2].map((i) => (
              <div key={i} className="sk-list-row">
                <div className="sk sk-list-title" />
                <div className="sk sk-list-badge" />
                <div className="sk sk-list-date" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface Props {
  tasks: Task[];
  loading: boolean;
  mode: BoardMode;
  onCardClick: (task: Task) => void;
  onAddToColumn: (status: TaskStatus) => void;
  onMoveTask: (taskId: string, status: TaskStatus) => void;
}

export function Board({ tasks, loading, mode, onCardClick, onAddToColumn, onMoveTask }: Props) {
  const byState = Object.fromEntries(
    STATES.map((s) => [s, tasks.filter((t) => t.status === s)]),
  ) as Record<string, Task[]>;

  if (loading) {
    return mode === 'kanban' ? <KanbanSkeleton /> : <ListSkeleton />;
  }

  return mode === 'kanban' ? (
    <div className="board">
      {STATES.map((s) => (
        <Column
          key={s}
          status={s}
          tasks={byState[s]}
          onCardClick={onCardClick}
          onAdd={() => onAddToColumn(s)}
          onMoveTask={(taskId) => onMoveTask(taskId, s)}
        />
      ))}
    </div>
  ) : (
    <ListView tasks={tasks} onCardClick={onCardClick} onAddToColumn={onAddToColumn} />
  );
}
