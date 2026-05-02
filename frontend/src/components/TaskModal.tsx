import { useState } from 'react';
import type { Task, CreateTaskInput, TaskStatus, TaskKind } from '../types';
import { STATES, TASK_KINDS, TASK_KIND_LABELS } from '../types';

interface Props {
  task?: Task;
  initialStatus?: TaskStatus;
  onSave: (input: CreateTaskInput) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

export function TaskModal({ task, initialStatus, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(task?.name ?? '');
  const [body, setBody] = useState(task?.body ?? '');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? initialStatus ?? 'Backlog');
  const [kind, setKind] = useState<TaskKind>(task?.kind ?? 'ONE_TIME');
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '');
  const [nextDate, setNextDate] = useState(task?.nextDate ?? '');
  const [nameError, setNameError] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEdit = !!task;
  const today = new Date().toISOString().slice(0, 10);

  async function handleSave() {
    if (!name.trim()) { setNameError(true); return; }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        body,
        status,
        kind,
        dueDate: kind === 'ONE_TIME' ? dueDate : undefined,
        nextDate: kind === 'RECURRING' ? nextDate : undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    setSaving(true);
    try { await onDelete(); onClose(); } finally { setSaving(false); }
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>{isEdit ? 'Editar tarea' : 'Nueva tarea'}</h3>

        <div className="field">
          <label>Nombre *</label>
          <input
            className={nameError ? 'error' : ''}
            value={name}
            onChange={(e) => { setName(e.target.value); setNameError(false); }}
            placeholder="Nombre de la tarea"
          />
        </div>

        <div className="field">
          <label>Descripción</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Descripción de la tarea" />
        </div>

        <div className="row2">
          <div className="field">
            <label>Estado</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Tipo</label>
            <select value={kind} onChange={(e) => setKind(e.target.value as TaskKind)}>
              {TASK_KINDS.map((k) => <option key={k} value={k}>{TASK_KIND_LABELS[k]}</option>)}
            </select>
          </div>
        </div>

        {kind === 'ONE_TIME' && (
          <div className="field">
            <label>Fecha límite</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        )}
        {kind === 'RECURRING' && (
          <div className="field">
            <label>Siguiente fecha</label>
            <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
          </div>
        )}

        <div className="field">
          <label>Fecha de creación</label>
          <input value={isEdit ? task.createdAt : today} disabled />
        </div>

        <div className="modal-actions">
          {isEdit && onDelete && (
            <button className="btn btn-danger" onClick={handleDelete} disabled={saving}>
              Eliminar
            </button>
          )}
          <button className="btn" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {isEdit ? 'Guardar cambios' : 'Crear tarea'}
          </button>
        </div>
      </div>
    </div>
  );
}
