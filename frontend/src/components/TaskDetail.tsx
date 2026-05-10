import { useRef, useState, useEffect } from 'react';
import type { Task, TaskStatus, Label } from '../types';
import { STATES, STATE_BG, STATE_COLORS, URGENCY, TASK_KIND_LABELS } from '../types';
import { fmt, dateUrgency } from '../lib/utils';
import { api } from '../lib/api';

const LABEL_REGEX = /^[a-zA-Z0-9\-_ ]+$/;

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
  onChangeStatus: (status: TaskStatus) => Promise<void>;
  onAddComment: (text: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onDeleteTask: () => Promise<void>;
  onEdit: () => void;
  onClose: () => void;
}

export function TaskDetail({ task, allLabelNames, onLabelAdded, onChangeStatus, onAddComment, onDeleteComment, onDeleteTask, onEdit, onClose }: Props) {
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);

  const [labels, setLabels] = useState<Label[]>([]);
  const [labelInput, setLabelInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [confirmDeleteCommentId, setConfirmDeleteCommentId] = useState<string | null>(null);
  const [showDeleteTask, setShowDeleteTask] = useState(false);
  const [deleteTaskInput, setDeleteTaskInput] = useState('');

  useEffect(() => {
    api.getTaskLabels(task.id).then(setLabels).catch(() => {});
  }, [task.id]);

  const labelInputTrimmed = labelInput.trim();
  const isValidInput = labelInputTrimmed.length > 0
    && labelInputTrimmed.length <= 50
    && LABEL_REGEX.test(labelInputTrimmed);
  const alreadyOnTask = labels.some((l) => l.name.toLowerCase() === labelInputTrimmed.toLowerCase());

  const suggestions = allLabelNames.filter(
    (n) =>
      n.toLowerCase().includes(labelInputTrimmed.toLowerCase()) &&
      !labels.some((l) => l.name.toLowerCase() === n.toLowerCase()),
  );

  async function handleAddLabel(name: string) {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 50 || !LABEL_REGEX.test(trimmed)) return;
    if (labels.some((l) => l.name.toLowerCase() === trimmed.toLowerCase())) return;
    const label = await api.addLabel(task.id, trimmed);
    setLabels((prev) => [...prev, label]);
    onLabelAdded(label.name);
    setLabelInput('');
    setShowSuggestions(false);
  }

  async function handleRemoveLabel(labelId: string) {
    await api.removeLabel(task.id, labelId);
    setLabels((prev) => prev.filter((l) => l.id !== labelId));
  }

  async function submitComment() {
    const text = commentRef.current?.value.trim();
    if (!text) return;
    await onAddComment(text);
    if (commentRef.current) commentRef.current.value = '';
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{task.name}</h3>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button className="btn btn-danger" style={{ whiteSpace: 'nowrap', fontSize: '12px' }} onClick={() => { setShowDeleteTask(v => !v); setDeleteTaskInput(''); }}>
              Eliminar
            </button>
            <button className="btn" style={{ whiteSpace: 'nowrap', fontSize: '12px' }} onClick={onEdit}>
              Editar
            </button>
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
              <button
                className="btn btn-danger"
                style={{ fontSize: '12px', whiteSpace: 'nowrap' }}
                disabled={deleteTaskInput !== 'eliminar'}
                onClick={onDeleteTask}
              >
                Confirmar
              </button>
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
                    {labelInputTrimmed.length > 50 ? 'Máximo 50 caracteres' : 'Solo letras, números, espacios, - y _'}
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
            <textarea
              ref={commentRef}
              placeholder="Agregar comentario..."
              rows={2}
            />
            <div className="add-comment-actions">
              <button className="btn" style={{ fontSize: '12px', padding: '5px 10px' }} onClick={submitComment}>
                Agregar
              </button>
            </div>
          </div>
          <div className="comment-list">
            {task.comments.length === 0 && (
              <div style={{ fontSize: '12px', color: '#aaa' }}>Sin comentarios aún</div>
            )}
            {[...task.comments].reverse().map((c) => (
              <div key={c.id} className="comment-item">
                <div className="comment-item-header">
                  <span className="comment-date">{fmt(c.createdAt)}</span>
                  {confirmDeleteCommentId === c.id ? (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: '#888' }}>¿Eliminar?</span>
                      <button className="expand-btn" style={{ color: '#A32D2D' }} onClick={() => { onDeleteComment(c.id); setConfirmDeleteCommentId(null); }}>Sí</button>
                      <button className="expand-btn" onClick={() => setConfirmDeleteCommentId(null)}>No</button>
                    </div>
                  ) : (
                    <button className="comment-delete-btn" onClick={() => setConfirmDeleteCommentId(c.id)}>×</button>
                  )}
                </div>
                <ExpandableText text={c.body} />
              </div>
            ))}
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
