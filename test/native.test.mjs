import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createHash } from 'node:crypto';
import legacyInstance from '../native/player-legacy.js';
import { responseHost, filterResponse } from '../src/response-host.js';

const module = new WebAssembly.Module(
  readFileSync(new URL('../native/player.wasm', import.meta.url))
);
const imports = { env: responseHost };
for (const [backend, instantiate] of Object.entries({
  webassembly: () => new WebAssembly.Instance(module, imports).exports,
  compatibility: () => legacyInstance(imports)
})) {
  test(
    backend +
      ' independent timelines match a linear reference across forward and backward seeks',
    () => {
      const core = instantiate();
      const segments = Array.from(
        { length: core.capacity() + 80 },
        (_, index) => {
          const start = ((index * 13) % 77) / 4;
          return { start, end: start + (index % 2 ? 0.1 : 2), index };
        }
      );
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
    }
  );

  test(
    backend +
      ' remote navigation keeps focus inside the panel and preserves group navigation',
    () => {
      const { panel_key: key } = instantiate();
      assert.equal(key(40, 15, 16, 9), 15);
      assert.equal(key(38, 0, 16, 9), 0);
      assert.equal(key(39, 8, 16, 9), 9);
      assert.equal(key(37, 14, 16, 9), 8);
      assert.equal(key(13, 2, 16, 9), -2);
      assert.equal(key(461, 2, 16, 9), -3);
    }
  );
  test(
    backend +
      ' SHA-256 prefix matches the host crypto across padding boundaries',
    () => {
      const core = instantiate();
      for (const size of [0, 1, 11, 55, 56, 63, 64, 65, 128, 100000]) {
        const bytes = Buffer.alloc(size, 0x61);
        const address = core.scratch_reserve(size);
        new Uint8Array(core.memory.buffer, address, size).set(bytes);
        assert.equal(
          core.video_hash_prefix(address, size),
          createHash('sha256').update(bytes).digest().readUInt16BE()
        );
      }
    }
  );

  test(
    backend +
      ' filters honor settings, work on nested shelves and retain surviving object identities',
    () => {
      const core = instantiate();
      core.options_init();
      const keep = { tileRenderer: {} };
      const grid = {
        items: [
          keep,
          { tileRenderer: { onSelectCommand: { reelWatchEndpoint: {} } } }
        ]
      };
      const root = {
        gridRenderer: grid,
        adSlots: [],
        endscreen: { endscreenRenderer: {} },
        self: null
      };
      root.self = root;
      assert.equal(filterResponse(core, root), root);
      assert.equal(root.adSlots, undefined);
      assert.equal(root.gridRenderer.items.length, 2);
      core.option_write(4, true);
      core.option_write(6, true);
      filterResponse(core, root);
      assert.equal(root.endscreen, undefined);
      assert.deepEqual(grid.items, [keep]);
      assert.equal(grid.items[0], keep);
      const shelf = {
        shelfRenderer: {
          content: {
            horizontalListRenderer: { items: [keep, { adSlotRenderer: {} }] }
          }
        }
      };
      const contents = [
        { adSlotRenderer: {} },
        shelf,
        {
          shelfRenderer: {
            tvhtml5ShelfRendererType: 'TVHTML5_SHELF_RENDERER_TYPE_SHORTS'
          }
        }
      ];
      const sections = { contents };
      filterResponse(core, { contents: { sectionListRenderer: sections } });
      assert.deepEqual(sections.contents, [shelf]);
      assert.deepEqual(
        shelf.shelfRenderer.content.horizontalListRenderer.items,
        [keep]
      );
      core.option_write(0, false);
      assert.deepEqual(filterResponse(core, { adSlots: [] }), { adSlots: [] });
    }
  );

  test(backend + ' playback transitions, timers and remote actions', () => {
    const c = instantiate();
    assert.equal(c.playback_events(0, 1, 1, 0), 0);
    assert.equal(c.playback_events(1, 1, 1, 1), 3);
    assert.equal(c.playback_events(1, 0, 1, 0), 2);
    assert.equal(c.playback_events(1, 0, 1, 1), 0);
    assert.equal(c.player_mode(1, 1), 0);
    assert.equal(c.player_mode(0, 1), 1);
    assert.equal(c.player_mode(0, 0), 2);
    assert.equal(c.key_action(404), 1);
    assert.equal(c.key_action(406), 2);
    assert.equal(c.skip_delay(5, 7, 2), 1000);
    assert.equal(c.keep_deadline(1, 1000, 1059), 1);
    assert.equal(c.keep_deadline(1, 1000, 1060), 0);
    assert.equal(c.can_skip(5, 5, 8, 0, 0), 1);
    assert.equal(c.can_skip(5, 5, 8, 0, 1), 0);
    assert.equal(c.can_skip(8, 5, 8, 0, 0), 0);
  });

  test(
    backend +
      ' thumbnail upgrades preserve suffixes and skip A/B and unrelated paths',
    () => {
      const c = instantiate();
      function path(host, pathname, webp) {
        const start = c.scratch_reserve(
          (host.length + pathname.length) * 2 + 64
        );
        const bytes = Buffer.from(c.memory.buffer);
        bytes.write(host + '\0' + pathname + '\0', start, 'ascii');
        const result = c.thumbnail_path(
          start,
          start + host.length + 1,
          webp,
          start + host.length + pathname.length + 2
        );
        return result
          ? bytes.toString('ascii', result, bytes.indexOf(0, result))
          : null;
      }
      assert.equal(
        path('i.ytimg.com', '/vi/abc/hqdefault_live.jpg', 1),
        '/vi_webp/abc/sddefault_live.webp'
      );
      assert.equal(
        path('i.ytimg.com', '/vi_webp/abc/mqdefault.webp', 0),
        '/vi/abc/sddefault.jpg'
      );
      assert.equal(path('i.ytimg.com', '/vi/abc/sddefault.jpg', 0), null);
      assert.equal(path('i1.ytimg.com', '/vi/abc/default.jpg', 1), null);
      assert.equal(path('i.ytimg.com', '/vi/abc/random.jpg', 1), null);
    }
  );
}
