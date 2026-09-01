/**
 * FIX-09 P0 security unit — mirrors SQL authorization invariants (no live DB).
 * Run: npx tsx scripts/fix09-security-unit.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

type Offer = Record<string, unknown>;

const OFFER_ALLOWED = new Set([
  'message',
  'note',
  'body',
  'timestamp',
  'expiresAt',
  'updatedAt',
]);

/** Mirrors FIX-09 upsert_offer_in_blob */
function upsertOffer(
  existing: Offer[],
  incoming: Offer,
  me: string,
  isAdmin: boolean
): { ok: boolean; error?: string; list?: Offer[] } {
  const rid = String(incoming.id || '');
  const oid = String(incoming.organizerId || '');
  if (!rid || !oid) return { ok: false, error: 'missing_fields' };
  if (oid !== me && !isAdmin) return { ok: false, error: 'not_organizer' };

  const withoutStatus = { ...incoming };
  delete withoutStatus.status;

  const idx = existing.findIndex((o) => o.id === rid);
  if (idx >= 0) {
    const item = { ...existing[idx] };
    if (item.organizerId !== oid && !isAdmin) {
      return { ok: false, error: 'offer_owner_mismatch' };
    }
    for (const key of [
      'freelancerId',
      'teamId',
      'competitionId',
      'organizerId',
    ] as const) {
      if (
        key in withoutStatus &&
        String(withoutStatus[key] ?? '') !== String(item[key] ?? '')
      ) {
        return { ok: false, error: `immutable_${key}` };
      }
    }
    const keepStatus = item.status ?? 'pending';
    const patch: Offer = {};
    for (const k of OFFER_ALLOWED) {
      if (k in withoutStatus) patch[k] = withoutStatus[k];
    }
    const next = {
      ...item,
      ...patch,
      status: keepStatus,
      freelancerId: item.freelancerId,
      teamId: item.teamId,
      competitionId: item.competitionId,
      organizerId: item.organizerId,
    };
    const list = existing.slice();
    list[idx] = next;
    return { ok: true, list };
  }

  if (
    !withoutStatus.freelancerId ||
    !withoutStatus.teamId ||
    !withoutStatus.competitionId
  ) {
    return { ok: false, error: 'missing_identity_fields' };
  }
  const created = {
    ...withoutStatus,
    status: 'pending',
    organizerId: oid,
  };
  return { ok: true, list: [...existing, created] };
}

type Referee = Record<string, unknown>;

/**
 * Mirrors FIX-09 organizer_controls_referee after S02 remediation:
 * ONLY stamped ownerId on referees blob — never payload.refereeIds.
 */
function organizerControlsReferee(opts: {
  refereeOwnerId: string | null | undefined;
  me: string;
  /** Organizer-writable competition JSON — MUST NOT affect authz */
  forgedRefereeIds?: string[];
  targetRefereeId?: string;
}): boolean {
  // Deliberately ignore forgedRefereeIds / competition payload.
  void opts.forgedRefereeIds;
  void opts.targetRefereeId;
  return (
    !!opts.refereeOwnerId &&
    opts.refereeOwnerId.length > 0 &&
    opts.refereeOwnerId === opts.me
  );
}

function canUpsertReferee(opts: {
  authenticated: boolean;
  isAdmin: boolean;
  isOrganizer: boolean;
  found: boolean;
  /** Authoritative ownerId on existing referee blob (null = no ownership) */
  refereeOwnerId?: string | null;
  me?: string;
  /** If present, simulates poisoned competition.payload.refereeIds */
  poisonedRefereeIds?: string[];
  targetRefereeId?: string;
  ownsCompetition: boolean;
  hasCompetitionId: boolean;
}): { ok: boolean; error?: string } {
  if (!opts.authenticated) return { ok: false, error: 'not_authenticated' };
  if (!opts.isAdmin && !opts.isOrganizer) {
    return { ok: false, error: 'forbidden' };
  }
  if (opts.found) {
    const controls =
      opts.isAdmin ||
      organizerControlsReferee({
        refereeOwnerId: opts.refereeOwnerId,
        me: opts.me || '',
        forgedRefereeIds: opts.poisonedRefereeIds,
        targetRefereeId: opts.targetRefereeId,
      });
    if (!controls) {
      return { ok: false, error: 'referee_not_owned' };
    }
    return { ok: true };
  }
  if (!opts.isAdmin) {
    if (!opts.hasCompetitionId) {
      return { ok: false, error: 'competition_required' };
    }
    if (!opts.ownsCompetition) {
      return { ok: false, error: 'competition_not_owned' };
    }
  }
  return { ok: true };
}

function applyRefereeUpdate(
  existing: Referee,
  incoming: Referee,
  isAdmin: boolean,
  me: string
): Referee {
  const stripped = { ...incoming };
  delete stripped.ownerId;
  delete stripped.createdBy;
  delete stripped.competitionId;
  delete stripped.organizerId;
  const keepOwner = existing.ownerId;
  let next: Referee;
  if (isAdmin) {
    next = { ...existing, ...stripped };
  } else {
    const allowed = [
      'name',
      'role',
      'mobile',
      'city',
      'avatar',
      'rating',
      'status',
    ];
    next = { ...existing };
    for (const k of allowed) {
      if (k in stripped) next[k] = stripped[k];
    }
  }
  if (keepOwner) next.ownerId = keepOwner;
  else if (!isAdmin) next.ownerId = me;
  return next;
}

/** Mirrors preserve_privileged_profile_content */
function preservePrivileged(
  oldContent: Record<string, unknown> | null,
  newContent: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...newContent };
  const old = oldContent || {};
  if ('analyst' in old) result.analyst = old.analyst;
  else delete result.analyst;

  const oldPerm = (old.permissions || {}) as Record<string, unknown>;
  const newPerm = {
    ...((result.permissions || {}) as Record<string, unknown>),
  };
  if ('canCreateContent' in oldPerm) {
    newPerm.canCreateContent = oldPerm.canCreateContent;
  } else {
    delete newPerm.canCreateContent;
  }
  result.permissions = newPerm;
  return result;
}

function main() {
  const me = 'org-1';
  const other = 'org-2';

  // --- F09-S01 Offers ---
  const created = upsertOffer(
    [],
    {
      id: 'o1',
      organizerId: me,
      freelancerId: 'fl-1',
      teamId: 't1',
      competitionId: 'c1',
      message: 'hi',
      status: 'accepted',
    },
    me,
    false
  );
  assert.equal(created.ok, true);
  assert.equal(created.list![0].status, 'pending');
  assert.equal(created.list![0].freelancerId, 'fl-1');

  const msgOk = upsertOffer(
    created.list!,
    { id: 'o1', organizerId: me, message: 'updated' },
    me,
    false
  );
  assert.equal(msgOk.ok, true);
  assert.equal(msgOk.list![0].message, 'updated');
  assert.equal(msgOk.list![0].freelancerId, 'fl-1');

  assert.equal(
    upsertOffer(
      created.list!,
      { id: 'o1', organizerId: me, freelancerId: 'hijack' },
      me,
      false
    ).error,
    'immutable_freelancerId'
  );
  assert.equal(
    upsertOffer(
      created.list!,
      { id: 'o1', organizerId: me, teamId: 'other' },
      me,
      false
    ).error,
    'immutable_teamId'
  );
  assert.equal(
    upsertOffer(
      created.list!,
      { id: 'o1', organizerId: me, competitionId: 'other' },
      me,
      false
    ).error,
    'immutable_competitionId'
  );
  assert.equal(
    upsertOffer(
      created.list!,
      { id: 'o1', organizerId: other },
      me,
      false
    ).error,
    'not_organizer'
  );
  // status forge via upsert ignored on create (forced pending); on update rejected by allowlist
  const statusAttempt = upsertOffer(
    created.list!,
    { id: 'o1', organizerId: me, status: 'accepted', message: 'x' },
    me,
    false
  );
  assert.equal(statusAttempt.ok, true);
  assert.equal(statusAttempt.list![0].status, 'pending');

  // --- F09-S02 Referees ---
  // 5) freelancer/follower → forbidden
  assert.equal(
    canUpsertReferee({
      authenticated: true,
      isAdmin: false,
      isOrganizer: false,
      found: false,
      ownsCompetition: false,
      hasCompetitionId: false,
    }).error,
    'forbidden'
  );
  // 7) create بدون competitionId → forbidden
  assert.equal(
    canUpsertReferee({
      authenticated: true,
      isAdmin: false,
      isOrganizer: true,
      found: false,
      ownsCompetition: false,
      hasCompetitionId: false,
    }).error,
    'competition_required'
  );
  // 9) forged competitionId (not owned) → no grant
  assert.equal(
    canUpsertReferee({
      authenticated: true,
      isAdmin: false,
      isOrganizer: true,
      found: false,
      ownsCompetition: false,
      hasCompetitionId: true,
    }).error,
    'competition_not_owned'
  );
  // Create ownership: owned competition → allowed
  assert.equal(
    canUpsertReferee({
      authenticated: true,
      isAdmin: false,
      isOrganizer: true,
      found: false,
      ownsCompetition: true,
      hasCompetitionId: true,
    }).ok,
    true
  );
  // 6) superadmin create → allowed
  assert.equal(
    canUpsertReferee({
      authenticated: true,
      isAdmin: true,
      isOrganizer: false,
      found: false,
      ownsCompetition: false,
      hasCompetitionId: false,
    }).ok,
    true
  );

  // 1) owner organizer → allowed (authoritative ownerId)
  assert.equal(
    canUpsertReferee({
      authenticated: true,
      isAdmin: false,
      isOrganizer: true,
      found: true,
      me,
      refereeOwnerId: me,
      ownsCompetition: true,
      hasCompetitionId: true,
      targetRefereeId: 'ref-a',
    }).ok,
    true
  );

  // 2) different organizer → forbidden
  assert.equal(
    canUpsertReferee({
      authenticated: true,
      isAdmin: false,
      isOrganizer: true,
      found: true,
      me,
      refereeOwnerId: other,
      ownsCompetition: true,
      hasCompetitionId: true,
      targetRefereeId: 'ref-b',
    }).error,
    'referee_not_owned'
  );

  // 3+4) poison payload.refereeIds with other organizer's referee → still forbidden
  assert.equal(
    canUpsertReferee({
      authenticated: true,
      isAdmin: false,
      isOrganizer: true,
      found: true,
      me,
      refereeOwnerId: other,
      poisonedRefereeIds: ['ref-b', 'ref-hijack'],
      targetRefereeId: 'ref-b',
      ownsCompetition: true,
      hasCompetitionId: true,
    }).error,
    'referee_not_owned'
  );
  assert.equal(
    organizerControlsReferee({
      refereeOwnerId: other,
      me,
      forgedRefereeIds: ['ref-b'],
      targetRefereeId: 'ref-b',
    }),
    false
  );
  assert.equal(
    organizerControlsReferee({
      refereeOwnerId: me,
      me,
      forgedRefereeIds: [],
      targetRefereeId: 'ref-a',
    }),
    true
  );

  // ownsCompetition alone must NOT authorize update of foreign referee
  assert.equal(
    canUpsertReferee({
      authenticated: true,
      isAdmin: false,
      isOrganizer: true,
      found: true,
      me,
      refereeOwnerId: other,
      ownsCompetition: true,
      hasCompetitionId: true,
    }).error,
    'referee_not_owned'
  );

  // Missing authoritative ownerId → forbidden (do not invent ownership)
  assert.equal(
    canUpsertReferee({
      authenticated: true,
      isAdmin: false,
      isOrganizer: true,
      found: true,
      me,
      refereeOwnerId: null,
      poisonedRefereeIds: ['ref-legacy'],
      targetRefereeId: 'ref-legacy',
      ownsCompetition: true,
      hasCompetitionId: true,
    }).error,
    'referee_not_owned'
  );

  // 6) superadmin update → allowed
  assert.equal(
    canUpsertReferee({
      authenticated: true,
      isAdmin: true,
      isOrganizer: false,
      found: true,
      me: other,
      refereeOwnerId: me,
      ownsCompetition: false,
      hasCompetitionId: false,
    }).ok,
    true
  );

  // 8) forged ownerId stripped — does not change kept owner
  const owned = applyRefereeUpdate(
    { id: 'r1', ownerId: me, name: 'A', status: 'active' },
    {
      id: 'r1',
      ownerId: other,
      name: 'B',
      competitionId: 'c-x',
      secret: 'nope',
    },
    false,
    me
  );
  assert.equal(owned.ownerId, me);
  assert.equal(owned.name, 'B');
  assert.equal('secret' in owned, false);
  assert.equal('competitionId' in owned, false);

  // --- F09-S03 Analyst privilege ---
  const preserved = preservePrivileged(
    {
      analyst: { status: 'none' },
      permissions: { canCreateContent: false, canComment: true },
      bio: 'old',
    },
    {
      analyst: { status: 'active' },
      permissions: { canCreateContent: true, canComment: false },
      bio: 'new',
    }
  );
  assert.deepEqual(preserved.analyst, { status: 'none' });
  assert.equal(
    (preserved.permissions as { canCreateContent: boolean }).canCreateContent,
    false
  );
  assert.equal(
    (preserved.permissions as { canComment: boolean }).canComment,
    false
  );
  assert.equal(preserved.bio, 'new');

  // SQL markers
  const sql = fs.readFileSync(
    path.join(process.cwd(), 'supabase/FIX-09-P0-HARDENING.sql'),
    'utf8'
  );
  assert.match(sql, /immutable_freelancerId/);
  assert.match(sql, /immutable_teamId/);
  assert.match(sql, /immutable_competitionId/);
  assert.match(sql, /organizer_controls_referee/);
  assert.match(sql, /competition_not_owned/);
  assert.match(sql, /referee_not_owned/);
  assert.match(sql, /guard_profile_privileged_content/);
  assert.match(sql, /seellie\.allow_privileged_content/);
  assert.match(sql, /preserve_privileged_profile_content/);

  // 10) No authorization path may use writable payload.refereeIds
  assert.doesNotMatch(
    sql,
    /organizer_controls_referee[\s\S]*?refereeIds[\s\S]*?\$\$/
  );
  assert.doesNotMatch(
    sql,
    /payload\s*->\s*'refereeIds'[\s\S]{0,120}\?\s*trim\(p_referee_id\)/
  );
  assert.match(
    sql,
    /NEVER use app_competitions\.payload\.refereeIds/
  );
  // Authoritative ownership check must remain ownerId-based
  assert.match(
    sql,
    /ref->>'ownerId'\s*=\s*auth\.uid\(\)::text/
  );

  // Client passes competitionId for create
  const blobs = fs.readFileSync(
    path.join(process.cwd(), 'src/services/supabase-app-blobs.ts'),
    'utf8'
  );
  assert.match(blobs, /competitionId/);
  const provider = fs.readFileSync(
    path.join(process.cwd(), 'src/providers/TournamentProvider.tsx'),
    'utf8'
  );
  assert.match(provider, /upsertRefereeInBlob\(referee,\s*\{\s*competitionId/);

  // FIX-07 / FIX-08 markers untouched in their unit scripts / hydrate
  const f07 = fs.readFileSync(
    path.join(process.cwd(), 'scripts/fix07-s2-pull-refresh-unit.ts'),
    'utf8'
  );
  assert.match(f07, /refreshCloudPublicCatalog/);
  assert.match(f07, /NON_EMPTY|length > 0|SUCCESS_EMPTY|PRESERVE/i);

  console.log('FIX-09 P0 security unit: PASS');
}

main();
