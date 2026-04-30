import { useRef } from 'react';
import type { Task, TaskStatus } from '../types';
import { STATES, STATE_BG, STATE_COLORS } from '../types';

interface Props {
  task: Task;
  onChangeStatus: (status: TaskStatus) => Promise<void>;
  onAddComment: (text: string) => Promise<void>;
  onEdit: () => void;
  onClose: () => void;
}

function fmt(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

const INACTIVE: TaskStatus[] = ['Pausado', 'Finalizado', 'Cancelado'];

function dateUrgency(dateStr?: string, status?: TaskStatus): 'warning' | 'alert' | 'overdue' | null {
  if (!dateStr || !status || INACTIVE.includes(status)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr + 'T00:00:00');
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'alert';
  if (diff <= 5) return 'warning';
  return null;
}

const URGENCY: Record<'warning' | 'alert' | 'overdue', { icon: string; title: string }> = {
  warning: { icon: '⚠️', title: 'Faltan 5 días o menos' },
  alert:   { icon: '🔴', title: 'Vence hoy' },
  overdue: { icon: '🚨', title: 'Fecha vencida' },
};

export function TaskDetail({ task, onChangeStatus, onAddComment, onEdit, onClose }: Props) {
  const commentRef = useRef<HTMLInputElement>(null);

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
          <h3>{task.title}</h3>
          <button className="btn" style={{ whiteSpace: 'nowrap', fontSize: '12px' }} onClick={onEdit}>
            Editar
          </button>
        </div>

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

        {task.desc && (
          <div className="detail-section">
            <div className="detail-label">Descripción</div>
            <div className="detail-value">{task.desc}</div>
          </div>
        )}

        <div className="row2" style={{ marginBottom: '14px' }}>
          <div>
            <div className="detail-label">Tipo</div>
            <div className="detail-value">{task.tipo === 'unica' ? 'Única' : 'Recurrente'}</div>
          </div>
          <div>
            <div className="detail-label">Creado</div>
            <div className="detail-value">{fmt(task.createdAt)}</div>
          </div>
        </div>

        {task.tipo === 'unica' && task.deadline && (() => {
          const u = dateUrgency(task.deadline, task.status);
          return (
            <div className="detail-section">
              <div className="detail-label">Fecha límite</div>
              <div className="detail-value">
                {fmt(task.deadline)}
                {u && <span title={URGENCY[u].title} style={{ marginLeft: '6px' }}>{URGENCY[u].icon}</span>}
              </div>
            </div>
          );
        })()}
        {task.tipo === 'recurrente' && task.nextDate && (() => {
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
          <div className="detail-label">Comentarios</div>
          <div className="comment-list">
            {task.comments.length === 0 && (
              <div style={{ fontSize: '12px', color: '#aaa' }}>Sin comentarios aún</div>
            )}
            {task.comments.map((c) => (
              <div key={c.id} className="comment-item">
                {c.text}
                <div className="comment-date">{fmt(c.date)}</div>
              </div>
            ))}
          </div>
          <div className="add-comment">
            <input
              ref={commentRef}
              placeholder="Agregar comentario..."
              onKeyDown={(e) => e.key === 'Enter' && submitComment()}
            />
            <button className="btn" style={{ fontSize: '12px', padding: '5px 10px' }} onClick={submitComment}>
              Agregar
            </button>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
