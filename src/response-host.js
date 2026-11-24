// Handles exist only during a synchronous parse hook. A nested JSON.parse
// (for example in a reviver-created getter) gets an independent handle stack.
let values;
let memory;
const keys = new Map();
function key(address) {
  if (keys.has(address)) return keys.get(address);
  const bytes = new Uint8Array(memory.buffer);
  let name = '';
  for (let i = address; bytes[i]; i++) name += String.fromCharCode(bytes[i]);
  keys.set(address, name);
  return name;
}
function handle(value) {
  return value === undefined ? 0 : values.push(value) - 1;
}
function object(value) {
  return value !== null && typeof value === 'object';
}
function findField(root, name) {
  const stack = [root];
  const seen = new WeakSet();
  while (stack.length) {
    const value = stack.pop();
    if (!object(value) || seen.has(value)) continue;
    seen.add(value);
    if (Object.hasOwn(value, name)) return value[name];
    const names = Object.keys(value);
    for (let i = names.length - 1; i >= 0; i--) stack.push(value[names[i]]);
  }
}
export const responseHost = {
  field: (id, ptr) =>
    handle(object(values[id]) ? values[id][key(ptr)] : undefined),
  find_field: (id, ptr) => handle(findField(values[id], key(ptr))),
  element: (id, index) => handle(values[id][index]),
  array_length: (id) => (Array.isArray(values[id]) ? values[id].length : -1),
  truthy: (id) => +!!values[id],
  present: (id) => +(values[id] != null),
  has_field: (id, ptr) => +(object(values[id]) && key(ptr) in values[id]),
  equals_text: (id, ptr) => +(values[id] === key(ptr)),
  erase: (id, ptr) => {
    delete values[id][key(ptr)];
  },
  new_array: () => handle([]),
  append_item: (id, item) => {
    values[id].push(values[item]);
  },
  set_field: (id, ptr, item) => {
    values[id][key(ptr)] = values[item];
  },
  mark_handles: () => values.length,
  rewind_handles: (length) => {
    values.length = length;
  }
};
export function filterResponse(core, root) {
  if (!object(root)) return root;
  const previous = values;
  const previousMemory = memory;
  values = [undefined, root];
  memory = core.memory;
  try {
    core.filter_response();
  } finally {
    values = previous;
    memory = previousMemory;
  }
  return root;
}
