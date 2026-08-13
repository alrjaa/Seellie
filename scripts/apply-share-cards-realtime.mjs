#!/usr/bin/env node
/**
 * Apply SHARE-CARDS-REALTIME.sql via node `pg` (no system psql required).
 * Usage: SEELLIE_DATABASE_URL=... node scripts/apply-share-cards-realtime.mjs
 * Never prints the connection string.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const sqlPath = path.join(root, 'supabase/SHARE-CARDS-REALTIME.sql');
const url = process.env.SEELLIE_DATABASE_URL || '';

if (!url) {
  console.error('SEELLIE_DATABASE_URL is required');
  process.exit(2);
}

async function loadPg() {
  try {
    return await import('pg');
  } catch {
    // install into a temp cache under /tmp — not the app deps
    const { execSync } = await import('node:child_process');
    const dir = '/tmp/seellie-pg-apply';
    fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(path.join(dir, 'node_modules/pg'))) {
      execSync('npm init -y && npm install pg@8.13.1 --no-fund --no-audit', {
        cwd: dir,
        stdio: 'inherit',
      });
    }
    const require = createRequire(path.join(dir, 'package.json'));
    return require('pg');
  }
}

const pg = await loadPg();
const Client = pg.Client || pg.default?.Client;
const sql = fs.readFileSync(sqlPath, 'utf8');
const client = new Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log('Connected (credentials not printed). Applying SQL...');
  await client.query(sql);
  const { rows } = await client.query(
    `select pubname, schemaname, tablename
     from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'share_cards'`
  );
  console.log('publication_rows', rows.length);
  if (!rows.length) {
    console.error('VERIFY FAIL: share_cards not in supabase_realtime');
    process.exit(4);
  }
  console.log('VERIFY PASS: share_cards in supabase_realtime');
} catch (e) {
  console.error('APPLY FAIL:', e.message || e);
  process.exit(1);
} finally {
  try {
    await client.end();
  } catch {
    /* ignore */
  }
}
