import { useState, useCallback } from 'react';
import type { Task, FilterCriterion, FilterField, FilterOperator, FilterState } from '../types';
import { applyFilters } from '../lib/filters';

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

function isActive(c: FilterCriterion): boolean {
  if (c.field === 'comments') return true;
  if (c.field === 'urgency' && c.operator === 'has_not') return true;
  if (c.value === null || c.value === '') return false;
  return !(Array.isArray(c.value) && c.value.length === 0);
}

export function useFilters() {
  const [state, setState] = useState<FilterState>({
    nameSearch: '',
    criteria: [],
    mode: 'visual',
  });

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

  const clearAll = useCallback(() => {
    setState({ nameSearch: '', criteria: [], mode: 'visual' });
  }, []);

  const filteredTasks = useCallback((tasks: Task[]) => applyFilters(tasks, state), [state]);

  const activeCount = state.criteria.filter(isActive).length;

  return {
    state,
    addCriterion,
    updateCriterion,
    removeCriterion,
    setNameSearch,
    clearAll,
    filteredTasks,
    activeCount,
  };
}
