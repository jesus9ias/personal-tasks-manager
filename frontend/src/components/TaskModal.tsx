import { useState } from 'react';
import type { Task, CreateTaskInput, TaskStatus, TaskType } from '../types';
import { STATES } from '../types';

interface Props {
  task?: Task;
  initialStatus?: TaskStatus;
  onSave: (input: CreateTaskInput) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

export function TaskModal({ task, initialStatus, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [desc, setDesc] = useState(task?.desc ?? '');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? initialStatus ?? 'Backlog');
  const [tipo, setTipo] = useState<TaskType>(task?.tipo ?? 'unica');
  const [deadline, setDeadline] = useState(task?.deadline ?? '');
  const [nextDate, setNextDate] = useState(task?.nextDate ?? '');
  const [titleError, setTitleError] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEdit = !!task;
  const today = new Date().toISOString().slice(0, 10);

  async function handleSave() {
    if (!title.trim()) { setTitleError(true); return; }
    setSaving(true);
    try {
      await onSave({ title: title.trim(), desc, status, tipo, deadline: tipo === 'unica' ? deadline : undefined, nextDate: tipo === 'recurrente' ? nextDate : undefined });
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
            className={titleError ? 'error' : ''}
            value={title}
            onChange={(e) => { setTitle(e.target.value); setTitleError(false); }}
            placeholder="Nombre de la tarea"
          />
        </div>

        <div className="field">
          <label>Descripción</label>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descripción de la tarea" />
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
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TaskType)}>
              <option value="unica">Única</option>
              <option value="recurrente">Recurrente</option>
            </select>
          </div>
        </div>

        {tipo === 'unica' && (
          <div className="field">
            <label>Fecha límite</label>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
        )}
        {tipo === 'recurrente' && (
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
