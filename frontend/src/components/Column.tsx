import { useState } from 'react';
import type { Task, TaskStatus } from '../types';
import { STATE_COLORS } from '../types';
import { Card } from './Card';

interface Props {
  status: TaskStatus;
  tasks: Task[];
  onCardClick: (task: Task) => void;
  onAdd: () => void;
  onMoveTask: (taskId: string) => void;
}

export function Column({ status, tasks, onCardClick, onAdd, onMoveTask }: Props) {
  const [isDragOver, setIsDragOver] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) onMoveTask(taskId);
  }

  return (
    <div
      className={`col${isDragOver ? ' drag-over' : ''}`}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={() => setIsDragOver(true)}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false); }}
      onDrop={handleDrop}
    >
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
