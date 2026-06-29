export class PolicyExpressionError extends Error {
  constructor(message, position = undefined) {
    super(position === undefined ? message : `${message} at position ${position}`);
    this.name = 'PolicyExpressionError';
    this.position = position;
  }
}

const TOKEN_TYPES = new Set([
  'identifier',
  'string',
  'boolean',
  '==',
  '!=',
  '[',
  ']',
  '(',
  ')',
  ',',
  'and',
  'or',
  'in',
  'not',
  'eof',
]);

export function tokenizeExpression(input) {
  const tokens = [];
  let index = 0;

  while (index < input.length) {
    const char = input[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (char === '=' && input[index + 1] === '=') {
      tokens.push({ type: '==', value: '==', position: index });
      index += 2;
      continue;
    }

    if (char === '!' && input[index + 1] === '=') {
      tokens.push({ type: '!=', value: '!=', position: index });
      index += 2;
      continue;
    }

    if ('[](),'.includes(char)) {
      tokens.push({ type: char, value: char, position: index });
      index += 1;
      continue;
    }

    if (char === '\'' || char === '"') {
      const quote = char;
      let value = '';
      const start = index;
      index += 1;

      while (index < input.length) {
        const current = input[index];
        if (current === '\\') {
          if (index + 1 >= input.length) {
            throw new PolicyExpressionError('Unterminated string escape', index);
          }
          value += input[index + 1];
          index += 2;
          continue;
        }
        if (current === quote) {
          index += 1;
          tokens.push({ type: 'string', value, position: start });
          value = undefined;
          break;
        }
        value += current;
        index += 1;
      }

      if (value !== undefined) {
        throw new PolicyExpressionError('Unterminated string literal', start);
      }
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      const start = index;
      let value = char;
      index += 1;
      while (index < input.length && /[A-Za-z0-9_]/.test(input[index])) {
        value += input[index];
        index += 1;
      }

      if (value === 'true' || value === 'false') {
        tokens.push({ type: 'boolean', value: value === 'true', position: start });
      } else if (['and', 'or', 'in', 'not'].includes(value)) {
        tokens.push({ type: value, value, position: start });
      } else {
        tokens.push({ type: 'identifier', value, position: start });
      }
      continue;
    }

    throw new PolicyExpressionError(`Unexpected character ${JSON.stringify(char)}`, index);
  }

  tokens.push({ type: 'eof', value: undefined, position: input.length });
  return tokens;
}

class Parser {
  constructor(input) {
    this.input = input;
    this.tokens = tokenizeExpression(input);
    this.index = 0;
  }

  peek() {
    return this.tokens[this.index];
  }

  match(...types) {
    const token = this.peek();
    if (types.includes(token.type)) {
      this.index += 1;
      return token;
    }
    return undefined;
  }

  expect(type) {
    const token = this.match(type);
    if (!token) {
      throw new PolicyExpressionError(`Expected ${type}, got ${this.peek().type}`, this.peek().position);
    }
    return token;
  }

  parse() {
    const expression = this.parseOr();
    this.expect('eof');
    return expression;
  }

  parseOr() {
    let left = this.parseAnd();
    while (this.match('or')) {
      left = { type: 'logical', operator: 'or', left, right: this.parseAnd() };
    }
    return left;
  }

  parseAnd() {
    let left = this.parseComparison();
    while (this.match('and')) {
      left = { type: 'logical', operator: 'and', left, right: this.parseComparison() };
    }
    return left;
  }

  parseComparison() {
    const left = this.parsePrimary();

    const equality = this.match('==', '!=');
    if (equality) {
      return { type: 'comparison', operator: equality.type, left, right: this.parsePrimary() };
    }

    if (this.match('in')) {
      return { type: 'comparison', operator: 'in', left, right: this.parsePrimary() };
    }

    if (this.match('not')) {
      this.expect('in');
      return { type: 'comparison', operator: 'not in', left, right: this.parsePrimary() };
    }

    return left;
  }

  parsePrimary() {
    const token = this.peek();

    if (this.match('(')) {
      const expression = this.parseOr();
      this.expect(')');
      return expression;
    }

    if (this.match('[')) {
      const values = [];
      if (!this.match(']')) {
        do {
          values.push(this.parseLiteral());
        } while (this.match(','));
        this.expect(']');
      }
      return { type: 'array', values };
    }

    if (token.type === 'identifier') {
      this.index += 1;
      return { type: 'identifier', name: token.value };
    }

    return this.parseLiteral();
  }

  parseLiteral() {
    const token = this.match('string', 'boolean');
    if (!token) {
      throw new PolicyExpressionError(`Expected literal, got ${this.peek().type}`, this.peek().position);
    }
    return { type: 'literal', value: token.value };
  }
}

export function parseExpression(input) {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new PolicyExpressionError('Expression must be a non-empty string');
  }
  return new Parser(input).parse();
}

export function collectIdentifiers(ast, output = new Set()) {
  if (!ast) return output;
  if (ast.type === 'identifier') {
    output.add(ast.name);
    return output;
  }
  if (ast.type === 'logical' || ast.type === 'comparison') {
    collectIdentifiers(ast.left, output);
    collectIdentifiers(ast.right, output);
    return output;
  }
  if (ast.type === 'array') {
    for (const value of ast.values) collectIdentifiers(value, output);
  }
  return output;
}

function literalValues(node) {
  if (node.type === 'literal') return [node.value];
  if (node.type === 'array') return node.values.flatMap(literalValues);
  return [];
}

function validateAst(ast, axes, errors) {
  if (ast.type === 'identifier') {
    if (!Object.hasOwn(axes, ast.name)) {
      errors.push(`Unknown field: ${ast.name}`);
    }
    return;
  }

  if (ast.type === 'logical') {
    validateAst(ast.left, axes, errors);
    validateAst(ast.right, axes, errors);
    return;
  }

  if (ast.type === 'comparison') {
    if (ast.left.type !== 'identifier') {
      errors.push('Comparison left side must be a field name');
    } else if (!Object.hasOwn(axes, ast.left.name)) {
      errors.push(`Unknown field: ${ast.left.name}`);
    }

    const fieldValues = ast.left.type === 'identifier' ? axes[ast.left.name] : undefined;
    if (ast.operator === 'in' || ast.operator === 'not in') {
      if (ast.right.type !== 'array') {
        errors.push(`${ast.operator} right side must be an array literal`);
      }
    } else if (ast.right.type !== 'literal') {
      errors.push(`${ast.operator} right side must be a string or boolean literal`);
    }

    if (Array.isArray(fieldValues)) {
      for (const value of literalValues(ast.right)) {
        if (!fieldValues.includes(value)) {
          errors.push(`Value ${JSON.stringify(value)} is not allowed for ${ast.left.name}; expected one of ${fieldValues.map((item) => JSON.stringify(item)).join(', ')}`);
        }
      }
    }
    return;
  }

  if (ast.type === 'array') {
    for (const value of ast.values) validateAst(value, axes, errors);
  }
}

export function validateExpression(input, axes = {}) {
  const errors = [];
  let ast;

  try {
    ast = parseExpression(input);
  } catch (error) {
    if (error instanceof PolicyExpressionError) {
      errors.push(error.message);
      return { ast: undefined, identifiers: [], errors };
    }
    throw error;
  }

  validateAst(ast, axes, errors);
  return { ast, identifiers: [...collectIdentifiers(ast)], errors };
}

function evaluateNode(node, context) {
  if (node.type === 'literal') return node.value;
  if (node.type === 'identifier') return context[node.name];
  if (node.type === 'array') return node.values.map((value) => evaluateNode(value, context));

  if (node.type === 'logical') {
    if (node.operator === 'and') return Boolean(evaluateNode(node.left, context)) && Boolean(evaluateNode(node.right, context));
    if (node.operator === 'or') return Boolean(evaluateNode(node.left, context)) || Boolean(evaluateNode(node.right, context));
  }

  if (node.type === 'comparison') {
    const left = evaluateNode(node.left, context);
    const right = evaluateNode(node.right, context);
    if (node.operator === '==') return left === right;
    if (node.operator === '!=') return left !== right;
    if (node.operator === 'in') return Array.isArray(right) && right.includes(left);
    if (node.operator === 'not in') return Array.isArray(right) && !right.includes(left);
  }

  throw new PolicyExpressionError(`Cannot evaluate node type: ${node.type}`);
}

export function evaluateExpression(inputOrAst, context = {}) {
  const ast = typeof inputOrAst === 'string' ? parseExpression(inputOrAst) : inputOrAst;
  return Boolean(evaluateNode(ast, context));
}

export function selectProvider(policy, context = {}) {
  if (!policy || typeof policy !== 'object') {
    throw new PolicyExpressionError('Policy must be a mapping');
  }
  if (typeof policy.default !== 'string' || policy.default.trim() === '') {
    throw new PolicyExpressionError('Policy must define a default provider');
  }

  for (const [index, rule] of (policy.rules ?? []).entries()) {
    if (!rule || typeof rule !== 'object') {
      throw new PolicyExpressionError(`Policy rule ${index} must be a mapping`);
    }
    if (typeof rule.when !== 'string' || rule.when.trim() === '') {
      throw new PolicyExpressionError(`Policy rule ${index} must define when`);
    }
    if (typeof rule.provider !== 'string' || rule.provider.trim() === '') {
      throw new PolicyExpressionError(`Policy rule ${index} must define provider`);
    }

    if (evaluateExpression(rule.when, context)) {
      return {
        selected_provider: rule.provider,
        used_default: false,
        matched_rule: {
          index,
          when: rule.when,
          reason: rule.reason ?? null,
        },
      };
    }
  }

  return {
    selected_provider: policy.default,
    used_default: true,
    matched_rule: null,
  };
}
