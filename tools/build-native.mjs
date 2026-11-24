import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), 'youtube-webos-wasm-'));
const object = join(scratch, 'settings.o');
/** @param {string} command @param {string[]} args */
const run = (command, args) =>
  execFileSync(command, args, { cwd, stdio: 'inherit' });
try {
  const flags = [
    '-Oz',
    '-ffreestanding',
    '-c',
    'native/settings.c',
    '-o',
    object
  ];
  if (process.env.ZIG)
    run(process.env.ZIG, ['cc', '-target', 'wasm32-freestanding', ...flags]);
  else run(process.env.CLANG || 'clang', ['--target=wasm32', ...flags]);
  run(process.env.RUSTC || 'rustc', [
    'native/timeline.rs',
    '--edition=2021',
    '--target=wasm32v1-none',
    '--crate-type=cdylib',
    '-C',
    'opt-level=s',
    '-C',
    'panic=abort',
    '-C',
    'strip=symbols',
    '-C',
    'link-arg=' + object,
    '-C',
    'link-arg=--export=panel_key',
    '-C',
    'link-arg=--export=settings_rows',
    '-C',
    'link-arg=-z',
    '-C',
    'link-arg=stack-size=16384',
    '-o',
    'native/player.wasm'
  ]);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
