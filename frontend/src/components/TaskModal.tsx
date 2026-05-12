import { useState } from 'react';
import type { Task, CreateTaskInput, TaskStatus, TaskKind } from '../types';
import { STATES, TASK_KINDS, TASK_KIND_LABELS } from '../types';
import { Button, Field, Input, Modal, Select, Textarea } from './ui';

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
    <Modal onClose={onClose}>
      <h3>{isEdit ? 'Editar tarea' : 'Nueva tarea'}</h3>

      <Field label="Nombre *">
        <Input
          error={nameError}
          value={name}
          onChange={(e) => { setName(e.target.value); setNameError(false); }}
          placeholder="Nombre de la tarea"
        />
      </Field>

      <Field label="Descripción">
        <Textarea autoResize value={body} onChange={(e) => setBody(e.target.value)} placeholder="Descripción de la tarea" />
      </Field>

      <div className="row2">
        <Field label="Estado">
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as TaskStatus)}
            options={STATES.map((s) => ({ value: s, label: s }))}
          />
        </Field>
        <Field label="Tipo">
          <Select
            value={kind}
            onValueChange={(v) => setKind(v as TaskKind)}
            options={TASK_KINDS.map((k) => ({ value: k, label: TASK_KIND_LABELS[k] }))}
          />
        </Field>
      </div>

      {kind === 'ONE_TIME' && (
        <Field label="Fecha límite">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
      )}
      {kind === 'RECURRING' && (
        <Field label="Siguiente fecha">
          <Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
        </Field>
      )}

      <Field label="Fecha de creación">
        <Input value={isEdit ? task.createdAt : today} disabled />
      </Field>

      <div className="modal-actions">
        {isEdit && onDelete && (
          <Button variant="danger" onClick={handleDelete} disabled={saving}>Eliminar</Button>
        )}
        <Button onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {isEdit ? 'Guardar cambios' : 'Crear tarea'}
        </Button>
      </div>
    </Modal>
  );
}
