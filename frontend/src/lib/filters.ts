import type { Task, FilterCriterion, FilterState } from '../types';
import { dateUrgency } from './utils';

function evalText(text: string, op: string, val: string | null): boolean {
  if (!val) return true;
  const t = text.toLowerCase(), v = val.toLowerCase();
  if (op === 'contains') return t.includes(v);
  if (op === 'not_contains') return !t.includes(v);
  if (op === 'exact') return t === v;
  return true;
}

function evalDate(date: string | undefined, op: string, val: string | null): boolean {
  if (!val) return true;
  if (!date) return false;
  const d = new Date(date + 'T00:00:00').getTime();
  const f = new Date(val + 'T00:00:00').getTime();
  if (op === 'before') return d < f;
  if (op === 'on') return d === f;
  if (op === 'after') return d > f;
  return true;
}

function evalSelection(taskVals: string[], op: string, val: string | string[] | null): boolean {
  if (!val || (Array.isArray(val) && val.length === 0)) return true;
  const vals = Array.isArray(val) ? val : [val];
  if (op === 'is') return vals.includes(taskVals[0]);
  if (op === 'is_not') return !vals.includes(taskVals[0]);
  if (op === 'is_any_of') return taskVals.some((v) => vals.includes(v));
  if (op === 'is_none_of') return !taskVals.some((v) => vals.includes(v));
  return true;
}

function evalLabels(names: string[], op: string, val: string[] | null): boolean {
  if (!val || val.length === 0) return true;
  if (op === 'contains_all') return val.every((v) => names.includes(v));
  if (op === 'contains_any') return val.some((v) => names.includes(v));
  if (op === 'contains_none') return !val.some((v) => names.includes(v));
  return true;
}

export function isActive(c: FilterCriterion): boolean {
  if (c.field === 'comments') return true;
  if (c.field === 'urgency' && c.operator === 'has_not') return true;
  if (c.value === null || c.value === '') return false;
  return !(Array.isArray(c.value) && c.value.length === 0);
}

// Exported for use in future automation engine
export function evaluateCriterion(task: Task, c: FilterCriterion): boolean {
  const { field, operator: op, value: val } = c;
  switch (field) {
    case 'name':
      return evalText(task.name, op, val as string);
    case 'body':
      return evalText(task.body, op, val as string);
    case 'status':
      return evalSelection([task.status], op, val);
    case 'kind':
      if (!val) return true;
      return op === 'is' ? task.kind === val : task.kind !== val;
    case 'createdAt':
      return evalDate(task.createdAt, op, val as string);
    case 'dueOrNextDate':
      return evalDate(task.dueDate ?? task.nextDate, op, val as string);
    case 'urgency': {
      const urg = dateUrgency(task.dueDate ?? task.nextDate, task.status);
      if (op === 'has_not') return urg === null;
      if (!val || (Array.isArray(val) && val.length === 0)) return true;
      return urg !== null && (Array.isArray(val) ? val : [val]).includes(urg);
    }
    case 'labels':
      return evalLabels(task.labels.map((l) => l.name), op, val as string[]);
    case 'comments':
      return op === 'has' ? task.comments.length > 0 : task.comments.length === 0;
    default:
      return true;
  }
}

export function applyFilters(tasks: Task[], state: FilterState): Task[] {
  let result = tasks;

  if (state.nameSearch.trim()) {
    const q = state.nameSearch.toLowerCase();
    result = result.filter((t) => t.name.toLowerCase().includes(q));
  }

  const active = state.criteria.filter(isActive);
  if (active.length === 0) return result;

  return result.filter((task) => active.every((c) => evaluateCriterion(task, c)));
}
