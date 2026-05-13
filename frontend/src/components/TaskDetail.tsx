import { useRef, useState } from 'react';
import type { Task, TaskStatus, Label } from '../types';
import { STATES, STATE_BG, STATE_COLORS, URGENCY, TASK_KIND_LABELS } from '../types';
import { fmt, dateUrgency, isValidLabelName, LABEL_MAX_LENGTH } from '../lib/utils';
import { api } from '../lib/api';
import { Button, Modal, Textarea } from './ui';

function ExpandableText({ text, className }: { text: string; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const needsClamp = text.split('\n').length > 3 || text.length > 200;
  return (
    <div>
      <div className={className} style={{ whiteSpace: 'pre-wrap', ...(needsClamp && !expanded ? { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {}) }}>
        {text}
      </div>
      {needsClamp && (
        <button className="expand-btn" onClick={() => setExpanded(v => !v)}>
          {expanded ? 'Ver menos' : 'Ver más'}
        </button>
      )}
    </div>
  );
}

interface Props {
  task: Task;
  allLabelNames: string[];
  onLabelAdded: (name: string) => void;
  onLabelsChange: (labels: Label[]) => void;
  onChangeStatus: (status: TaskStatus) => Promise<void>;
  onAddComment: (text: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onDeleteTask: () => Promise<void>;
  onEdit: () => void;
  onClose: () => void;
}

export function TaskDetail({ task, allLabelNames, onLabelAdded, onLabelsChange, onChangeStatus, onAddComment, onDeleteComment, onDeleteTask, onEdit, onClose }: Props) {
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);

  const [labels, setLabels] = useState<Label[]>(task.labels);
  const [labelInput, setLabelInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [confirmDeleteCommentId, setConfirmDeleteCommentId] = useState<string | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [showDeleteTask, setShowDeleteTask] = useState(false);
  const [deleteTaskInput, setDeleteTaskInput] = useState('');
  const [deletingTask, setDeletingTask] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [copied, setCopied] = useState(false);

  function copyTaskLink() {
    const url = `${window.location.origin}/task/${task.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  async function handleDeleteComment(commentId: string) {
    setDeletingCommentId(commentId);
    try {
      await onDeleteComment(commentId);
    } finally {
      setDeletingCommentId(null);
      setConfirmDeleteCommentId(null);
    }
  }

  async function handleDeleteTask() {
    setDeletingTask(true);
    try {
      await onDeleteTask();
    } finally {
      setDeletingTask(false);
    }
  }

  const labelInputTrimmed = labelInput.trim();
  const isValidInput = isValidLabelName(labelInputTrimmed);
  const alreadyOnTask = labels.some((l) => l.name.toLowerCase() === labelInputTrimmed.toLowerCase());

  const suggestions = allLabelNames.filter(
    (n) =>
      n.toLowerCase().includes(labelInputTrimmed.toLowerCase()) &&
      !labels.some((l) => l.name.toLowerCase() === n.toLowerCase()),
  );

  async function handleAddLabel(name: string) {
    const trimmed = name.trim();
    if (!isValidLabelName(trimmed)) return;
    if (labels.some((l) => l.name.toLowerCase() === trimmed.toLowerCase())) return;
    const label = await api.addLabel(task.id, trimmed);
    const next = [...labels, label];
    setLabels(next);
    onLabelAdded(label.name);
    onLabelsChange(next);
    setLabelInput('');
    setShowSuggestions(false);
  }

  async function handleRemoveLabel(labelId: string) {
    await api.removeLabel(task.id, labelId);
    const next = labels.filter((l) => l.id !== labelId);
    setLabels(next);
    onLabelsChange(next);
  }

  async function submitComment() {
    const text = commentRef.current?.value.trim();
    if (!text || submittingComment) return;
    setSubmittingComment(true);
    try {
      await onAddComment(text);
      if (commentRef.current) commentRef.current.value = '';
    } finally {
      setSubmittingComment(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="modal-header">
        <div>
          <button className="task-id-label" onClick={copyTaskLink} title="Copiar enlace a esta tarea">
            {copied ? '✓ Copiado' : task.id}
          </button>
          <h3>{task.name}</h3>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <Button
            variant="danger"
            style={{ whiteSpace: 'nowrap', fontSize: '12px' }}
            onClick={() => { setShowDeleteTask(v => !v); setDeleteTaskInput(''); }}
          >
            Eliminar
          </Button>
          <Button style={{ whiteSpace: 'nowrap', fontSize: '12px' }} onClick={onEdit}>
            Editar
          </Button>
        </div>
      </div>

      {showDeleteTask && (
        <div className="delete-task-confirm">
          <p>Escribe <strong>eliminar</strong> para confirmar. Se borrarán también los comentarios y etiquetas.</p>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <input
              className="delete-task-input"
              placeholder="eliminar"
              value={deleteTaskInput}
              onChange={(e) => setDeleteTaskInput(e.target.value)}
            />
            <Button
              variant="danger"
              style={{ fontSize: '12px', whiteSpace: 'nowrap' }}
              disabled={deleteTaskInput !== 'eliminar' || deletingTask}
              onClick={handleDeleteTask}
            >
              {deletingTask ? 'Eliminando...' : 'Confirmar'}
            </Button>
          </div>
        </div>
      )}

      <div className="detail-section">
        <div className="detail-label">Estado</div>
        <div className="status-select-row">
          {STATES.map((s) => (
            <span
              key={s}
              className={`status-pill${task.status === s ? ' active' : ''}`}
              style={{ background: STATE_BG[s], color: STATE_COLORS[s] }}
              onClick={() => onChangeStatus(s)}
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      {task.body && (
        <div className="detail-section">
          <div className="detail-label">Descripción</div>
          <ExpandableText text={task.body} className="detail-value" />
        </div>
      )}

      <div className="row2" style={{ marginBottom: '14px' }}>
        <div>
          <div className="detail-label">Tipo</div>
          <div className="detail-value">{TASK_KIND_LABELS[task.kind]}</div>
        </div>
        <div>
          <div className="detail-label">Creado</div>
          <div className="detail-value">{fmt(task.createdAt)}</div>
        </div>
      </div>

      {task.kind === 'ONE_TIME' && task.dueDate && (() => {
        const u = dateUrgency(task.dueDate, task.status);
        return (
          <div className="detail-section">
            <div className="detail-label">Fecha límite</div>
            <div className="detail-value">
              {fmt(task.dueDate)}
              {u && <span title={URGENCY[u].title} style={{ marginLeft: '6px' }}>{URGENCY[u].icon}</span>}
            </div>
          </div>
        );
      })()}
      {task.kind === 'RECURRING' && task.nextDate && (() => {
        const u = dateUrgency(task.nextDate, task.status);
        return (
          <div className="detail-section">
            <div className="detail-label">Siguiente fecha</div>
            <div className="detail-value">
              {fmt(task.nextDate)}
              {u && <span title={URGENCY[u].title} style={{ marginLeft: '6px' }}>{URGENCY[u].icon}</span>}
            </div>
          </div>
        );
      })()}

      <div className="detail-section">
        <div className="detail-label">Labels</div>
        <div className="label-list">
          {labels.map((l) => (
            <span key={l.id} className="label-chip">
              {l.name}
              <button onClick={() => handleRemoveLabel(l.id)} title="Quitar label">×</button>
            </span>
          ))}
        </div>
        <div className="label-input-wrap">
          <input
            ref={labelInputRef}
            className="label-input"
            value={labelInput}
            placeholder="Agregar label..."
            onChange={(e) => { setLabelInput(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && isValidInput && !alreadyOnTask) handleAddLabel(labelInput);
              if (e.key === 'Escape') { setLabelInput(''); setShowSuggestions(false); }
            }}
            maxLength={50}
          />
          {showSuggestions && labelInputTrimmed && (
            <div className="label-suggestions">
              {suggestions.map((n) => (
                <div key={n} className="label-suggestion-item" onMouseDown={() => handleAddLabel(n)}>
                  {n}
                </div>
              ))}
              {isValidInput && !alreadyOnTask && !suggestions.some((n) => n.toLowerCase() === labelInputTrimmed.toLowerCase()) && (
                <div className="label-suggestion-item label-suggestion-new" onMouseDown={() => handleAddLabel(labelInput)}>
                  Crear «{labelInputTrimmed}»
                </div>
              )}
              {!isValidInput && labelInputTrimmed && (
                <div className="label-suggestion-empty">
                  {labelInputTrimmed.length > LABEL_MAX_LENGTH ? `Máximo ${LABEL_MAX_LENGTH} caracteres` : 'Solo letras, números, espacios, - y _'}
                </div>
              )}
              {alreadyOnTask && (
                <div className="label-suggestion-empty">Ya está en esta tarea</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="detail-section">
        <div className="detail-label">Comentarios</div>
        <div className="add-comment">
          <Textarea
            autoResize
            ref={commentRef}
            placeholder="Agregar comentario..."
            rows={2}
            disabled={submittingComment}
            style={submittingComment ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
          />
          <div className="add-comment-actions">
            <Button
              style={{ fontSize: '12px', padding: '5px 10px', ...(submittingComment ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
              onClick={submitComment}
              disabled={submittingComment}
            >
              {submittingComment ? 'Agregando…' : 'Agregar'}
            </Button>
          </div>
        </div>
        <div className="comment-list">
          {task.comments.length === 0 && (
            <div style={{ fontSize: '12px', color: 'var(--text-4)' }}>Sin comentarios aún</div>
          )}
          {[...task.comments].reverse().map((c) => (
            <div key={c.id} className="comment-item">
              <div className="comment-item-header">
                <span className="comment-date">{fmt(c.createdAt)}</span>
                {confirmDeleteCommentId === c.id ? (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {deletingCommentId === c.id
                      ? <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>Eliminando...</span>
                      : <>
                          <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>¿Eliminar?</span>
                          <button className="expand-btn" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteComment(c.id)}>Sí</button>
                          <button className="expand-btn" onClick={() => setConfirmDeleteCommentId(null)}>No</button>
                        </>
                    }
                  </div>
                ) : (
                  <button className="comment-delete-btn" disabled={deletingCommentId !== null} onClick={() => setConfirmDeleteCommentId(c.id)}>×</button>
                )}
              </div>
              <ExpandableText text={c.body} />
            </div>
          ))}
        </div>
      </div>

      <div className="modal-actions">
        <Button onClick={onClose}>Cerrar</Button>
      </div>
    </Modal>
  );
}
