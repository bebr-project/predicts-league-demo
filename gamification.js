// A small, achievable offline illustration of the full project's achievement rules.
export const STARTER_REACTIONS = ['👀', '🤔', '👏', '📈'];
export const DEMO_ACHIEVEMENTS = [
  { id: 'first_step', branch: 'Прогнозы', title: 'Первый шаг', description: 'Сделать первый прогноз', target: 1, reward: '💪' },
  { id: 'three_bets', branch: 'Прогнозы', title: 'В игре', description: 'Сделать 3 прогноза', target: 3, reward: '🔥' },
  { id: 'five_bets', branch: 'Прогнозы', title: 'Постоянный участник', description: 'Сделать 5 прогнозов', target: 5, reward: '👑' },
  { id: 'first_chat', branch: 'Общение', title: 'Голос в чате', description: 'Отправить сообщение', target: 1, reward: '🎉' }
];

export function achievementProgress(bets = {}, messages = []) {
  const betCount = Object.keys(bets).length;
  const chatCount = messages.filter(message => message.author === 'you').length;
  return DEMO_ACHIEVEMENTS.map(achievement => {
    const current = achievement.id === 'first_chat' ? chatCount : betCount;
    return { ...achievement, current: Math.min(current, achievement.target), unlocked: current >= achievement.target };
  });
}

export function unlockedReactions(bets = {}, messages = []) {
  return [...STARTER_REACTIONS, ...achievementProgress(bets, messages).filter(item => item.unlocked).map(item => item.reward)];
}

export function toggleReaction(reactions = {}, userId, emoji, available) {
  if (!available.includes(emoji)) return reactions;
  const current = Array.isArray(reactions[userId]) ? reactions[userId] : [];
  const next = current.includes(emoji) ? current.filter(item => item !== emoji) : [...current, emoji];
  return { ...reactions, [userId]: next };
}
