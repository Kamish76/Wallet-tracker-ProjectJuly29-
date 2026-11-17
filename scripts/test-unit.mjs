import assert from 'node:assert/strict';
import { evaluateMathExpression } from '../src/lib/utils/math.ts';
import { generateUUID, isValidUUID } from '../src/lib/utils/uuid.ts';
import { formatLocalDateInput, mergeDateWithOriginalTime } from '../src/lib/utils/date.ts';

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

// 3. Local Date Formatting & Time Preservation
assert.equal(formatLocalDateInput(null), '');
assert.equal(formatLocalDateInput('not-a-date'), '');
const localSample = new Date(2026, 10, 17, 23, 55, 12, 345);
assert.equal(formatLocalDateInput(localSample.toISOString()), '2026-11-17');

// Same date returns original ISO verbatim
assert.equal(
  mergeDateWithOriginalTime('2026-11-17', localSample.toISOString()),
  localSample.toISOString()
);

// Different date preserves original local hours/minutes/seconds/ms
const shiftedIso = mergeDateWithOriginalTime('2026-11-15', localSample.toISOString());
const shiftedDate = new Date(shiftedIso);
assert.equal(formatLocalDateInput(shiftedIso), '2026-11-15');
assert.equal(shiftedDate.getHours(), 23);
assert.equal(shiftedDate.getMinutes(), 55);
assert.equal(shiftedDate.getSeconds(), 12);
assert.equal(shiftedDate.getMilliseconds(), 345);
console.log('✓ formatLocalDateInput & mergeDateWithOriginalTime passed all cases');

console.log('All unit self-checks passed successfully.');
