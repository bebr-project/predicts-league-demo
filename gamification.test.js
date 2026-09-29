import test from 'node:test';
import assert from 'node:assert/strict';
import { achievementProgress, unlockedReactions, toggleReaction } from './gamification.js';

test('the first bet unlocks its reaction, with later branch goals still locked', () => {
  const progress = achievementProgress({ m1: {} });
  assert.deepEqual(progress.map(item => item.unlocked), [true, false, false, false]);
  assert.ok(unlockedReactions({ m1: {} }).includes('💪'));
  assert.ok(!unlockedReactions({ m1: {} }).includes('🔥'));
});

test('chat and additional bets unlock independent branches', () => {
  const bets = { m1: {}, m3: {}, m4: {} };
  const messages = [{ author: 'anna' }, { author: 'you' }];
  assert.deepEqual(achievementProgress(bets, messages).map(item => item.unlocked), [true, true, false, true]);
  assert.ok(unlockedReactions(bets, messages).includes('🎉'));
});

test('locked reactions cannot be added and unlocked reactions can be toggled', () => {
  const available = unlockedReactions({ m1: {} });
  assert.deepEqual(toggleReaction({}, 'you', '👑', available), {});
  const added = toggleReaction({}, 'you', '💪', available);
  assert.deepEqual(added, { you: ['💪'] });
  assert.deepEqual(toggleReaction(added, 'you', '💪', available), { you: [] });
});
