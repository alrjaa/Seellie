import fs from 'fs';
import { buildPitchLineupLayout } from '../src/utils/pitch-lineup-layout';
import type { SportsLineupPlayer } from '../src/services/sports-data';

const env = Object.fromEntries(
  fs
    .readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1)];
    })
);

const url = env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

async function fixture(id: string) {
  const j = await fetch(`${url}/functions/v1/sports-proxy`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ resource: 'fixture_detail', fixtureId: id }),
  }).then((r) => r.json());
  return j.data;
}

async function main() {
const d = await fixture('1603007');
console.log('Match:', d.homeName, 'vs', d.awayName, d.date);

for (const side of ['home', 'away'] as const) {
  const t = d.lineups[side];
  const xi = t.startXI as SportsLineupPlayer[];
  const rows = [...new Set(xi.map((p) => p.grid?.split(':')[0]))];
  console.log(
    `\n=== ${side} ${t.teamName} ${t.formation} rows:${rows.length} [${rows.join(',')}] ===`
  );
  xi.forEach((p) =>
    console.log(p.name, '|', p.position || 'NO_POS', '|', p.grid || 'NO_GRID')
  );

  const pos = buildPitchLineupLayout(xi, side, t.formation);
  const gk =
    xi.find((p) => ['G', 'GK'].includes((p.position || '').toUpperCase())) ??
    xi[0];
  const defs = xi.filter((p) =>
    ['D', 'DF', 'DEF', 'CB', 'LB', 'RB'].includes((p.position || '').toUpperCase())
  );
  const fwds = xi.filter((p) =>
    ['F', 'FW', 'ST', 'CF', 'ATT'].includes((p.position || '').toUpperCase())
  );
  const gkTop = gk ? pos.get(gk.id)?.top : null;
  const defTop = defs[0] ? pos.get(defs[0].id)?.top : null;
  const fwdTop = fwds[0] ? pos.get(fwds[0].id)?.top : null;
  console.log('GK', gk?.name, 'top%', gkTop);
  console.log('DEF', defs[0]?.name, 'top%', defTop);
  console.log('FWD', fwds[0]?.name, 'top%', fwdTop);
  const ok =
    side === 'home'
      ? gkTop != null && defTop != null && fwdTop != null && gkTop > defTop && defTop > fwdTop
      : gkTop != null && defTop != null && fwdTop != null && gkTop < defTop && defTop < fwdTop;
  console.log('ORDER OK:', ok);
  const tops = [...new Set(xi.map((p) => Math.round(pos.get(p.id)?.top || 0)))];
  console.log('unique vertical positions:', tops.length, tops);
}
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
