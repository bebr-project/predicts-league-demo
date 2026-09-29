import test from 'node:test';
import assert from 'node:assert/strict';
import { marketsFor, requiredStake, balanceFor, validateBet, betWon } from './core.js';

const base = Date.now();
const matches = [
  { id: 'a', home: 'А', away: 'Б', kickoff: new Date(base - 100_000).toISOString(), status: 'FT', score: [2, 1], odds: [2, 3, 4] },
  { id: 'b', home: 'В', away: 'Г', kickoff: new Date(base - 80_000).toISOString(), status: 'FT', score: [1, 1], odds: [2, 3, 4] },
  { id: 'c', home: 'Д', away: 'Е', kickoff: new Date(base + 100_000).toISOString(), status: 'NS', odds: [2, 3, 4] },
  { id: 'd', home: 'Ж', away: 'З', kickoff: new Date(base + 200_000).toISOString(), status: 'NS', odds: [2, 3, 4] }
];

test('the demo exposes exactly four market groups and both 3.5 totals', () => {
  const markets = marketsFor(matches[2]);
  assert.deepEqual(markets.map(market => market.id), ['outcome', 'double', 'btts', 'total']);
  assert.deepEqual(markets[3].options.slice(-2).map(option => option.id), ['OVER_3_5', 'UNDER_3_5']);
});

test('missed finished matches raise minimum by 70 until a bet resets it', () => {
  assert.equal(requiredStake(matches, {}, 'c', base), 210);
  assert.equal(requiredStake(matches, { a: { outcome: 'P1', stake: 70 } }, 'c', base), 140);
  assert.equal(requiredStake(matches, { b: { outcome: 'X', stake: 140 } }, 'c', base), 70);
  assert.equal(requiredStake(matches, { c: { outcome: 'P1', stake: 210 } }, 'd', base), 70);
});

test('validation rejects a lower-than-required stake and overspending', () => {
  assert.match(validateBet(matches, {}, 'c', 'P1', 70, base), /210/);
  assert.match(validateBet(matches, {}, 'c', 'P1', 401, base), /Не хватает/);
  assert.equal(validateBet(matches, {}, 'c', 'P1', 210, base), '');
  assert.match(validateBet(matches, {}, 'a', 'P1', 70, base), /закрыт/);
});

test('settled wins, losses, and reserved points affect balances correctly', () => {
  const bets = { a: { outcome: 'P1', stake: 70 }, b: { outcome: 'P1', stake: 70 }, c: { outcome: 'P1', stake: 140 } };
  assert.equal(betWon(matches[0], 'P1'), true);
  assert.equal(betWon(matches[1], 'P1'), false);
  assert.deepEqual(balanceFor(matches, bets), { settled: 400, reserved: 140, available: 260 });
});

test('editing an existing bet reuses its reserved points', () => {
  const bets = { c: { outcome: 'P1', stake: 300 } };
  assert.equal(validateBet(matches, bets, 'c', 'P2', 350, base), '');
  assert.match(validateBet(matches, bets, 'c', 'P2', 401, base), /Не хватает/);
});
