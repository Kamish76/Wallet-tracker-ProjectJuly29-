import assert from 'node:assert/strict';
import { evaluateMathExpression } from '../src/lib/utils/math.ts';
import { generateUUID, isValidUUID } from '../src/lib/utils/uuid.ts';

console.log('--- Running Unit Self-Checks ---');

// 1. Math Expression Evaluator
assert.equal(evaluateMathExpression('10+5'), 15);
assert.equal(evaluateMathExpression('10-5'), 5);
assert.equal(evaluateMathExpression('10×5'), 50);
assert.equal(evaluateMathExpression('10÷2'), 5);
assert.equal(evaluateMathExpression('2+3*4'), 14); // operator precedence
assert.equal(evaluateMathExpression('10 * -2'), -20); // unary minus
assert.equal(evaluateMathExpression('5 + -3'), 2); // unary minus
assert.equal(evaluateMathExpression('-5 + 10'), 5); // leading negative
assert.equal(evaluateMathExpression('0'), 0);
assert.equal(evaluateMathExpression(''), 0);
console.log('✓ evaluateMathExpression passed all cases');

// 2. UUID Generator & Validator
const id = generateUUID();
assert.equal(typeof id, 'string');
assert.equal(isValidUUID(id), true);
assert.equal(isValidUUID('invalid-uuid'), false);
assert.equal(isValidUUID(null), false);
assert.equal(isValidUUID('123e4567-e89b-12d3-a456-426614174000'), true);
console.log('✓ UUID generator & validator passed all cases');

console.log('All unit self-checks passed successfully.');
