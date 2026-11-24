import { core, readString } from './core-runtime';

// URL serializers produce ASCII. For raw intent/target classification each
// non-ASCII code unit occupies one byte so offsets map back to the JS string.
function workspace(first, second = '') {
  const inputs = first.length + second.length + 2;
  const a = core.scratch_reserve(inputs * 2 + 160);
  if (!a) throw new RangeError('Insufficient memory for URL');
  const bytes = new Uint8Array(core.memory.buffer);
  function write(text, at) {
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      bytes[at++] = code && code < 128 ? code : 255;
    }
    bytes[at] = 0;
  }
  const b = a + first.length + 1;
  write(first, a);
  write(second, b);
  return [a, b, a + inputs];
}

export function launchURL(params) {
  const { target, contentTarget = target } = params ?? {};
  let kind = 0,
    value = '',
    action = '';
  if (typeof contentTarget === 'string') {
    let direct;
    try {
      direct = new URL(contentTarget);
    } catch {
      /* DIAL query string */
    }
    if (direct && direct.origin === readString(core.launch_origin())) {
      kind = 1;
      value = direct.href;
    } else {
      kind = 2;
      const trim = core.partial_offset(workspace(contentTarget.slice(0, 4))[0]);
      value = new URLSearchParams(contentTarget.slice(trim)).toString();
    }
  } else if (typeof contentTarget?.intent === 'string') {
    kind = 3;
    const intent = contentTarget.intent;
    const prefix = core.voice_prefix_length(workspace(intent)[0]);
    if (prefix)
      action = new URLSearchParams([
        ['va', intent.slice(0, prefix).toLowerCase()]
      ]).toString();
    value = new URLSearchParams([
      ['vq', String(contentTarget.intentParam)]
    ]).toString();
  }
  const [a, b, out] = workspace(value, action);
  return readString(core.launch_url(kind, a, b, out));
}

export function thumbnailURL(url, webp) {
  const [host, path, out] = workspace(url.hostname, url.pathname);
  const result = core.thumbnail_path(host, path, webp, out);
  if (!result) return null;
  const upgraded = new URL(url.href);
  upgraded.pathname = readString(result);
  upgraded.search = '';
  return upgraded;
}
