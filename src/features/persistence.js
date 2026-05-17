export const SETTINGS_STORAGE_KEY = 'echo-garden-settings';
export const persistedSettingIds = [
  'canvasSize',
  'bgColor',
  'spawnMode',
  'micGain',
  'gain',
  'smooth',
  'fft',
  'pitchMode',
  'key',
  'colorMode',
  'trail',
  'particles',
  'captureIntervalMs',
  'mixAutoBrush',
  'mixFireworks',
  'mixFlower',
  'mixParticles',
  'mixInk',
];

export function readStoredSettings(){
  try{
    const raw = globalThis.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if(!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  }catch(err){
    console.warn('設定の読み込みに失敗:', err);
    return {};
  }
}

export function writeStoredSettings(settings){
  try{
    globalThis.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }catch(err){
    console.warn('設定の保存に失敗:', err);
  }
}

export function getPersistedSettingValue(id){
  const el = globalThis.ui[id]?.elt;
  if(!el) return null;
  if(el.type === 'checkbox') return !!el.checked;
  return el.value;
}

export function savePersistedSetting(id){
  if(!persistedSettingIds.includes(id)) return;
  const settings = readStoredSettings();
  settings[id] = getPersistedSettingValue(id);
  writeStoredSettings(settings);
}

export function isValidSelectSettingValue(id, value){
  return Array.from(globalThis.ui[id]?.elt?.options || []).some(option => option.value === value);
}

export function isValidColorSettingValue(value){
  return /^#[0-9a-f]{6}$/i.test(value);
}

export function parseNumericSettingValue(id, value){
  const el = globalThis.ui[id]?.elt;
  const num = Number(value);
  if(!el || !isFinite(num)) return null;
  const min = el.min === '' ? -Infinity : Number(el.min);
  const max = el.max === '' ? Infinity : Number(el.max);
  if(!isFinite(min) || !isFinite(max)) return null;
  if(num < min || num > max) return null;
  return String(num);
}

export function getValidatedPersistedSetting(id, value){
  const el = globalThis.ui[id]?.elt;
  if(!el || value == null) return null;

  if(el.type === 'checkbox'){
    return typeof value === 'boolean' ? value : null;
  }

  if(id === 'bgColor'){
    return typeof value === 'string' && isValidColorSettingValue(value) ? value : null;
  }

  if(el.tagName === 'SELECT'){
    return typeof value === 'string' && isValidSelectSettingValue(id, value) ? value : null;
  }

  if(['range', 'number'].includes(el.type)){
    return parseNumericSettingValue(id, value);
  }

  return typeof value === 'string' ? value : null;
}

export function applyPersistedSetting(id, value){
  const el = globalThis.ui[id]?.elt;
  if(!el) return;
  if(el.type === 'checkbox'){
    el.checked = value;
    return;
  }
  el.value = value;
}

export function restorePersistedSettings(){
  const stored = readStoredSettings();
  for(const id of persistedSettingIds){
    const validated = getValidatedPersistedSetting(id, stored[id]);
    if(validated != null){
      applyPersistedSetting(id, validated);
    }
  }
}

Object.assign(globalThis, {
  SETTINGS_STORAGE_KEY,
  persistedSettingIds,
  readStoredSettings,
  writeStoredSettings,
  getPersistedSettingValue,
  savePersistedSetting,
  isValidSelectSettingValue,
  isValidColorSettingValue,
  parseNumericSettingValue,
  getValidatedPersistedSetting,
  applyPersistedSetting,
  restorePersistedSettings,
});
