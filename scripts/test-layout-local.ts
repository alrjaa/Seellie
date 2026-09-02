import fs from 'fs';
import { buildPitchLineupLayout } from '../src/utils/pitch-lineup-layout';

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

async function main() {
const j = await fetch(`${env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/sports-proxy`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ resource: 'fixture_detail', fixtureId: '1603007' }),
}).then((r) => r.json());

for (const side of ['home', 'away'] as const) {
  const xi = j.data.lineups[side].startXI;
  const pos = buildPitchLineupLayout(xi, side, j.data.lineups[side].formation);
  const tops = xi.map((p: { id: number; name: string }) => ({
    name: p.name,
    top: pos.get(p.id)?.top,
  }));
  console.log(`\n${side}:`, tops);
  const gkTop = tops[0].top;
  const lastTop = tops[10].top;
  const ok = side === 'home' ? gkTop > lastTop : gkTop < lastTop;
  console.log('ORDER OK (index fallback):', ok);
}
}

main().catch(console.error);
