/**
 * Formation / team-direction layout — pure deterministic unit tests.
 * Run: npx tsx scripts/pitch-lineup-layout-unit.ts
 */
import assert from 'node:assert/strict';
import {
  applyTeamDirection,
  buildPitchLineupLayout,
  resolveTeamDirection,
  type PitchScope,
} from '../src/utils/pitch-lineup-layout';
import type { SportsLineupPlayer } from '../src/services/sports-data';

const FORMATIONS = [
  '4-3-3',
  '4-4-2',
  '4-2-3-1',
  '4-1-4-1',
  '3-5-2',
  '3-4-3',
  '5-3-2',
  '5-4-1',
  '4-5-1',
] as const;

function makePlayers(
  formation: string,
  opts?: { omitGkGrid?: boolean; gkAtMaxRow?: boolean }
): SportsLineupPlayer[] {
  const lines = formation.split('-').map(Number);
  const players: SportsLineupPlayer[] = [];
  let id = 1;
  const maxRow = lines.length + 1;

  if (!opts?.gkAtMaxRow) {
    players.push({
      id: id++,
      name: 'GK',
      number: 1,
      position: 'G',
      grid: opts?.omitGkGrid ? undefined : '1:1',
    });
    let row = 2;
    for (let li = 0; li < lines.length; li++) {
      const count = lines[li];
      const isFirst = li === 0;
      const isLast = li === lines.length - 1;
      const pos = isFirst ? 'D' : isLast ? 'F' : 'M';
      for (let c = 1; c <= count; c++) {
        players.push({
          id: id++,
          name: `${pos}${c}`,
          number: id,
          position: pos,
          grid: `${row}:${c}`,
        });
      }
      row++;
    }
    return players;
  }

  // Attack at row 1 … GK at maxRow (API variant)
  let apiR = 1;
  for (let li = lines.length - 1; li >= 0; li--) {
    const count = lines[li];
    const isFirst = li === 0;
    const isLast = li === lines.length - 1;
    const pos = isFirst ? 'D' : isLast ? 'F' : 'M';
    for (let c = 1; c <= count; c++) {
      players.push({
        id: id++,
        name: `${pos}${c}`,
        number: id,
        position: pos,
        grid: `${apiR}:${c}`,
      });
    }
    apiR++;
  }
  players.push({
    id: id++,
    name: 'GK',
    number: 1,
    position: 'G',
    grid: `${maxRow}:1`,
  });
  return players;
}

function assertOrder(
  players: SportsLineupPlayer[],
  side: 'home' | 'away',
  scope: PitchScope,
  label: string
) {
  const formation = players.length ? 'n/a' : '';
  void formation;
  const pos = buildPitchLineupLayout(
    players,
    side,
    undefined,
    scope
  );
  assert.equal(pos.size, players.length, `${label}: every player placed`);

  const gk = players.find((p) => p.position === 'G')!;
  const defs = players.filter((p) => p.position === 'D');
  const fwds = players.filter((p) => p.position === 'F');
  const gkTop = pos.get(gk.id)!.top;
  const defTop =
    defs.reduce((s, p) => s + pos.get(p.id)!.top, 0) / Math.max(defs.length, 1);
  const fwdTop =
    fwds.reduce((s, p) => s + pos.get(p.id)!.top, 0) / Math.max(fwds.length, 1);

  const direction = resolveTeamDirection(side, scope);
  if (direction === 'up') {
    assert.ok(
      gkTop > defTop && defTop > fwdTop,
      `${label}: up direction expects GK > DEF > FWD (got ${gkTop}, ${defTop}, ${fwdTop})`
    );
  } else {
    assert.ok(
      gkTop < defTop && defTop < fwdTop,
      `${label}: down direction expects GK < DEF < FWD (got ${gkTop}, ${defTop}, ${fwdTop})`
    );
  }

  for (const p of players) {
    const { top, left } = pos.get(p.id)!;
    assert.ok(top >= 5 && top <= 95, `${label}: ${p.name} top in bounds (${top})`);
    assert.ok(left >= 5 && left <= 95, `${label}: ${p.name} left in bounds (${left})`);
  }
}

function main() {
  // Direction model unit checks
  assert.deepEqual(applyTeamDirection(0.25, 0, 'up'), { x: 0.25, y: 1 });
  assert.deepEqual(applyTeamDirection(0.25, 1, 'up'), { x: 0.25, y: 0 });
  assert.deepEqual(applyTeamDirection(0.25, 0, 'down'), { x: 0.25, y: 0 });
  assert.deepEqual(applyTeamDirection(0.25, 1, 'down'), { x: 0.25, y: 1 });
  assert.equal(resolveTeamDirection('away', 'half'), 'down');
  assert.equal(resolveTeamDirection('home', 'half'), 'up');
  assert.equal(resolveTeamDirection('away', 'full'), 'up');
  assert.equal(resolveTeamDirection('home', 'full'), 'up');

  for (const formation of FORMATIONS) {
    for (const side of ['home', 'away'] as const) {
      assertOrder(
        makePlayers(formation),
        side,
        'half',
        `half ${side} ${formation}`
      );
      assertOrder(
        makePlayers(formation),
        side,
        'full',
        `full ${side} ${formation}`
      );
      assertOrder(
        makePlayers(formation, { gkAtMaxRow: true }),
        side,
        'half',
        `inverted-grid ${side} ${formation}`
      );
    }

    // Opposite directions on shared pitch
    const players = makePlayers(formation);
    const homePos = buildPitchLineupLayout(players, 'home', formation, 'half');
    const awayPos = buildPitchLineupLayout(players, 'away', formation, 'half');
    const gk = players.find((p) => p.position === 'G')!;
    assert.ok(
      homePos.get(gk.id)!.top > awayPos.get(gk.id)!.top,
      `${formation}: home GK below away GK`
    );
  }

  // Regression: GK without grid must still be placed (was dropped for 4-2-3-1)
  {
    const players = makePlayers('4-2-3-1', { omitGkGrid: true });
    const pos = buildPitchLineupLayout(players, 'home', '4-2-3-1', 'half');
    const gk = players.find((p) => p.position === 'G')!;
    assert.ok(pos.has(gk.id), 'GK without grid is placed');
    assert.equal(pos.size, 11, 'all XI placed when GK grid missing');
    assert.ok(pos.get(gk.id)!.top > 80, 'home GK near bottom goal');
  }

  // Single-team away must match coach view (GK at bottom) — was wrongly at top
  {
    const players = makePlayers('4-3-3');
    const pos = buildPitchLineupLayout(players, 'away', '4-3-3', 'full');
    const gk = players.find((p) => p.position === 'G')!;
    const fwd = players.find((p) => p.position === 'F')!;
    assert.ok(
      pos.get(gk.id)!.top > pos.get(fwd.id)!.top,
      'full away: GK below forwards'
    );
    assert.ok(pos.get(gk.id)!.top > 70, 'full away: GK near bottom');
  }

  // No horizontal mirror in direction transform
  {
    const a = applyTeamDirection(0.2, 0.3, 'down');
    const b = applyTeamDirection(0.2, 0.3, 'up');
    assert.equal(a.x, 0.2);
    assert.equal(b.x, 0.2);
  }

  console.log('pitch-lineup-layout-unit: PASS');
}

main();
