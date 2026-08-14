/**
 * FIX-07 S2 — offers/gifts apply gates (mirrors TournamentProvider hydrate).
 * NON_EMPTY → APPLY; SUCCESS_EMPTY / ERROR(null) / NETWORK → PRESERVE (skip set).
 */
type BlobSlice<T> = T[] | null | undefined;

function shouldApplyOffers(offers: BlobSlice<{ id: string }>): boolean {
  return !!(offers && offers.length > 0);
}

function shouldApplyGifts(gifts: BlobSlice<{ id: string }>): boolean {
  return !!(gifts && gifts.length > 0);
}

function simulate(
  local: { id: string }[],
  cloud: BlobSlice<{ id: string }>,
  kind: 'offers' | 'gifts'
): { id: string }[] {
  const apply =
    kind === 'offers' ? shouldApplyOffers(cloud) : shouldApplyGifts(cloud);
  return apply ? (cloud as { id: string }[]) : local;
}

let failed = 0;
function check(name: string, cond: boolean) {
  if (!cond) {
    failed += 1;
    console.error('FAIL', name);
  } else {
    console.log('PASS', name);
  }
}

const local = [{ id: 'local-1' }, { id: 'local-2' }];
const nonEmpty = [{ id: 'cloud-1' }];

check(
  'offers NON_EMPTY apply',
  JSON.stringify(simulate(local, nonEmpty, 'offers')) ===
    JSON.stringify(nonEmpty)
);
check(
  'offers SUCCESS_EMPTY preserve',
  JSON.stringify(simulate(local, [], 'offers')) === JSON.stringify(local)
);
check(
  'offers ERROR null preserve',
  JSON.stringify(simulate(local, null, 'offers')) === JSON.stringify(local)
);
check(
  'offers NETWORK undefined preserve',
  JSON.stringify(simulate(local, undefined, 'offers')) ===
    JSON.stringify(local)
);

check(
  'gifts NON_EMPTY apply',
  JSON.stringify(simulate(local, nonEmpty, 'gifts')) ===
    JSON.stringify(nonEmpty)
);
check(
  'gifts SUCCESS_EMPTY preserve',
  JSON.stringify(simulate(local, [], 'gifts')) === JSON.stringify(local)
);
check(
  'gifts ERROR null preserve',
  JSON.stringify(simulate(local, null, 'gifts')) === JSON.stringify(local)
);
check(
  'gifts NETWORK undefined preserve',
  JSON.stringify(simulate(local, undefined, 'gifts')) ===
    JSON.stringify(local)
);

// Source wiring: refresh exposed + PTR screens call it
import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..');
const provider = readFileSync(
  join(root, 'src/providers/TournamentProvider.tsx'),
  'utf8'
);
const offersScreen = readFileSync(
  join(root, 'src/screens/freelancer/OffersScreen.tsx'),
  'utf8'
);
const financials = readFileSync(
  join(root, 'src/screens/organizer/FinancialsScreen.tsx'),
  'utf8'
);
const screen = readFileSync(
  join(root, 'src/components/layout/Screen.tsx'),
  'utf8'
);

check(
  'provider exposes refreshCloudPublicCatalog',
  provider.includes('refreshCloudPublicCatalog:') &&
    provider.includes('catalogSyncLock')
);
check(
  'offers FlatList RefreshControl → refreshCloudPublicCatalog',
  offersScreen.includes('RefreshControl') &&
    offersScreen.includes('refreshCloudPublicCatalog') &&
    !offersScreen.includes('label={t(\'common.refresh\')}') // no visible Refresh button
);
check(
  'financials Screen PTR → refreshCloudPublicCatalog',
  financials.includes('onRefresh={onRefresh}') &&
    financials.includes('refreshCloudPublicCatalog')
);
check(
  'Screen ScrollView supports RefreshControl (no nested scroll)',
  screen.includes('RefreshControl') && screen.includes('allowPullRefresh')
);
check(
  'S2 gates unchanged in hydrate',
  provider.includes(
    'if (blobs.offers && blobs.offers.length > 0) setOffers(blobs.offers)'
  ) &&
    provider.includes('if (blobs.gifts && blobs.gifts.length > 0)')
);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nAll FIX-07 S2 pull-to-refresh unit checks passed');
