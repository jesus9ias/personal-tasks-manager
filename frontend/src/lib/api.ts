import { getIdToken } from './auth';
import type { Task, CreateTaskInput, UpdateTaskInput, Comment } from '../types';

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
      body: JSON.stringify({ text }),
    }),
};
