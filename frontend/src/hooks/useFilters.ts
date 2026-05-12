import { useState, useCallback } from 'react';
import type { Task, FilterCriterion, FilterField, FilterMode, FilterOperator, FilterState } from '../types';
import { applyFilters, isActive } from '../lib/filters';

const DEFAULT_OPERATOR: Record<FilterField, FilterOperator> = {
  name: 'contains',
  body: 'contains',
  status: 'is_any_of',
  kind: 'is',
  createdAt: 'after',
  dueOrNextDate: 'before',
  urgency: 'is_any_of',
  labels: 'contains_any',
  comments: 'has',
};

function initialValue(field: FilterField): FilterCriterion['value'] {
  if (field === 'status' || field === 'urgency' || field === 'labels') return [];
  return null;
}

export function useFilters() {
  const [state, setState] = useState<FilterState>({
    nameSearch: '',
    criteria: [],
    mode: 'visual',
  });

  const [pqlQuery, setPqlQueryRaw] = useState('');
  const [pqlError, setPqlError] = useState<string | undefined>(undefined);
  const [lastValidPqlTasks, setLastValidPqlTasks] = useState<Task[] | null>(null);

  const addCriterion = useCallback((field: FilterField) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    setState((prev) => ({
      ...prev,
      criteria: [
        ...prev.criteria,
        { id, field, operator: DEFAULT_OPERATOR[field], value: initialValue(field) },
      ],
    }));
  }, []);

  const updateCriterion = useCallback((id: string, updates: Partial<FilterCriterion>) => {
    setState((prev) => ({
      ...prev,
      criteria: prev.criteria.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
  }, []);

  const removeCriterion = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      criteria: prev.criteria.filter((c) => c.id !== id),
    }));
  }, []);

  const setNameSearch = useCallback((q: string) => {
    setState((prev) => ({ ...prev, nameSearch: q }));
  }, []);

  const setMode = useCallback((newMode: FilterMode) => {
    setState((prev) => ({ ...prev, mode: newMode }));
    setPqlError(undefined);
  }, []);

  const setPqlQuery = useCallback((query: string) => {
    setPqlQueryRaw(query);
  }, []);

  const clearAll = useCallback(() => {
    setState({ nameSearch: '', criteria: [], mode: 'visual' });
    setPqlQueryRaw('');
    setPqlError(undefined);
    setLastValidPqlTasks(null);
  }, []);

  const onPqlEvaluated = useCallback((result: Task[] | null, error?: string) => {
    setLastValidPqlTasks((prev) => (result !== null ? result : prev));
    setPqlError(error);
  }, []);

  const filteredTasks = useCallback(
    (tasks: Task[]): Task[] => {
      if (state.mode === 'query') {
        if (!pqlQuery.trim()) return tasks;
        return lastValidPqlTasks ?? tasks;
      }
      return applyFilters(tasks, state);
    },
    [state, pqlQuery, lastValidPqlTasks],
  );

  const activeCount =
    state.mode === 'query'
      ? pqlQuery.trim() ? 1 : 0
      : state.criteria.filter(isActive).length;

  return {
    state,
    addCriterion,
    updateCriterion,
    removeCriterion,
    setNameSearch,
    clearAll,
    filteredTasks,
    activeCount,
    pqlQuery,
    pqlError,
    setPqlQuery,
    setMode,
    onPqlEvaluated,
  };
}
