export enum TokenKind {
  // Literals
  STRING,
  NUMBER,
  IDENTIFIER,

  // Keywords
  AND, OR,
  IS, NOT, CONTAINS, CONTAINS_ALL, IN, BEFORE, AFTER, HAS, EMPTY,

  // Numeric operators
  EQ,   // =
  NEQ,  // !=
  GT,   // >
  LT,   // <
  GTE,  // >=
  LTE,  // <=

  // Delimiters
  LPAREN, RPAREN, COMMA,

  EOF,
}

export interface Token {
  kind: TokenKind;
  value: string;
  pos: number;
}

export type ASTNode = AndNode | OrNode | ComparisonNode;

export interface AndNode {
  type: 'and';
  left: ASTNode;
  right: ASTNode;
}

export interface OrNode {
  type: 'or';
  left: ASTNode;
  right: ASTNode;
}

export interface ComparisonNode {
  type: 'comparison';
  field: PQLField;
  operator: PQLOperator;
  value: PQLValue;
}

export type PQLField =
  | 'name'
  | 'body'
  | 'status'
  | 'kind'
  | 'createdAt'
  | 'dueDate'
  | 'nextDate'
  | 'labels'
  | 'comments'
  | 'urgency'
  | 'commentsCount'
  | 'labelsCount';

export type PQLOperator =
  | 'IS' | 'NOT_IS'
  | 'CONTAINS' | 'NOT_CONTAINS'
  | 'CONTAINS_ALL'
  | 'IN' | 'NOT_IN'
  | 'BEFORE' | 'AFTER'
  | 'HAS' | 'NOT_HAS'
  | 'GT' | 'LT' | 'GTE' | 'LTE' | 'EQ' | 'NEQ';

export type PQLValue =
  | { type: 'string'; value: string }
  | { type: 'number'; value: number }
  | { type: 'list'; values: string[] }
  | { type: 'fn_date' }
  | { type: 'empty' };
