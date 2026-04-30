import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useTasks } from './hooks/useTasks';
import { Board } from './components/Board';
import { TaskModal } from './components/TaskModal';
import { TaskDetail } from './components/TaskDetail';
import type { Task, TaskStatus, CreateTaskInput } from './types';

type Modal =
  | { kind: 'none' }
  | { kind: 'new'; initialStatus?: TaskStatus }
  | { kind: 'edit'; task: Task }
  | { kind: 'detail'; task: Task };

export default function App() {
  const { authenticated, loading: authLoading, login, logout } = useAuth();
  const { tasks, loading, createTask, updateTask, deleteTask, addComment } =
    useTasks(authenticated);
  const [modal, setModal] = useState<Modal>({ kind: 'none' });

  if (authLoading) {
    return (
      <div id="app">
        <div style={{ textAlign: 'center', padding: '3rem 0', color: '#888', fontSize: '14px' }}>
          Cargando...
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div id="app">
        <div className="login-screen">
          <h1>Tablero de Tareas</h1>
          <p>Inicia sesión para acceder a tu tablero.</p>
          <button className="btn btn-primary" onClick={login}>
            Continuar con Google
          </button>
        </div>
      </div>
    );
  }

  const activeTask =
    modal.kind === 'detail' || modal.kind === 'edit'
      ? tasks.find((t) => t.id === modal.task.id) ?? modal.task
      : null;

  async function handleChangeStatus(taskId: string, status: TaskStatus) {
    await updateTask(taskId, { status });
    if (modal.kind === 'detail') {
      const updated = tasks.find((t) => t.id === taskId);
      if (updated) setModal({ kind: 'detail', task: { ...updated, status } });
    }
  }

  return (
    <div id="app">
      {loading && (
        <div style={{ textAlign: 'center', padding: '1rem', fontSize: '12px', color: '#888' }}>
          Sincronizando...
        </div>
      )}

      <Board
        tasks={tasks}
        onCardClick={(task) => setModal({ kind: 'detail', task })}
        onNewTask={() => setModal({ kind: 'new' })}
        onAddToColumn={(status) => setModal({ kind: 'new', initialStatus: status })}
        onLogout={logout}
      />

      {modal.kind === 'new' && (
        <TaskModal
          initialStatus={modal.initialStatus}
          onSave={async (input: CreateTaskInput) => { await createTask(input); }}
          onClose={() => setModal({ kind: 'none' })}
        />
      )}

      {modal.kind === 'edit' && activeTask && (
        <TaskModal
          task={activeTask}
          onSave={async (input) => { await updateTask(activeTask.id, input); }}
          onDelete={async () => { await deleteTask(activeTask.id); }}
          onClose={() => setModal({ kind: 'none' })}
        />
      )}

      {modal.kind === 'detail' && activeTask && (
        <TaskDetail
          task={activeTask}
          onChangeStatus={(status) => handleChangeStatus(activeTask.id, status)}
          onAddComment={(text) => addComment(activeTask.id, text)}
          onEdit={() => setModal({ kind: 'edit', task: activeTask })}
          onClose={() => setModal({ kind: 'none' })}
        />
      )}
    </div>
  );
}
