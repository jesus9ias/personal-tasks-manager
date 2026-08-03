import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { Task, Label, CreateTaskInput, UpdateTaskInput } from '../types';

interface UseTasksResult {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  createTask: (input: CreateTaskInput) => Promise<Task>;
  updateTask: (id: string, input: UpdateTaskInput) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  addComment: (taskId: string, text: string) => Promise<void>;
  deleteComment: (taskId: string, commentId: string) => Promise<void>;
  setTaskLabels: (taskId: string, labels: Label[]) => void;
  refresh: () => Promise<void>;
}

export function useTasks(authenticated: boolean): UseTasksResult {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTasks(await api.getTasks());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authenticated) refresh();
  }, [authenticated, refresh]);

  const createTask = async (input: CreateTaskInput): Promise<Task> => {
    const task = await api.createTask(input);
    setTasks((prev) => [...prev, { ...task, labels: task.labels ?? [] }]);
    return task;
  };

  const updateTask = async (id: string, input: UpdateTaskInput): Promise<Task> => {
    const updated = await api.updateTask(id, input);
    // Preserve labels from local state — updateTask API does not return them
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...updated, labels: t.labels } : t)));
    return updated;
  };

  const deleteTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await api.deleteTask(id);
  };

  const addComment = async (taskId: string, text: string) => {
    const comment = await api.addComment(taskId, text);
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, comments: [...t.comments, comment] } : t,
      ),
    );
  };

  const deleteComment = async (taskId: string, commentId: string) => {
    await api.deleteComment(taskId, commentId);
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, comments: t.comments.filter((c) => c.id !== commentId) } : t,
      ),
    );
  };

  const setTaskLabels = (taskId: string, labels: Label[]) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, labels } : t)));
  };

  return { tasks, loading, error, createTask, updateTask, deleteTask, addComment, deleteComment, setTaskLabels, refresh };
}
