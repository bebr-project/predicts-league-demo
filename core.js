// A self-contained extraction of the project's prediction rules.
// All prices and results used by the demo are invented sample data.
export const MIN_STAKE = 70;

function price(probability) {
  const value = Math.max(0.04, Math.min(0.96, Number(probability) || 0.5));
  return Math.max(1.05, Math.min(12, Math.floor(100 / (value * 1.06)) / 100));
}

function poissonCdf(lambda, maximum) {
  let term = Math.exp(-lambda);
  let sum = term;
  for (let goals = 1; goals <= maximum; goals++) {
    term *= lambda / goals;
    sum += term;
  }
  return sum;
}

export function marketsFor(match) {
  const { home, away, odds } = match;
  const [homeOdds, drawOdds, awayOdds] = odds;
  const implied = odds.map(value => 1 / value);
  const margin = implied.reduce((sum, value) => sum + value, 0);
  const [homeChance, drawChance, awayChance] = implied.map(value => value / margin);
  const goals = Math.max(2.05, Math.min(3.35,
    2.45 + (0.28 - drawChance) * 1.7 + Math.abs(homeChance - awayChance) * 0.65));
  const homeShare = Math.max(0.28, Math.min(0.72, 0.5 + (homeChance - awayChance) * 0.45));
  const bothScore = (1 - Math.exp(-goals * homeShare)) * (1 - Math.exp(-goals * (1 - homeShare)));
  const doubleChance = (a, b) => Math.floor(100 / (1 / a + 1 / b)) / 100;

  return [
    { id: 'outcome', label: 'Исход', options: [
      { id: 'P1', label: home, odds: homeOdds },
      { id: 'X', label: 'Ничья', odds: drawOdds },
      { id: 'P2', label: away, odds: awayOdds }
    ] },
    { id: 'double', label: 'Двойной шанс', options: [
      { id: 'DC_1X', label: '1X', odds: doubleChance(homeOdds, drawOdds) },
      { id: 'DC_X2', label: 'X2', odds: doubleChance(drawOdds, awayOdds) },
      { id: 'DC_12', label: '12', odds: doubleChance(homeOdds, awayOdds) }
    ] },
    { id: 'btts', label: 'Обе забьют', options: [
      { id: 'BTTS_YES', label: 'Да', odds: price(bothScore) },
      { id: 'BTTS_NO', label: 'Нет', odds: price(1 - bothScore) }
    ] },
    { id: 'total', label: 'Тотал голов', options: [1.5, 2.5, 3.5].flatMap(line => {
      const over = 1 - poissonCdf(goals, Math.floor(line));
      const suffix = String(line).replace('.', '_');
      return [
        { id: `OVER_${suffix}`, label: `Больше ${line}`, odds: price(over) },
        { id: `UNDER_${suffix}`, label: `Меньше ${line}`, odds: price(1 - over) }
      ];
    }) }
  ];
}

export function isClosed(match, now = Date.now()) {
  return match.status === 'FT' || Date.parse(match.kickoff) <= now;
}

export function requiredStake(matches, bets, targetId, now = Date.now()) {
  let missed = 0;
  for (const match of matches) {
    if (match.id === targetId) break;
    if (bets?.[match.id]?.outcome && Number(bets[match.id].stake) > 0) missed = 0;
    else if (isClosed(match, now)) missed++;
  }
  return MIN_STAKE * (missed + 1);
}

export function optionFor(match, outcome) {
  return marketsFor(match).flatMap(market => market.options)
    .find(option => option.id === outcome) || null;
}

export function betWon(match, outcome) {
  if (match.status !== 'FT' || !Array.isArray(match.score)) return false;
  const [home, away] = match.score;
  if (outcome === 'P1') return home > away;
  if (outcome === 'X') return home === away;
  if (outcome === 'P2') return home < away;
  if (outcome === 'DC_1X') return home >= away;
  if (outcome === 'DC_X2') return away >= home;
  if (outcome === 'DC_12') return home !== away;
  if (outcome === 'BTTS_YES') return home > 0 && away > 0;
  if (outcome === 'BTTS_NO') return home === 0 || away === 0;
  const total = String(outcome).match(/^(OVER|UNDER)_(\d+)_(\d+)$/);
  if (total) {
    const line = Number(`${total[2]}.${total[3]}`);
    return total[1] === 'OVER' ? home + away > line : home + away < line;
  }
  return false;
}

export function balanceFor(matches, bets = {}) {
  let settled = matches.length * 100;
  let reserved = 0;
  for (const match of matches) {
    const bet = bets[match.id];
    if (!bet?.outcome || !Number.isInteger(Number(bet.stake)) || Number(bet.stake) <= 0) continue;
    const stake = Number(bet.stake);
    if (match.status === 'FT') {
      if (betWon(match, bet.outcome)) {
        const odds = optionFor(match, bet.outcome)?.odds || 0;
        settled += Math.round(stake * odds) - stake;
      } else settled -= stake;
    } else reserved += stake;
  }
  return { settled, reserved, available: Math.max(0, settled - reserved) };
}

export function validateBet(matches, bets, matchId, outcome, stake, now = Date.now()) {
  const match = matches.find(item => item.id === matchId);
  if (!match || isClosed(match, now)) return 'Приём ставок на этот матч закрыт.';
  if (!optionFor(match, outcome)) return 'Выберите вариант прогноза.';
  if (!Number.isInteger(stake)) return 'Ставка должна быть целым числом очков.';
  const minimum = requiredStake(matches, bets, matchId, now);
  if (stake < minimum) return `Минимальная ставка: ${minimum} очков.`;
  const previousStake = Number(bets[matchId]?.stake || 0);
  if (stake > balanceFor(matches, bets).available + previousStake) return 'Не хватает доступных очков.';
  return '';
}
