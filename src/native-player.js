import dataUrl from '../native/player.wasm';

let compiled;
let panel;
export function loadPlayerCore() {
  if (!compiled) {
    compiled = Promise.resolve()
      .then(() => {
        if (typeof WebAssembly === 'undefined') return null;
        const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return WebAssembly.compile(bytes);
      })
      .catch(() => null);
  }
  return compiled;
}

export function preparePanel() {
  if (!panel)
    loadPlayerCore().then((module) => {
      if (module && !panel) panel = instantiate(module);
    });
}

function instantiate(module) {
  try {
    return new WebAssembly.Instance(module).exports;
  } catch {
    return null;
  }
}

export function panelKey(key, current, count, group) {
  if (panel) return panel.panel_key(key, current, count, group);
  if (key === 27 || key === 461) return -3;
  if (!count) return -1;
  if (key === 13) return current >= 0 ? -2 : 0;
  if (key === 40) return Math.min(current + 1, count - 1);
  if (key === 38) return Math.max(current - 1, 0);
  if (key === 39 && current === group - 1 && group < count) return group;
  if (key === 37 && current >= group && group > 0) return group - 1;
  return -1;
}

export async function createTimeline(segments, categories) {
  const module = await loadPlayerCore();
  const entries = [];
  segments.forEach((item, index) => {
    if (!categories.includes(item.category)) return;
    const [start, end] = item.segment;
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      entries.push({ start, end, index });
    }
  });
  const core = module && instantiate(module);
  if (core && entries.length <= core.capacity()) {
    for (const item of entries)
      core.add_segment(item.start, item.end, item.index);
    core.finish_index();
    return (now) => segments[core.next_segment(now)];
  }

  entries.sort((a, b) => a.start - b.start || a.index - b.index);
  return (now) => {
    let low = 0;
    let high = entries.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (entries[middle].start <= now - 0.3) low = middle + 1;
      else high = middle;
    }
    for (let i = low; i < entries.length; i++) {
      if (entries[i].end > now) return segments[entries[i].index];
    }
  };
}
