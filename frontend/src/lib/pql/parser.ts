import { PQLSyntaxError } from './lexer';
import type { Token, ASTNode, PQLField, PQLOperator, PQLValue } from './types';
import { TokenKind } from './types';

// Maps lowercase identifier to canonical PQLField
const FIELD_MAP: Record<string, PQLField> = {
  id:            'id',
  name:          'name',
  body:          'body',
  status:        'status',
  kind:          'kind',
  createdat:     'createdAt',
  duedate:       'dueDate',
  nextdate:      'nextDate',
  labels:        'labels',
  comments:      'comments',
  urgency:       'urgency',
  commentscount: 'commentsCount',
  labelscount:   'labelsCount',
};

const FIELD_OPERATORS: Record<PQLField, PQLOperator[]> = {
  id:            ['IS', 'NOT_IS', 'EQ', 'NEQ', 'CONTAINS', 'NOT_CONTAINS'],
  name:          ['IS', 'NOT_IS', 'EQ', 'NEQ', 'CONTAINS', 'NOT_CONTAINS'],
  body:          ['IS', 'NOT_IS', 'EQ', 'NEQ', 'CONTAINS', 'NOT_CONTAINS'],
  status:        ['IS', 'NOT_IS', 'EQ', 'NEQ', 'IN', 'NOT_IN'],
  kind:          ['IS', 'NOT_IS', 'EQ', 'NEQ'],
  createdAt:     ['IS', 'NOT_IS', 'EQ', 'NEQ', 'BEFORE', 'AFTER'],
  dueDate:       ['IS', 'NOT_IS', 'EQ', 'NEQ', 'BEFORE', 'AFTER'],
  nextDate:      ['IS', 'NOT_IS', 'EQ', 'NEQ', 'BEFORE', 'AFTER'],
  labels:        ['CONTAINS', 'NOT_CONTAINS', 'CONTAINS_ALL', 'HAS', 'NOT_HAS'],
  comments:      ['HAS', 'NOT_HAS'],
  urgency:       ['IN', 'NOT_IN', 'HAS', 'NOT_HAS'],
  commentsCount: ['GT', 'LT', 'GTE', 'LTE', 'EQ', 'NEQ'],
  labelsCount:   ['GT', 'LT', 'GTE', 'LTE', 'EQ', 'NEQ'],
};

// Fields whose HAS/NOT_HAS operator takes no explicit value
const NO_VALUE_HAS_FIELDS = new Set<PQLField>(['comments', 'labels', 'urgency']);

class Parser {
  private pos = 0;

  constructor(private tokens: Token[]) {}

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    return this.tokens[this.pos++];
  }

  private expect(kind: TokenKind): Token {
    const t = this.peek();
    if (t.kind !== kind) {
      throw new PQLSyntaxError(
        `Expected ${TokenKind[kind]} but got '${t.value || 'EOF'}' at position ${t.pos}`,
        t.pos,
      );
    }
    return this.consume();
  }

  parse(): ASTNode {
    const node = this.parseExpr();
    this.expect(TokenKind.EOF);
    return node;
  }

  private parseExpr(): ASTNode {
    let left = this.parseTerm();
    while (this.peek().kind === TokenKind.OR) {
      this.consume();
      const right = this.parseTerm();
      left = { type: 'or', left, right };
    }
    return left;
  }

  private parseTerm(): ASTNode {
    let left = this.parseFactor();
    while (this.peek().kind === TokenKind.AND) {
      this.consume();
      const right = this.parseFactor();
      left = { type: 'and', left, right };
    }
    return left;
  }

  private parseFactor(): ASTNode {
    if (this.peek().kind === TokenKind.LPAREN) {
      this.consume();
      const node = this.parseExpr();
      this.expect(TokenKind.RPAREN);
      return node;
    }
    return this.parseComparison();
  }

  private parseComparison(): ASTNode {
    const { field } = this.parseLeftSide();
    const opPos = this.peek().pos;
    const operator = this.parseOperator();

    const allowed = FIELD_OPERATORS[field];
    if (!allowed.includes(operator)) {
      throw new PQLSyntaxError(
        `Operator '${operator}' is not valid for field '${field}'`,
        opPos,
      );
    }

    const value = this.parseValue(field, operator);
    return { type: 'comparison', field, operator, value };
  }

  private parseLeftSide(): { field: PQLField } {
    const t = this.peek();
    if (t.kind !== TokenKind.IDENTIFIER) {
      throw new PQLSyntaxError(
        `Expected field name but got '${t.value || 'EOF'}' at position ${t.pos}`,
        t.pos,
      );
    }
    this.consume();
    const lower = t.value; // already lowercase from lexer

    const isCountField = lower === 'commentscount' || lower === 'labelscount';

    if (isCountField) {
      // Must be called as a function: commentsCount() / labelsCount()
      if (this.peek().kind !== TokenKind.LPAREN) {
        throw new PQLSyntaxError(
          `Field '${lower}' must be used as a function: ${lower}()`,
          t.pos,
        );
      }
      this.consume(); // '('
      this.expect(TokenKind.RPAREN);
    } else if (this.peek().kind === TokenKind.LPAREN) {
      // Unknown function
      throw new PQLSyntaxError(
        `Unknown function '${lower}()' at position ${t.pos}`,
        t.pos,
      );
    }

    const field = FIELD_MAP[lower];
    if (!field) {
      throw new PQLSyntaxError(`Unknown field '${lower}' at position ${t.pos}`, t.pos);
    }

    return { field };
  }

  private parseOperator(): PQLOperator {
    const t = this.peek();

    switch (t.kind) {
      case TokenKind.IS:           this.consume(); return 'IS';
      case TokenKind.EQ:           this.consume(); return 'EQ';
      case TokenKind.NEQ:          this.consume(); return 'NEQ';
      case TokenKind.CONTAINS:     this.consume(); return 'CONTAINS';
      case TokenKind.CONTAINS_ALL: this.consume(); return 'CONTAINS_ALL';
      case TokenKind.IN:           this.consume(); return 'IN';
      case TokenKind.BEFORE:       this.consume(); return 'BEFORE';
      case TokenKind.AFTER:        this.consume(); return 'AFTER';
      case TokenKind.HAS:          this.consume(); return 'HAS';
      case TokenKind.GT:           this.consume(); return 'GT';
      case TokenKind.LT:           this.consume(); return 'LT';
      case TokenKind.GTE:          this.consume(); return 'GTE';
      case TokenKind.LTE:          this.consume(); return 'LTE';
      case TokenKind.NOT: {
        this.consume();
        const next = this.peek();
        if (next.kind === TokenKind.IS)       { this.consume(); return 'NOT_IS'; }
        if (next.kind === TokenKind.CONTAINS) { this.consume(); return 'NOT_CONTAINS'; }
        if (next.kind === TokenKind.IN)       { this.consume(); return 'NOT_IN'; }
        if (next.kind === TokenKind.HAS)      { this.consume(); return 'NOT_HAS'; }
        throw new PQLSyntaxError(
          `Expected IS, CONTAINS, IN, or HAS after NOT at position ${next.pos}`,
          next.pos,
        );
      }
      default:
        throw new PQLSyntaxError(
          `Expected operator but got '${t.value || 'EOF'}' at position ${t.pos}`,
          t.pos,
        );
    }
  }

  private parseValue(field: PQLField, operator: PQLOperator): PQLValue {
    // HAS / NOT_HAS on these fields take no explicit value
    if (NO_VALUE_HAS_FIELDS.has(field) && (operator === 'HAS' || operator === 'NOT_HAS')) {
      return { type: 'empty' };
    }

    const t = this.peek();

    if (t.kind === TokenKind.EMPTY) {
      this.consume();
      return { type: 'empty' };
    }

    if (t.kind === TokenKind.NUMBER) {
      this.consume();
      return { type: 'number', value: parseInt(t.value, 10) };
    }

    if (t.kind === TokenKind.STRING) {
      this.consume();
      return { type: 'string', value: t.value };
    }

    // List: ('a', 'b', ...)
    if (t.kind === TokenKind.LPAREN) {
      this.consume();
      const values: string[] = [];
      const first = this.expect(TokenKind.STRING);
      values.push(first.value);
      while (this.peek().kind === TokenKind.COMMA) {
        this.consume();
        const item = this.expect(TokenKind.STRING);
        values.push(item.value);
      }
      this.expect(TokenKind.RPAREN);
      return { type: 'list', values };
    }

    // func_value: currentDate()
    if (t.kind === TokenKind.IDENTIFIER) {
      if (t.value === 'currentdate') {
        this.consume();
        this.expect(TokenKind.LPAREN);
        this.expect(TokenKind.RPAREN);
        return { type: 'fn_date' };
      }
      throw new PQLSyntaxError(
        `Unknown function '${t.value}' at position ${t.pos}`,
        t.pos,
      );
    }

    throw new PQLSyntaxError(
      `Expected value but got '${t.value || 'EOF'}' at position ${t.pos}`,
      t.pos,
    );
  }
}

export function parse(tokens: Token[]): ASTNode {
  return new Parser(tokens).parse();
}
