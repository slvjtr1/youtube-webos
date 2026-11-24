import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const module = new WebAssembly.Module(
  readFileSync(new URL('../native/player.wasm', import.meta.url))
);
const instantiate = () => new WebAssembly.Instance(module).exports;

test('independent timelines match a linear reference across forward and backward seeks', () => {
  const core = instantiate();
  const segments = Array.from({ length: core.capacity() }, (_, index) => {
    const start = ((index * 13) % 77) / 4;
    return { start, end: start + (index % 2 ? 0.1 : 2), index };
  });
  for (const entry of segments)
    core.add_segment(entry.start, entry.end, entry.index);
  core.finish_index();
  for (let tick = 500; tick >= -1; tick--) {
    const now = tick / 20;
    const expected = segments
      .filter((e) => e.start > now - 0.3 && e.end > now)
      .sort((a, b) => a.start - b.start || a.index - b.index)[0];
    assert.equal(core.next_segment(now), expected?.index ?? -1);
  }
  assert.equal(instantiate().next_segment(0), -1);
});

test('remote navigation keeps focus inside the panel and preserves group navigation', () => {
  const { panel_key: key } = instantiate();
  assert.equal(key(40, 15, 16, 9), 15);
  assert.equal(key(38, 0, 16, 9), 0);
  assert.equal(key(39, 8, 16, 9), 9);
  assert.equal(key(37, 14, 16, 9), 8);
  assert.equal(key(13, 2, 16, 9), -2);
  assert.equal(key(461, 2, 16, 9), -3);
});
