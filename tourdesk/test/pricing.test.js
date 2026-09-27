'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Pricing = require('../public/pricing.js');

test('computes hotels, vehicle, extras, markup and GST', () => {
  const t = Pricing.compute({
    days: [{ rate: 4000 }, { rate: 3500 }, { rate: 4000 }, { rate: 0 }],
    rooms: 2, pax: 4, vehicle_rate: 4500, extras_pp: 600, extra_lines: [{ amount: 1000 }], markup_pct: 15, gst_pct: 5,
  });
  assert.strictEqual(t.nights, 3);
  assert.strictEqual(t.hotel, (4000 + 3500 + 4000) * 2);   // 23,000
  assert.strictEqual(t.vehicle, 4500 * 4);                   // 18,000
  assert.strictEqual(t.extras, 600 * 4 + 1000);              // 3,400
  assert.strictEqual(t.cost, 44400);
  assert.strictEqual(t.markup, 6660);
  assert.strictEqual(t.subtotal, 51060);
  assert.strictEqual(t.gst, 2553);
  assert.strictEqual(t.total, 53613);
  assert.strictEqual(t.per_person, 13403);
});

test('handles zero rooms, zero markup and bad numbers safely', () => {
  const t = Pricing.compute({ days: [{ rate: 'x' }], rooms: -3, pax: 0, vehicle_rate: null, markup_pct: -5, gst_pct: 0 });
  assert.deepStrictEqual([t.hotel, t.vehicle, t.markup, t.total, t.per_person], [0, 0, 0, 0, 0]);
});

test('advance rounds up to the nearest 100', () => {
  assert.strictEqual(Pricing.advance(53613, 30), 16100);
  assert.strictEqual(Pricing.advance(10000, 30), 3000);
  assert.strictEqual(Pricing.advance(0, 30), 0);
});

test('money formats in Indian digit grouping', () => {
  assert.strictEqual(Pricing.money(1234567), '₹12,34,567');
  assert.strictEqual(Pricing.money(-500), '-₹500');
});
