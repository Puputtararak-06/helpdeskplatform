// tests/validators.test.mjs
// Unit tests for validator functions (mirror src/lib/validators.ts logic).
// Run: node --test What-i-can/tests/validators.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Mirror constants from validators.ts
const CATEGORIES = ['keys', 'wallet', 'electronics', 'bag', 'clothing', 'other'];
const STATUSES = ['found', 'claimed'];
const STUDENT_ID_REGEX = /^\d{10}$/;

// Mirror functions
function vItemName(raw) {
  const v = typeof raw === 'string' ? raw.trim() : '';
  if (!v) return { ok: false, field: 'item_name', message: 'required' };
  if (v.length < 1 || v.length > 100) return { ok: false, field: 'item_name', message: '1-100 chars' };
  return { ok: true, value: v };
}

function vCategory(raw) {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!CATEGORIES.includes(v)) {
    return { ok: false, field: 'category', message: `must be one of ${CATEGORIES.join(', ')}` };
  }
  return { ok: true, value: v };
}

function vStatus(raw) {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!STATUSES.includes(v)) {
    return { ok: false, field: 'status', message: `must be one of ${STATUSES.join(', ')}` };
  }
  return { ok: true, value: v };
}

function vStudentId(raw, field = 'student_id') {
  const v = typeof raw === 'string' ? raw.trim() : '';
  if (!v) return { ok: false, field, message: 'required' };
  if (!STUDENT_ID_REGEX.test(v)) return { ok: false, field, message: 'must be 10 digits' };
  return { ok: true, value: v };
}

function vLocationFound(raw) {
  const v = typeof raw === 'string' ? raw.trim() : '';
  if (!v) return { ok: false, field: 'location_found', message: 'required' };
  if (v.length < 1 || v.length > 200) return { ok: false, field: 'location_found', message: '1-200 chars' };
  return { ok: true, value: v };
}

// ---- Tests ----

test('vItemName: trims whitespace', () => {
  const r = vItemName('  wallet  ');
  assert.equal(r.value, 'wallet');
});

test('vItemName: rejects empty', () => {
  const r = vItemName('');
  assert.equal(r.ok, false);
  assert.equal(r.field, 'item_name');
});

test('vItemName: rejects too long', () => {
  const r = vItemName('a'.repeat(101));
  assert.equal(r.ok, false);
  assert.match(r.message, /1-100/);
});

test('vItemName: accepts 100 chars', () => {
  const r = vItemName('a'.repeat(100));
  assert.equal(r.ok, true);
});

test('vCategory: accepts all valid categories', () => {
  for (const cat of CATEGORIES) {
    const r = vCategory(cat);
    assert.equal(r.ok, true);
    assert.equal(r.value, cat);
  }
});

test('vCategory: case-insensitive', () => {
  const r = vCategory('WALLET');
  assert.equal(r.value, 'wallet');
});

test('vCategory: rejects unknown', () => {
  const r = vCategory('spaceship');
  assert.equal(r.ok, false);
});

test('vCategory: rejects empty', () => {
  const r = vCategory('');
  assert.equal(r.ok, false);
});

test('vStatus: accepts found/claimed (no lost after simplification)', () => {
  assert.equal(vStatus('found').ok, true);
  assert.equal(vStatus('claimed').ok, true);
});

test('vStatus: rejects lost (removed from enum)', () => {
  const r = vStatus('lost');
  assert.equal(r.ok, false);
});

test('vStudentId: accepts 10 digits', () => {
  const r = vStudentId('6731503031');
  assert.equal(r.ok, true);
  assert.equal(r.value, '6731503031');
});

test('vStudentId: rejects 9 digits', () => {
  const r = vStudentId('673150303');
  assert.equal(r.ok, false);
});

test('vStudentId: rejects 11 digits', () => {
  const r = vStudentId('67315030311');
  assert.equal(r.ok, false);
});

test('vStudentId: rejects letters', () => {
  const r = vStudentId('abcdefghij');
  assert.equal(r.ok, false);
});

test('vStudentId: rejects with spaces', () => {
  const r = vStudentId('6731 5030 1');
  assert.equal(r.ok, false);
});

test('vStudentId: rejects empty', () => {
  const r = vStudentId('');
  assert.equal(r.ok, false);
});

test('vStudentId: custom field name', () => {
  const r = vStudentId('', 'claimed_by_student_id');
  assert.equal(r.field, 'claimed_by_student_id');
});

test('vLocationFound: accepts normal string', () => {
  const r = vLocationFound('Library Floor 2');
  assert.equal(r.ok, true);
});

test('vLocationFound: rejects empty', () => {
  const r = vLocationFound('');
  assert.equal(r.ok, false);
});

test('vLocationFound: rejects too long', () => {
  const r = vLocationFound('a'.repeat(201));
  assert.equal(r.ok, false);
});

test('vLocationFound: accepts 200 chars', () => {
  const r = vLocationFound('a'.repeat(200));
  assert.equal(r.ok, true);
});

test('vLocationFound: trims whitespace', () => {
  const r = vLocationFound('  Building A  ');
  assert.equal(r.value, 'Building A');
});

// End-to-end: create item validation flow
test('Valid item passes all checks', () => {
  const body = {
    item_name: 'Black Wallet',
    category: 'wallet',
    location_found: 'Building A',
    finder_student_id: '6731503031',
  };
  const r1 = vItemName(body.item_name);
  const r2 = vCategory(body.category);
  const r3 = vLocationFound(body.location_found);
  const r4 = vStudentId(body.finder_student_id, 'finder_student_id');
  assert.equal(r1.ok && r2.ok && r3.ok && r4.ok, true);
});

test('Invalid category blocks item creation', () => {
  const body = { category: 'invalid' };
  const r = vCategory(body.category);
  assert.equal(r.ok, false);
});
