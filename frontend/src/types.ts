export type TaskStatus =
  | 'Backlog'
  | 'Planificación'
  | 'Ejecución'
  | 'Pausado'
  | 'Validación'
  | 'Finalizado'
  | 'Cancelado';

export type TaskType = 'unica' | 'recurrente';

export interface Comment {
  id: string;
  text: string;
  date: string;
}

export interface Task {
  id: string;
  title: string;
  desc: string;
  status: TaskStatus;
  tipo: TaskType;
  deadline?: string;
  nextDate?: string;
  createdAt: string;
  comments: Comment[];
}

export interface CreateTaskInput {
  title: string;
  desc: string;
  status: TaskStatus;
  tipo: TaskType;
  deadline?: string;
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
