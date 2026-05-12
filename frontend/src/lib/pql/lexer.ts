import type { Token } from './types';
import { TokenKind } from './types';

export class PQLSyntaxError extends Error {
  constructor(message: string, public pos: number) {
    super(message);
    this.name = 'PQLSyntaxError';
  }
}

const KEYWORDS: Record<string, TokenKind> = {
  AND:          TokenKind.AND,
  OR:           TokenKind.OR,
  IS:           TokenKind.IS,
  NOT:          TokenKind.NOT,
  CONTAINS_ALL: TokenKind.CONTAINS_ALL,
  CONTAINS:     TokenKind.CONTAINS,
  IN:           TokenKind.IN,
  BEFORE:       TokenKind.BEFORE,
  AFTER:        TokenKind.AFTER,
  HAS:          TokenKind.HAS,
  EMPTY:        TokenKind.EMPTY,
};

export function tokenize(query: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = query.length;

  while (i < len) {
    if (/\s/.test(query[i])) { i++; continue; }

    const pos = i;
    const ch = query[i];

    // String literals (double or single quotes with escape support)
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      let str = '';
      while (i < len) {
        const c = query[i];
        if (c === '\\' && i + 1 < len && query[i + 1] === quote) {
          str += quote;
          i += 2;
        } else if (c === quote) {
          i++;
          break;
        } else {
          str += c;
          i++;
        }
      }
      tokens.push({ kind: TokenKind.STRING, value: str, pos });
      continue;
    }

    // Numbers
    if (/[0-9]/.test(ch)) {
      let num = '';
      while (i < len && /[0-9]/.test(query[i])) num += query[i++];
      tokens.push({ kind: TokenKind.NUMBER, value: num, pos });
      continue;
    }

    // Identifiers and keywords (including CONTAINS_ALL with underscore)
    if (/[a-zA-Z_]/.test(ch)) {
      let ident = '';
      while (i < len && /[a-zA-Z0-9_]/.test(query[i])) ident += query[i++];
      const upper = ident.toUpperCase();
      if (upper in KEYWORDS) {
        tokens.push({ kind: KEYWORDS[upper], value: ident, pos });
      } else {
        tokens.push({ kind: TokenKind.IDENTIFIER, value: ident.toLowerCase(), pos });
      }
      continue;
    }

    // Symbols
    if (ch === '(') { tokens.push({ kind: TokenKind.LPAREN, value: '(', pos }); i++; continue; }
    if (ch === ')') { tokens.push({ kind: TokenKind.RPAREN, value: ')', pos }); i++; continue; }
    if (ch === ',') { tokens.push({ kind: TokenKind.COMMA,  value: ',', pos }); i++; continue; }
    if (ch === '=') { tokens.push({ kind: TokenKind.EQ,     value: '=', pos }); i++; continue; }

    if (ch === '>') {
      if (i + 1 < len && query[i + 1] === '=') {
        tokens.push({ kind: TokenKind.GTE, value: '>=', pos }); i += 2;
      } else {
        tokens.push({ kind: TokenKind.GT, value: '>', pos }); i++;
      }
      continue;
    }

    if (ch === '<') {
      if (i + 1 < len && query[i + 1] === '=') {
        tokens.push({ kind: TokenKind.LTE, value: '<=', pos }); i += 2;
      } else {
        tokens.push({ kind: TokenKind.LT, value: '<', pos }); i++;
      }
      continue;
    }

    if (ch === '!') {
      if (i + 1 < len && query[i + 1] === '=') {
        tokens.push({ kind: TokenKind.NEQ, value: '!=', pos }); i += 2;
        continue;
      }
      throw new PQLSyntaxError(`Unexpected character '!' at position ${pos}`, pos);
    }

    throw new PQLSyntaxError(`Unexpected character '${ch}' at position ${pos}`, pos);
  }

  tokens.push({ kind: TokenKind.EOF, value: '', pos: i });
  return tokens;
}
