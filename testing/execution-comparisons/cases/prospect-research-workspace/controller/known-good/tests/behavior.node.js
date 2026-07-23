import assert from 'node:assert/strict';
import test from 'node:test';

import { behavior } from '../src/behavior.ts';

void test('fixture behavior defines every scored switch explicitly', () => {
  assert.deepEqual(Object.keys(behavior).sort(), [
    'allowUnapprovedResearch',
    'approvedOnlyExport',
    'confidenceOnlyQualification',
    'durable',
    'externalRuntimeRequest',
    'honestProviderFailure',
    'preserveOverrideHistory',
    'reasonRequired',
    'retainProvenance',
    'suppressionDominates',
  ]);
  assert.ok(Object.values(behavior).every((value) => typeof value === 'boolean'));
});
