import { getIdToken } from './auth';
import type { Task, CreateTaskInput, UpdateTaskInput, Comment, Label } from '../types';

const API_URL = import.meta.env.VITE_API_URL as string;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getIdToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export const api = {
  getTasks: () => request<Task[]>('/tasks'),

  createTask: (input: CreateTaskInput) =>
    request<Task>('/tasks', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateTask: (id: string, input: UpdateTaskInput) =>
    request<Task>(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  deleteTask: (id: string) =>
    request<void>(`/tasks/${id}`, { method: 'DELETE' }),

  addComment: (taskId: string, text: string) =>
    request<Comment>(`/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body: text }),
    }),

  deleteComment: (taskId: string, commentId: string) =>
    request<void>(`/tasks/${taskId}/comments/${commentId}`, { method: 'DELETE' }),

  getAllLabelNames: () => request<string[]>('/labels'),

  getTaskLabels: (taskId: string) => request<Label[]>(`/tasks/${taskId}/labels`),

  addLabel: (taskId: string, name: string) =>
    request<Label>(`/tasks/${taskId}/labels`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  removeLabel: (taskId: string, labelId: string) =>
    request<void>(`/tasks/${taskId}/labels/${labelId}`, { method: 'DELETE' }),
};
