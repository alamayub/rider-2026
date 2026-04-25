import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeUserPhone } from '../utils/phone.js';

test('normalizeUserPhone strips +91 and keeps national digits', () => {
  assert.equal(normalizeUserPhone('+91 98765 43210'), '9876543210');
  assert.equal(normalizeUserPhone('00919876543210'), '9876543210');
});

test('normalizeUserPhone strips +977', () => {
  assert.equal(normalizeUserPhone('+9779812345678'), '9812345678');
});

test('normalizeUserPhone leaves 10-digit national input unchanged', () => {
  assert.equal(normalizeUserPhone('9812345678'), '9812345678');
});

test('normalizeUserPhone strips NANP +1', () => {
  assert.equal(normalizeUserPhone('+12125551234'), '2125551234');
});
