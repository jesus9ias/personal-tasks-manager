import { tokenize, PQLSyntaxError } from './lexer';
import { parse } from './parser';
import { evaluate } from './evaluator';
import type { Task } from '../../types';
import type { ASTNode } from './types';

export { PQLSyntaxError } from './lexer';
export type { ASTNode } from './types';

export interface PQLResult {
  tasks: Task[];
  error?: string;
}

/**
 * Parses and evaluates a PQL query against a task array.
 * Empty/blank query returns all tasks. Syntax errors return the error and original tasks.
 */
export function evaluatePQL(query: string, tasks: Task[]): PQLResult {
  const q = query.trim();
  if (!q) return { tasks };
  try {
    const tokens = tokenize(q);
    const ast = parse(tokens);
    return { tasks: evaluate(ast, tasks) };
  } catch (err) {
    if (err instanceof PQLSyntaxError) return { tasks, error: err.message };
    return { tasks, error: String(err) };
  }
}

/**
 * Parses only (no evaluation). Useful for real-time syntax validation.
 */
export function parsePQL(query: string): { ast: ASTNode } | { error: string } {
  const q = query.trim();
  if (!q) return { error: '' };
  try {
    const tokens = tokenize(q);
    return { ast: parse(tokens) };
  } catch (err) {
    if (err instanceof PQLSyntaxError) return { error: err.message };
    return { error: String(err) };
  }
}
