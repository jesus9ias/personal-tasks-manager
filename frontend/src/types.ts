export type BoardMode = 'kanban' | 'list';

export type TaskStatus =
  | 'Backlog'
  | 'Planificación'
  | 'Ejecución'
  | 'Pausado'
  | 'Validación'
  | 'Finalizado'
  | 'Cancelado';

export type TaskKind = 'ONE_TIME' | 'RECURRING';

export interface Comment {
  id: string;
  body: string;
  createdAt: string;
}

export interface Label {
  id: string;
  name: string;
}

export interface Task {
  id: string;
  name: string;
  body: string;
  status: TaskStatus;
  kind: TaskKind;
  dueDate?: string;
  nextDate?: string;
  createdAt: string;
  comments: Comment[];
  labels: Label[];
}

// ── Filter system ────────────────────────────────────────────────────────────

export type FilterField =
  | 'id'
  | 'name'
  | 'body'
  | 'status'
  | 'kind'
  | 'createdAt'
  | 'dueOrNextDate'
  | 'urgency'
  | 'labels'
  | 'comments';

export type FilterOperator =
  | 'contains' | 'not_contains' | 'exact'
  | 'is' | 'is_not' | 'is_any_of' | 'is_none_of'
  | 'before' | 'on' | 'after'
  | 'has' | 'has_not'
  | 'contains_all' | 'contains_any' | 'contains_none';

export interface FilterCriterion {
  id: string;
  field: FilterField;
  operator: FilterOperator;
  value: string | string[] | null;
}

export type FilterMode = 'visual' | 'query';

export interface FilterState {
  nameSearch: string;
  criteria: FilterCriterion[];
  mode: FilterMode;
}

export interface CreateTaskInput {
  name: string;
  body: string;
  status: TaskStatus;
  kind: TaskKind;
  dueDate?: string;
  nextDate?: string;
}

export type UpdateTaskInput = Partial<CreateTaskInput>;

export const STATES: TaskStatus[] = [
  'Backlog',
  'Planificación',
  'Ejecución',
  'Pausado',
  'Validación',
  'Finalizado',
  'Cancelado',
];

export const STATE_COLORS: Record<TaskStatus, string> = {
  Backlog: '#888780',
  Planificación: '#185FA5',
  Ejecución: '#3B6D11',
  Pausado: '#BA7517',
  Validación: '#534AB7',
  Finalizado: '#0F6E56',
  Cancelado: '#A32D2D',
};

export const STATE_BG: Record<TaskStatus, string> = {
  Backlog: '#F1EFE8',
  Planificación: '#E6F1FB',
  Ejecución: '#EAF3DE',
  Pausado: '#FAEEDA',
  Validación: '#EEEDFE',
  Finalizado: '#E1F5EE',
  Cancelado: '#FCEBEB',
};

export type UrgencyLevel = 'warning' | 'alert' | 'overdue';

export const INACTIVE_STATUSES: TaskStatus[] = ['Pausado', 'Finalizado', 'Cancelado'];

export const URGENCY: Record<UrgencyLevel, { icon: string; title: string }> = {
  warning: { icon: '⚠️', title: 'Faltan 5 días o menos' },
  alert:   { icon: '🔴', title: 'Vence hoy' },
  overdue: { icon: '🚨', title: 'Fecha vencida' },
};

export const TASK_KINDS: TaskKind[] = ['ONE_TIME', 'RECURRING'];

export const TASK_KIND_LABELS: Record<TaskKind, string> = {
  ONE_TIME: 'Única',
  RECURRING: 'Recurrente',
};

export const TASK_KIND_ICONS: Record<TaskKind, string> = {
  ONE_TIME: '📅',
  RECURRING: '🔁',
};

export const URGENCY_LEVELS: UrgencyLevel[] = ['warning', 'alert', 'overdue'];

export type Theme = 'light' | 'dark';
