import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { useTasks } from './hooks/useTasks';
import { useLabels } from './hooks/useLabels';
import { useFilters } from './hooks/useFilters';
import { ToastProvider, useToast } from './hooks/useToast';
import { Board } from './components/Board';
import { FilterBarControls, FilterCriteriaPanel } from './components/FilterBar';
import { TaskModal } from './components/TaskModal';
import { TaskDetail } from './components/TaskDetail';
import { Button, Modal, SegmentedControl, Toaster } from './components/ui';
import type { Task, TaskStatus, BoardMode, CreateTaskInput, Theme } from './types';

type Modal =
  | { kind: 'none' }
  | { kind: 'new'; initialStatus?: TaskStatus }
  | { kind: 'edit'; task: Task }
  | { kind: 'detail'; task: Task }
  | { kind: 'not_found'; taskId: string };

function parseTaskIdFromPath(): string | null {
  const match = window.location.pathname.match(/^\/task\/([^/]+)$/);
  return match ? match[1] : null;
}

const BOARD_MODE_KEY = 'board-view-mode';
const THEME_KEY = 'theme';

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
      <Toaster />
    </ToastProvider>
  );
}

function AppInner() {
  const { toast } = useToast();
  const { authenticated, loading: authLoading, login, logout } = useAuth();
  const { tasks, loading, createTask, updateTask, deleteTask, addComment, deleteComment, setTaskLabels } =
    useTasks(authenticated);
  const { allLabelNames, registerLabel } = useLabels(authenticated);
  const {
    state: filterState,
    addCriterion, updateCriterion, removeCriterion,
    setNameSearch, clearAll,
    filteredTasks, activeCount,
    pqlQuery, pqlError, setPqlQuery, setMode: setFilterMode, onPqlEvaluated,
  } = useFilters();
  const [modal, setModal] = useState<Modal>({ kind: 'none' });
  const [filterExpanded, setFilterExpanded] = useState(false);
  const [pendingTaskId] = useState<string | null>(parseTaskIdFromPath);

  useEffect(() => {
    if (!pendingTaskId || loading) return;
    history.replaceState(null, '', '/');
    const task = tasks.find((t) => t.id === pendingTaskId);
    if (task) {
      setModal({ kind: 'detail', task });
    } else {
      setModal({ kind: 'not_found', taskId: pendingTaskId });
    }
  }, [pendingTaskId, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [mode, setMode] = useState<BoardMode>(
    () => (localStorage.getItem(BOARD_MODE_KEY) as BoardMode) ?? 'kanban',
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem(THEME_KEY, next);
      return next;
    });
  }

  function switchMode(next: BoardMode) {
    setMode(next);
    localStorage.setItem(BOARD_MODE_KEY, next);
  }


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
          <h1>Administrador de tareas personales</h1>
          <p>Inicia sesión para acceder a tu tablero.</p>
          <Button variant="primary" onClick={login}>
            Continuar con Google
          </Button>
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

  const displayedTasks = filteredTasks(tasks);

  return (
    <div id="app">
      <header className="app-header">
        <h2>Administrador de tareas personales</h2>
        <button
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <Button className="app-header-btn" onClick={logout}>
          Salir
        </Button>
      </header>

      <div className="app-subheader">
        <div className="subheader-row">
          <FilterBarControls
            nameSearch={filterState.nameSearch}
            activeCount={activeCount}
            expanded={filterExpanded}
            mode={filterState.mode}
            matchCount={displayedTasks.length}
            totalCount={tasks.length}
            onNameSearchChange={setNameSearch}
            onToggleExpanded={() => setFilterExpanded((v) => !v)}
            onClearAll={clearAll}
            onModeChange={setFilterMode}
          />
          <SegmentedControl
            value={mode}
            onValueChange={(v) => switchMode(v as BoardMode)}
            options={[
              { value: 'kanban', label: 'Tablero', icon: '⊞' },
              { value: 'list',   label: 'Lista',   icon: '☰' },
            ]}
          />
          <Button variant="primary" onClick={() => setModal({ kind: 'new' })}>
            <span className="btn-label">Nueva tarea</span><span className="btn-icon">+</span>
          </Button>
        </div>
        <FilterCriteriaPanel
          criteria={filterState.criteria}
          allLabelNames={allLabelNames}
          expanded={filterExpanded}
          mode={filterState.mode}
          pqlQuery={pqlQuery}
          pqlError={pqlError}
          allTasks={tasks}
          onPqlChange={setPqlQuery}
          onPqlEvaluated={onPqlEvaluated}
          onModeChange={setFilterMode}
          onAddCriterion={addCriterion}
          onUpdateCriterion={updateCriterion}
          onRemoveCriterion={removeCriterion}
        />
      </div>

      <Board
        mode={mode}
        tasks={displayedTasks}
        loading={loading}
        onCardClick={(task) => setModal({ kind: 'detail', task })}
        onAddToColumn={(status) => setModal({ kind: 'new', initialStatus: status })}
        onMoveTask={(taskId, status) => updateTask(taskId, { status })}
      />

      {modal.kind === 'new' && (
        <TaskModal
          initialStatus={modal.initialStatus}
          onSave={async (input: CreateTaskInput) => {
            try {
              const created = await createTask(input);
              toast({
                type: 'success',
                message: 'Tarea creada',
                action: { label: 'Ver tarea', onClick: () => setModal({ kind: 'detail', task: created }) },
              });
            } catch {
              toast({ type: 'warning', message: 'No se pudo crear la tarea' });
              throw new Error();
            }
          }}
          onClose={() => setModal({ kind: 'none' })}
        />
      )}

      {modal.kind === 'edit' && activeTask && (
        <TaskModal
          task={activeTask}
          onSave={async (input) => {
            try {
              const updated = await updateTask(activeTask.id, input);
              toast({
                type: 'success',
                message: 'Tarea actualizada',
                action: { label: 'Ver tarea', onClick: () => setModal({ kind: 'detail', task: updated }) },
              });
            } catch {
              toast({ type: 'warning', message: 'No se pudo actualizar la tarea' });
              throw new Error();
            }
          }}
          onDelete={async () => {
            try {
              await deleteTask(activeTask.id);
              toast({ type: 'danger', message: 'Tarea eliminada' });
            } catch {
              toast({ type: 'warning', message: 'No se pudo eliminar la tarea' });
              throw new Error();
            }
          }}
          onClose={() => setModal({ kind: 'none' })}
        />
      )}

      {modal.kind === 'detail' && activeTask && (
        <TaskDetail
          task={activeTask}
          allLabelNames={allLabelNames}
          onLabelAdded={registerLabel}
          onLabelsChange={(labels) => setTaskLabels(activeTask.id, labels)}
          onChangeStatus={(status) => handleChangeStatus(activeTask.id, status)}
          onAddComment={(text) => addComment(activeTask.id, text)}
          onDeleteComment={(commentId) => deleteComment(activeTask.id, commentId)}
          onDeleteTask={async () => {
            try {
              await deleteTask(activeTask.id);
              setModal({ kind: 'none' });
              toast({ type: 'danger', message: 'Tarea eliminada' });
            } catch {
              toast({ type: 'warning', message: 'No se pudo eliminar la tarea' });
              throw new Error();
            }
          }}
          onEdit={() => setModal({ kind: 'edit', task: activeTask })}
          onClose={() => setModal({ kind: 'none' })}
        />
      )}

      {modal.kind === 'not_found' && (
        <Modal onClose={() => setModal({ kind: 'none' })} title="Tarea no encontrada">
          <p style={{ color: 'var(--text-2)', fontSize: '14px', margin: '8px 0 16px' }}>
            No se encontró ninguna tarea con el ID <code style={{ fontFamily: 'monospace', color: 'var(--text)' }}>{modal.taskId}</code>.
          </p>
          <Button onClick={() => setModal({ kind: 'none' })}>Cerrar</Button>
        </Modal>
      )}
    </div>
  );
}
