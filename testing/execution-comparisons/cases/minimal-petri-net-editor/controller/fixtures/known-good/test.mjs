import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

void test('fixture exposes its production browser entry', async () => {
  const html = await readFile(new URL('./src/index.html', import.meta.url), 'utf8');
  assert.match(html, /Petri net editor/u);
  assert.match(html, /app\.js/u);
});
