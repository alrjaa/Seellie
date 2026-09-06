/**
 * CLI: npx tsx scripts/video-quality-gates.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  evaluateGates,
  type GateFixture,
} from '../src/services/video-quality-gates';

const fixturePath =
  process.env.VIDEO_GATE_FIXTURE ||
  path.join('e2e', 'golden', 'fixtures', 'sample-metrics.json');
const raw = fs.readFileSync(fixturePath, 'utf8');
const fixture = JSON.parse(raw) as GateFixture;
const result = evaluateGates(fixture);
if (!result.ok) {
  console.error('VIDEO_QUALITY_GATES_FAIL', result.failures);
  process.exit(1);
}
console.log('VIDEO_QUALITY_GATES_PASS', fixture.platform);
assert.equal(result.ok, true);
