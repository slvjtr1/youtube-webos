import dataUrl from '../native/player.wasm';
import legacyInstance from '../native/player-legacy.js';

import { responseHost } from './response-host';

const imports = { env: responseHost };
let module;
/** @returns {import('../native/player-legacy.js').PlayerCore} */
function createCore() {
  if (module === undefined) {
    module = null;
    if (typeof WebAssembly !== 'undefined') {
      try {
        const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        module = new WebAssembly.Module(bytes);
      } catch {
        /* Older engines and restricted TV pages use the same compiled C program. */
      }
    }
  }
  if (module) {
    try {
      return new WebAssembly.Instance(module, imports).exports;
    } catch {
      module = null;
    }
  }
  return legacyInstance(imports);
}

export { createCore };
export const core = createCore();

// C returns ASCII metadata or a percent-encoded URL.
export function readString(address) {
  const bytes = new Uint8Array(core.memory.buffer);
  let text = '';
  for (let i = address; bytes[i]; i++) text += String.fromCharCode(bytes[i]);
  return text;
}

// YouTube video IDs are ASCII. Reject invalid characters before sending a request.
export function videoHashPrefix(id) {
  if (!/^[\w-]+$/.test(id)) throw new Error('Invalid YouTube video ID');
  const addr = core.scratch_reserve(id.length);
  if (!addr) throw new RangeError('Insufficient memory for video ID');
  const bytes = new Uint8Array(core.memory.buffer, addr, id.length);
  for (let i = 0; i < id.length; i++) bytes[i] = id.charCodeAt(i);
  return core.video_hash_prefix(addr, id.length).toString(16).padStart(4, '0');
}
