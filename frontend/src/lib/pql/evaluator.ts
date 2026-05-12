import type { Task } from '../../types';
import { dateUrgency } from '../utils';
import type { ASTNode, ComparisonNode, PQLOperator, PQLValue } from './types';

export function evaluate(node: ASTNode, tasks: Task[]): Task[] {
  return tasks.filter((task) => evalNode(node, task));
}

function evalNode(node: ASTNode, task: Task): boolean {
  if (node.type === 'and') return evalNode(node.left, task) && evalNode(node.right, task);
  if (node.type === 'or')  return evalNode(node.left, task) || evalNode(node.right, task);
  return evalComparison(node, task);
}

function resolveDate(v: PQLValue): string | null {
  if (v.type === 'fn_date') return new Date().toISOString().slice(0, 10);
  if (v.type === 'string') {
    const parts = v.value.split('/');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts;
    if (!day || !month || !year || !/^\d+$/.test(day) || !/^\d+$/.test(month) || !/^\d+$/.test(year)) return null;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
}

function resolveStrings(v: PQLValue): string[] {
  if (v.type === 'string') return [v.value.toLowerCase()];
  if (v.type === 'list')   return v.values.map((s) => s.toLowerCase());
  return [];
}

function compareDate(
  taskDate: string | undefined,
  op: PQLOperator,
  refDate: string | null,
): boolean {
  if (refDate === null || taskDate === undefined) return false;
  const taskTs = new Date(taskDate + 'T00:00:00').getTime();
  const refTs  = new Date(refDate  + 'T00:00:00').getTime();
  if (op === 'IS'    || op === 'EQ')  return taskTs === refTs;
  if (op === 'NOT_IS'|| op === 'NEQ') return taskTs !== refTs;
  if (op === 'BEFORE') return taskTs < refTs;
  if (op === 'AFTER')  return taskTs > refTs;
  return false;
}

function compareText(taskText: string, op: PQLOperator, v: PQLValue): boolean {
  const lower = taskText.toLowerCase();
  if (op === 'IS' || op === 'EQ') {
    if (v.type === 'empty') return lower.trim() === '';
    if (v.type === 'string') return lower === v.value.toLowerCase();
    return false;
  }
  if (op === 'NOT_IS' || op === 'NEQ') return !compareText(taskText, 'IS', v);
  if (op === 'CONTAINS') {
    if (v.type === 'string') return lower.includes(v.value.toLowerCase());
    return false;
  }
  if (op === 'NOT_CONTAINS') return !compareText(taskText, 'CONTAINS', v);
  return false;
}

function compareNumeric(count: number, op: PQLOperator, v: PQLValue): boolean {
  if (v.type !== 'number') return false;
  const n = v.value;
  if (op === 'GT')  return count > n;
  if (op === 'LT')  return count < n;
  if (op === 'GTE') return count >= n;
  if (op === 'LTE') return count <= n;
  if (op === 'EQ')  return count === n;
  if (op === 'NEQ') return count !== n;
  return false;
}

function evalComparison(node: ComparisonNode, task: Task): boolean {
  const { field, operator: op, value } = node;

  switch (field) {
    case 'name':
      return compareText(task.name, op, value);

    case 'body':
      return compareText(task.body, op, value);

    case 'status': {
      const refs = resolveStrings(value);
      const taskVal = task.status.toLowerCase();
      if (op === 'IS' || op === 'EQ' || op === 'IN')      return refs.includes(taskVal);
      if (op === 'NOT_IS' || op === 'NEQ' || op === 'NOT_IN') return !refs.includes(taskVal);
      return false;
    }

    case 'kind': {
      const refs = resolveStrings(value);
      const taskVal = task.kind.toLowerCase();
      if (op === 'IS' || op === 'EQ')      return refs.includes(taskVal) || refs.length === 0;
      if (op === 'NOT_IS' || op === 'NEQ') return !refs.includes(taskVal);
      return false;
    }

    case 'createdAt':
      return compareDate(task.createdAt, op, resolveDate(value));

    case 'dueDate':
      if (value.type === 'empty') return (op === 'IS' || op === 'EQ') ? !task.dueDate : !!task.dueDate;
      return compareDate(task.dueDate, op, resolveDate(value));

    case 'nextDate':
      if (value.type === 'empty') return (op === 'IS' || op === 'EQ') ? !task.nextDate : !!task.nextDate;
      return compareDate(task.nextDate, op, resolveDate(value));

    case 'labels': {
      const taskNames = task.labels.map((l) => l.name.toLowerCase());
      const refs = resolveStrings(value);
      if (op === 'CONTAINS')     return refs.every((r) => taskNames.includes(r));
      if (op === 'NOT_CONTAINS') return !refs.some((r) => taskNames.includes(r));
      if (op === 'CONTAINS_ALL') return refs.every((r) => taskNames.includes(r));
      if (op === 'HAS')          return taskNames.length > 0;
      if (op === 'NOT_HAS')      return taskNames.length === 0;
      return false;
    }

    case 'comments':
      if (op === 'HAS')     return task.comments.length > 0;
      if (op === 'NOT_HAS') return task.comments.length === 0;
      return false;

    case 'urgency': {
      const urg = dateUrgency(task.dueDate ?? task.nextDate, task.status);
      const refs = resolveStrings(value);
      if (op === 'IN')      return urg !== null && refs.includes(urg);
      if (op === 'NOT_IN')  return urg === null || !refs.includes(urg);
      if (op === 'HAS')     return urg !== null;
      if (op === 'NOT_HAS') return urg === null;
      return false;
    }

    case 'commentsCount':
      return compareNumeric(task.comments.length, op, value);

    case 'labelsCount':
      return compareNumeric(task.labels.length, op, value);

    default:
      return false;
  }
}
