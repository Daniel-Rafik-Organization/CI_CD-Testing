const test = require('node:test');
const assert = require('node:assert/strict');
const { formatGreeting } = require('../src/greeting.js');

test('formatGreeting returns a trimmed greeting', () => {
  assert.equal(formatGreeting('CI/CD lab'), 'Hello, CI/CD lab!');
});

test('formatGreeting rejects empty names', () => {
  assert.throws(() => formatGreeting('   '), RangeError);
});

test('formatGreeting rejects missing names', () => {
  assert.throws(() => formatGreeting(), TypeError);
});
