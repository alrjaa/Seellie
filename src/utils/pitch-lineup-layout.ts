import type { SportsLineupPlayer } from '@/services/sports-data';

export type PitchPos = { top: number; left: number };

const PITCH_AWAY_START = 6;
const PITCH_HOME_END = 94;
const PITCH_HALF_SPAN = 38;
const PITCH_LEFT_MIN = 10;
const PITCH_LEFT_SPAN = 80;
const MIN_GRID_ROWS_FOR_FULL = 4;

const POSITION_DEPTH: Record<string, number> = {
  G: 0,
  GK: 0,
  D: 1,
  DF: 1,
  DEF: 1,
  CB: 1,
  LB: 1,
  RB: 1,
  LWB: 1,
  RWB: 1,
  SW: 1,
  M: 2,
  MF: 2,
  MID: 2,
  CM: 2,
  DM: 2,
  AM: 2,
  CDM: 2,
  CAM: 2,
  RM: 2,
  LM: 2,
  F: 3,
  FW: 3,
  ST: 3,
  CF: 3,
  ATT: 3,
  SS: 3,
  LW: 3,
  RW: 3,
};

export function parseLineupGrid(grid?: string) {
  if (!grid) return null;
  const match = String(grid).trim().match(/^(\d+)\s*[:,-]\s*(\d+)$/);
  if (!match) return null;
  const row = Number(match[1]);
  const col = Number(match[2]);
  if (!Number.isFinite(row) || !Number.isFinite(col) || row < 1 || col < 1) {
    return null;
  }
  return { row, col };
}

function isGoalkeeper(player: SportsLineupPlayer) {
  const pos = (player.position || '').trim().toUpperCase();
  return pos === 'G' || pos === 'GK';
}

function positionRank(player: SportsLineupPlayer) {
  if (isGoalkeeper(player)) return 0;
  const pos = (player.position || '').trim().toUpperCase();
  if (pos && POSITION_DEPTH[pos] != null) return POSITION_DEPTH[pos];
  return 2;
}

function parseFormationLines(formation?: string) {
  if (!formation?.trim()) return [4, 2, 3, 1];
  const lines = formation
    .split('-')
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return lines.length ? lines : [4, 2, 3, 1];
}

function playerHasPosition(player: SportsLineupPlayer) {
  const pos = (player.position || '').trim();
  return pos.length > 0;
}

function positionCodeForRank(rank: number) {
  if (rank === 0) return 'G';
  if (rank === 1) return 'D';
  if (rank === 3) return 'F';
  return 'M';
}

/** When API omits grid/position (common in some leagues), use startXI order + formation. */
function enrichPlayersFromOrder(
  players: SportsLineupPlayer[],
  formation?: string
): SportsLineupPlayer[] {
  const hasGrid = players.some((player) => parseLineupGrid(player.grid) != null);
  const hasPosition = players.some(playerHasPosition);
  if (hasGrid || hasPosition) return players;

  const lineSizes = parseFormationLines(formation);
  const ranks: number[] = [0];
  lineSizes.forEach((count, lineIdx) => {
    const isLast = lineIdx === lineSizes.length - 1;
    const isFirst = lineIdx === 0;
    const rank = isFirst ? 1 : isLast && count <= 2 ? 3 : 2;
    for (let i = 0; i < count; i++) ranks.push(rank);
  });
  while (ranks.length < players.length) ranks.push(2);

  return players.map((player, idx) => ({
    ...player,
    position: positionCodeForRank(ranks[idx] ?? 2),
  }));
}

function mapNormToPitch(
  rowNorm: number,
  colNorm: number,
  side: 'home' | 'away'
): PitchPos {
  const top =
    side === 'away'
      ? PITCH_AWAY_START + rowNorm * PITCH_HALF_SPAN
      : PITCH_HOME_END - rowNorm * PITCH_HALF_SPAN;
  const left = PITCH_LEFT_MIN + colNorm * PITCH_LEFT_SPAN;
  return { top, left };
}

function sortLinePlayers(players: SportsLineupPlayer[]) {
  return [...players].sort((a, b) => {
    const aCol = parseLineupGrid(a.grid)?.col ?? a.number ?? 0;
    const bCol = parseLineupGrid(b.grid)?.col ?? b.number ?? 0;
    return Number(aCol) - Number(bCol);
  });
}

function colNormForPlayer(
  player: SportsLineupPlayer,
  linePlayers: SportsLineupPlayer[],
  playerIdx: number
) {
  const cols = linePlayers
    .map((p) => parseLineupGrid(p.grid)?.col)
    .filter((col): col is number => col != null);
  const playerCol = parseLineupGrid(player.grid)?.col;

  if (playerCol != null && cols.length) {
    const minCol = Math.min(...cols);
    const maxCol = Math.max(...cols);
    if (maxCol > minCol) {
      return (playerCol - minCol) / (maxCol - minCol);
    }
    return Math.min(1, Math.max(0, (playerCol - 1) / 4));
  }

  if (linePlayers.length === 1) return 0.5;
  return playerIdx / Math.max(linePlayers.length - 1, 1);
}

function rolePoolKey(player: SportsLineupPlayer): 'def' | 'mid' | 'fwd' {
  const rank = positionRank(player);
  if (rank <= 1) return 'def';
  if (rank >= 3) return 'fwd';
  return 'mid';
}

function takeFromPool(pool: SportsLineupPlayer[], count: number) {
  const line: SportsLineupPlayer[] = [];
  while (line.length < count && pool.length) {
    line.push(pool.shift()!);
  }
  return line;
}

function assignPlayersToFormationLines(
  players: SportsLineupPlayer[],
  formation?: string
): SportsLineupPlayer[][] {
  const goalkeepers = players.filter(isGoalkeeper);
  const outfield = players.filter((player) => !isGoalkeeper(player));
  const pools = {
    def: sortLinePlayers(outfield.filter((p) => rolePoolKey(p) === 'def')),
    mid: sortLinePlayers(outfield.filter((p) => rolePoolKey(p) === 'mid')),
    fwd: sortLinePlayers(outfield.filter((p) => rolePoolKey(p) === 'fwd')),
  };

  const lineSizes = parseFormationLines(formation);
  const lines: SportsLineupPlayer[][] = goalkeepers.length
    ? [sortLinePlayers(goalkeepers)]
    : [];

  lineSizes.forEach((size, lineIdx) => {
    const isLast = lineIdx === lineSizes.length - 1;
    const isFirst = lineIdx === 0;
    const pool = isFirst ? 'def' : isLast && size <= 2 ? 'fwd' : 'mid';
    const line = takeFromPool(pools[pool], size);
    if (!line.length && pool !== 'mid') {
      line.push(...takeFromPool(pools.mid, size));
    }
    if (!line.length && pool !== 'def') {
      line.push(...takeFromPool(pools.def, size));
    }
    if (line.length) lines.push(sortLinePlayers(line));
  });

  const leftovers = [...pools.def, ...pools.mid, ...pools.fwd];
  if (leftovers.length) {
    if (lines.length) {
      lines[lines.length - 1].push(...sortLinePlayers(leftovers));
    } else {
      lines.push(sortLinePlayers(leftovers));
    }
  }

  if (!lines.length && players.length) {
    lines.push(sortLinePlayers(players));
  }

  return lines;
}

function assignPlayersToGridRows(
  players: SportsLineupPlayer[]
): SportsLineupPlayer[][] | null {
  const goalkeepers = players.filter(isGoalkeeper);
  const outfield = players.filter((player) => !isGoalkeeper(player));
  const byRow = new Map<number, SportsLineupPlayer[]>();

  for (const player of outfield) {
    const grid = parseLineupGrid(player.grid);
    if (!grid) return null;
    if (!byRow.has(grid.row)) byRow.set(grid.row, []);
    byRow.get(grid.row)!.push(player);
  }

  const rowKeys = [...byRow.keys()].sort((a, b) => a - b);
  if (rowKeys.length < 3) return null;

  const lines: SportsLineupPlayer[][] = goalkeepers.length
    ? [sortLinePlayers(goalkeepers)]
    : [];

  rowKeys.forEach((rowKey) => {
    lines.push(sortLinePlayers(byRow.get(rowKey) ?? []));
  });

  return lines;
}

function goalLineTop(side: 'home' | 'away') {
  return side === 'away' ? PITCH_AWAY_START : PITCH_HOME_END;
}

function attackLineTop(side: 'home' | 'away') {
  return side === 'away'
    ? PITCH_AWAY_START + PITCH_HALF_SPAN
    : PITCH_HOME_END - PITCH_HALF_SPAN;
}

function fixGoalkeeperOrientation(
  players: SportsLineupPlayer[],
  positions: Map<number, PitchPos>,
  side: 'home' | 'away'
) {
  const gk = players.find(isGoalkeeper);
  if (!gk) return;
  const gkPos = positions.get(gk.id);
  if (!gkPos) return;

  const goalTop = goalLineTop(side);
  const attackTop = attackLineTop(side);
  const distGoal = Math.abs(gkPos.top - goalTop);
  const distAttack = Math.abs(gkPos.top - attackTop);
  if (distGoal <= distAttack) return;

  const axisCenter = (goalTop + attackTop) / 2;
  players.forEach((player) => {
    const pos = positions.get(player.id);
    if (!pos) return;
    positions.set(player.id, {
      top: axisCenter + (axisCenter - pos.top),
      left: pos.left,
    });
  });
}

function placeLinesOnPitch(
  lines: SportsLineupPlayer[][],
  side: 'home' | 'away'
) {
  const positions = new Map<number, PitchPos>();
  const lineCount = lines.length;

  lines.forEach((linePlayers, lineIdx) => {
    const rowNorm = lineCount <= 1 ? 0 : lineIdx / (lineCount - 1);
    const sorted = sortLinePlayers(linePlayers);
    sorted.forEach((player, playerIdx) => {
      const colNorm = colNormForPlayer(player, sorted, playerIdx);
      positions.set(
        player.id,
        mapNormToPitch(rowNorm, Math.min(1, Math.max(0, colNorm)), side)
      );
    });
  });

  return positions;
}

function buildFromFullGrid(
  players: SportsLineupPlayer[],
  side: 'home' | 'away'
): Map<number, PitchPos> {
  const positions = new Map<number, PitchPos>();
  const entries = players
    .map((player) => ({ player, grid: parseLineupGrid(player.grid) }))
    .filter(
      (
        entry
      ): entry is {
        player: SportsLineupPlayer;
        grid: { row: number; col: number };
      } => entry.grid != null
    );

  if (!entries.length) return positions;

  const rows = entries.map((entry) => entry.grid.row);
  const cols = entries.map((entry) => entry.grid.col);
  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);
  const minCol = Math.min(...cols);
  const maxCol = Math.max(...cols);
  const uniqueRows = new Set(rows).size;

  if (uniqueRows < MIN_GRID_ROWS_FOR_FULL || maxRow === minRow) {
    return positions;
  }

  const gk = players.find(isGoalkeeper);
  const gkRow = gk ? parseLineupGrid(gk.grid)?.row : null;
  const invertRows =
    gkRow != null && maxRow > minRow && gkRow === maxRow;

  entries.forEach(({ player, grid }) => {
    const row = invertRows ? minRow + maxRow - grid.row : grid.row;
    const rowNorm = (row - minRow) / (maxRow - minRow);
    const colNorm =
      maxCol === minCol ? 0.5 : (grid.col - minCol) / (maxCol - minCol);
    positions.set(player.id, mapNormToPitch(rowNorm, colNorm, side));
  });

  return positions;
}

export function buildPitchLineupLayout(
  players: SportsLineupPlayer[],
  side: 'home' | 'away',
  formation?: string
): Map<number, PitchPos> {
  if (!players.length) return new Map();

  const enriched = enrichPlayersFromOrder(players, formation);

  const fullGrid = buildFromFullGrid(enriched, side);
  if (fullGrid.size >= Math.ceil(enriched.length * 0.9)) {
    fixGoalkeeperOrientation(enriched, fullGrid, side);
    return fullGrid;
  }

  const lines =
    assignPlayersToGridRows(enriched) ??
    assignPlayersToFormationLines(enriched, formation);
  const positions = placeLinesOnPitch(lines, side);
  fixGoalkeeperOrientation(enriched, positions, side);
  return positions;
}
