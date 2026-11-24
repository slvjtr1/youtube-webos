import { core, readString } from './core-runtime';

const CONFIG_KEY = 'ytaf-configuration';
const ids = new Map();
const configFrags = {};
export const settingsRows = [[], []];
export const categories = new Map();
let stored = {};
try {
  const parsed = JSON.parse(window.localStorage.getItem(CONFIG_KEY) || '{}');
  if (parsed && typeof parsed === 'object') stored = parsed;
} catch (error) {
  console.warn('Unable to read settings', error);
}

core.options_init();
for (let i = 0; i < core.option_count(); i++) {
  const key = readString(core.option_key(i));
  const category = readString(core.option_category(i));
  ids.set(key, i);
  configFrags[key] = document.createDocumentFragment();
  settingsRows[category ? 1 : 0].push(key);
  if (category) categories.set(category, key);
  if (Object.hasOwn(stored, key)) core.option_write(i, !!stored[key]);
}
function id(key) {
  if (!ids.has(key)) throw new Error('Unknown configuration key: ' + key);
  return ids.get(key);
}
export function configRead(key) {
  return !!core.option_read(id(key));
}
export function configGetDesc(key) {
  return readString(core.option_desc(id(key)));
}
export function configWrite(key, value) {
  const oldValue = configRead(key);
  const next = { ...stored, [key]: !!value };
  window.localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
  stored = next;
  core.option_write(id(key), !!value);
  configFrags[key].dispatchEvent(
    new CustomEvent('ytafConfigChange', {
      detail: { key, newValue: !!value, oldValue }
    })
  );
}
/**
 * Add a listener for changes in the value of a specified config option
 * @param {string} key Config option to monitor
 * @param {(evt: Event) => void} callback Function to be called on change
 */
export function configAddChangeListener(key, callback) {
  const frag = configFrags[key];

  frag.addEventListener('ytafConfigChange', callback);
}

/**
 * Remove a listener for changes in the value of a specified config option
 * @param {string} key Config option to monitor
 * @param {(evt: Event) => void} callback Function to be called on change
 */
export function configRemoveChangeListener(key, callback) {
  const frag = configFrags[key];

  frag.removeEventListener('ytafConfigChange', callback);
}
