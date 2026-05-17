import { appState } from './state/store.js';
import { snapMidi } from './audio/pitch.js';
import { analyze } from './audio/analyzer.js';
import { runActiveScene } from './scenes/dispatcher.js';
import { chooseCaptureFolder, performAutoCaptureOnce, startAutoCapture, stopAutoCapture } from './features/capture.js';
import { startRecording, stopRecording, toggleRecording } from './features/recording.js';
import { buildGuidedContext, getGuidedReferenceInfo } from './features/guided.js';
import './features/persistence.js';
import { startMic, stopMic } from './audio/mic.js';
import { getAppConfig, getCanvasPresets, getExportPresets, getFeatureSets, getFeatureUiMap, getPublicPresetConfig, getSceneRegistry, getUiDefaults } from './config/access.js';
import { drawArtworkToScreen, renderIdleFrame } from './render/canvas.js';
import { createArtworkIdentity } from './services/artwork/artwork-id.js';
import { createArtworkImageBlob } from './services/artwork/artwork-export.js';
import { saveArtwork } from './services/storage/artwork-upload.js';
import { buildShopifyHandoffPayload } from './services/shopify/shopify-payload.js';
import { startShopifyDryRunHandoff, startShopifyMvpHandoff } from './services/shopify/shopify-redirect.js';

const appConfig = getAppConfig();
const uiDefaults = getUiDefaults();
const publicPresetConfig = getPublicPresetConfig();
const canvasPresets = getCanvasPresets();
const sceneRegistry = getSceneRegistry();
const COMPOSITION_BASELINE_SIZE = appConfig.compositionBaselineSize || { w: 1280, h: 720 };
const DEFAULT_PRINT_DPI = appConfig.defaultPrintDpi || 300;

const FEATURE_SETS = getFeatureSets();

const featureUiControls = getFeatureUiMap();

function getAppMode(){
  const mode = appConfig.appMode || 'public';
  return FEATURE_SETS[mode] ? mode : 'full';
}

function resolveFeatureFlags(mode = getAppMode()){
  return {
    ...FEATURE_SETS.full,
    ...(FEATURE_SETS[mode] || {}),
  };
}

const ACTIVE_APP_MODE = getAppMode();
const ACTIVE_FEATURE_FLAGS = resolveFeatureFlags(ACTIVE_APP_MODE);

function getCurrentFeatureFlags(){
  return ACTIVE_FEATURE_FLAGS;
}

function isFeatureEnabled(flagName){
  return !!ACTIVE_FEATURE_FLAGS[flagName];
}

function requireFeature(flagName){
  if(isFeatureEnabled(flagName)) return true;
  console.warn(`Echo Garden feature disabled: ${flagName}`);
  return false;
}

const exportPresets = getExportPresets();

function hsb(h, s, b, a=1){
  h = ((h%360)+360)%360; s = globalThis.constrain(s,0,1); b = globalThis.constrain(b,0,1);
  const c = b * s;
  const x = c * (1 - globalThis.abs((h/60)%2 - 1));
  const m = b - c;
  let r=0,gc=0,bc=0;
  if(h<60){ r=c; gc=x; bc=0; }
  else if(h<120){ r=x; gc=c; bc=0; }
  else if(h<180){ r=0; gc=c; bc=x; }
  else if(h<240){ r=0; gc=x; bc=c; }
  else if(h<300){ r=x; gc=0; bc=c; }
  else { r=c; gc=0; bc=x; }
  return globalThis.color((r+m)*255,(gc+m)*255,(bc+m)*255,a*255);
}

function hexToRGB(hex){
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if(!m){
    return {r:4,g:7,b:11};
  }
  const intVal = parseInt(m[1],16);
  return {
    r:(intVal>>16)&255,
    g:(intVal>>8)&255,
    b:(intVal)&255
  };
}

function fillBGOnG(){
  const rgb = hexToRGB(appState.bgHex);
  globalThis.g.push();
  globalThis.g.colorMode(globalThis.RGB);
  globalThis.g.noStroke();
  globalThis.g.fill(rgb.r, rgb.g, rgb.b);
  globalThis.g.rect(0,0,appState.gW,appState.gH);
  globalThis.g.pop();
}

function updateDebugSize(){
  const el = document.getElementById('debugSize');
  if(el){
    el.textContent = `Canvas: ${appState.gW}x${appState.gH}`;
  }
}

function updateDebugBG(){
  const el = document.getElementById('debugBG');
  if(el){
    el.textContent = `BG: ${appState.bgHex}`;
  }
}

function updateFolderPathLabel(){
  const el = document.getElementById('folderPath');
  if(!el) return;
  if(appState.captureDirHandle){
    el.textContent = '保存中フォルダ: ' + (appState.captureDirHandle.name || '(指定済みフォルダ)');
  }else{
    el.textContent = '';
  }
}

function applyConfiguredUIDefaults(){
  populateCanvasPresetOptions();
  populateExportPresetOptions();

  for(const [id, value] of Object.entries(uiDefaults)){
    const el = globalThis.ui?.[id]?.elt;
    if(!el || value == null) continue;
    el.value = String(value);
  }
}

function setUIValue(id, value){
  const el = globalThis.ui?.[id]?.elt;
  if(!el || value == null) return false;
  el.value = String(value);
  return true;
}

function setUIChecked(id, checked){
  const el = globalThis.ui?.[id]?.elt;
  if(!el || el.type !== 'checkbox') return false;
  el.checked = !!checked;
  return true;
}

function getPublicPresetDefaults(){
  const defaults = publicPresetConfig.publicDefaults || {};
  const modePreset = publicPresetConfig.modePresets?.[defaults.modePresetId] || {};
  const renderPresetId = modePreset.defaultRenderPresetId || defaults.renderPresetId;
  const aspectBucket = getAspectBucketById(defaults.aspectBucketId) || {};
  const exportProfileId = aspectBucket.exportProfileId || defaults.exportProfileId;
  return {
    defaults,
    modePreset,
    renderPreset: publicPresetConfig.renderPresets?.[renderPresetId] || {},
    aspectBucket,
    deviceProfile: publicPresetConfig.deviceProfiles?.[defaults.deviceProfileId] || {},
    exportProfile: publicPresetConfig.exportProfiles?.[exportProfileId] || {},
  };
}

function getPublicPresetMetadataContext(aspectBucket = getActiveAspectBucket(), exportProfileId = null){
  const defaults = publicPresetConfig.publicDefaults || {};
  const modePresetId = defaults.modePresetId || null;
  const modePreset = publicPresetConfig.modePresets?.[modePresetId] || {};
  const renderPresetId = modePreset.defaultRenderPresetId || defaults.renderPresetId || null;
  const deviceProfileId = defaults.deviceProfileId || null;
  const resolvedExportProfileId = exportProfileId || aspectBucket?.exportProfileId || defaults.exportProfileId || null;
  const exportProfile = publicPresetConfig.exportProfiles?.[resolvedExportProfileId] || {};

  return {
    renderPresetId,
    modePresetId,
    deviceProfileId,
    exportProfileId: resolvedExportProfileId,
    renderPreset: publicPresetConfig.renderPresets?.[renderPresetId] || {},
    modePreset,
    deviceProfile: publicPresetConfig.deviceProfiles?.[deviceProfileId] || {},
    exportProfile,
  };
}

function clampParticlesForDeviceProfile(value, deviceProfile){
  const numeric = Number(value);
  if(!isFinite(numeric)) return value;
  const maxParticles = Number(deviceProfile?.limits?.maxParticles);
  return isFinite(maxParticles) ? Math.min(numeric, maxParticles) : numeric;
}

function getAspectBuckets(){
  return publicPresetConfig.aspectBuckets || {};
}

function getDefaultAspectBucketId(){
  return publicPresetConfig.publicDefaults?.aspectBucketId || appState.aspectBucketId || 'landscape';
}

function getAspectBucketById(id){
  const buckets = getAspectBuckets();
  const bucketId = id && buckets[id] ? id : getDefaultAspectBucketId();
  const bucket = buckets[bucketId] || buckets.landscape || Object.values(buckets)[0] || null;
  return bucket ? { id: bucketId, ...bucket } : null;
}

function getAspectBucketSize(bucket){
  if(!bucket) return null;
  const width = Number(bucket.width);
  const height = Number(bucket.height);
  if(isFinite(width) && isFinite(height) && width > 0 && height > 0){
    return { w: width, h: height };
  }

  const canvasPreset = canvasPresets.find((item) => item.id === bucket.canvasPresetId);
  if(canvasPreset){
    return { w: canvasPreset.width, h: canvasPreset.height };
  }
  return null;
}

function getAspectBucketIdFromValue(value){
  const buckets = getAspectBuckets();
  if(value && buckets[value]) return value;
  const valueString = String(value || '');
  const match = Object.entries(buckets).find(([_id, bucket]) => {
    const size = getAspectBucketSize(bucket);
    return bucket.canvasPresetId === valueString || (size && `${size.w}x${size.h}` === valueString);
  });
  return match?.[0] || null;
}

function getActiveAspectBucketId(){
  const selected = getAspectBucketIdFromValue(globalThis.ui?.canvasSize?.value?.());
  return selected || appState.aspectBucketId || getDefaultAspectBucketId();
}

function getActiveAspectBucket(){
  return getAspectBucketById(getActiveAspectBucketId());
}

function getExportProfileForAspectBucket(bucket){
  const exportProfileId = bucket?.exportProfileId || publicPresetConfig.publicDefaults?.exportProfileId;
  const profile = publicPresetConfig.exportProfiles?.[exportProfileId] || {};
  return { id: exportProfileId || null, ...profile };
}

function getExportPresetForAspectBucket(bucket = getActiveAspectBucket()){
  const exportProfile = getExportProfileForAspectBucket(bucket);
  return getExportPreset(exportProfile.exportPresetId);
}

function syncExportPresetForAspectBucket(bucket = getActiveAspectBucket()){
  const exportPreset = getExportPresetForAspectBucket(bucket);
  if(exportPreset){
    setUIValue('exportPreset', exportPreset.id);
  }
}

function ensureArtworkIdentity(){
  if(!appState.artworkId || !appState.serialCode){
    const identity = createArtworkIdentity();
    appState.artworkId = identity.artworkId;
    appState.serialCode = identity.serialCode;
  }
  return {
    artworkId: appState.artworkId,
    serialCode: appState.serialCode,
  };
}

function startNewArtworkIdentity(){
  const identity = createArtworkIdentity();
  appState.artworkId = identity.artworkId;
  appState.serialCode = identity.serialCode;
  appState.lastArtworkExport = null;
  appState.lastArtworkMetadata = null;
  appState.lastArtworkStorageResult = null;
  appState.productizeStatus = 'idle';
  appState.productizeError = null;
  appState.shareStatus = 'idle';
  appState.shareError = null;
  appState.lastArtworkShareResult = null;
  appState.lastShopifyHandoffPayload = null;
  appState.handoffStatus = 'idle';
  appState.handoffError = null;
  appState.lastShopifyHandoffResult = null;
  return identity;
}

function updateProductizeStatusUI(message = null){
  const statusEl = globalThis.ui?.productizeStatus;
  if(!statusEl) return;

  const fallbackMessages = {
    idle: '作品を作ったらグッズ作成へ進めます。',
    exporting: '作品を保存しています...',
    uploaded: 'グッズ作成の準備ができました。',
    productize_ready: 'グッズ作成の準備ができました。',
    error_retryable: '保存に失敗しました。もう一度試せます。',
  };
  statusEl.html(message || fallbackMessages[appState.productizeStatus] || '');
}

function setGoodsCreateButtonEnabled(enabled){
  const button = globalThis.ui?.goodsCreate;
  if(!button?.elt) return;
  button.elt.disabled = !enabled;
}

function getLatestArtworkMasterUrl(){
  return appState.lastArtworkStorageResult?.artwork_master_url ||
    appState.lastArtworkMetadata?.artwork_master_url ||
    appState.lastArtworkMetadata?.storage_info?.artwork_master_url ||
    appState.lastArtworkMetadata?.productize_info?.artwork_master_url ||
    null;
}

function setShareButtonEnabled(enabled){
  const button = globalThis.ui?.shareUrl;
  if(!button?.elt) return;
  button.elt.disabled = !enabled;
}

function updateShareStatusUI(message = null){
  const statusEl = globalThis.ui?.shareStatus;
  const shareReady = !!getLatestArtworkMasterUrl();
  setShareButtonEnabled(shareReady);
  if(!statusEl) return;

  const fallbackMessages = {
    idle: '保存後にURLを共有できます。',
    share_ready: 'URLを共有できます。',
    sharing: '共有を準備しています...',
    copied: 'URLをコピーしました。',
    shared: '共有を開始しました。',
    error_retryable: '共有に失敗しました。もう一度試せます。',
  };
  statusEl.html(message || fallbackMessages[appState.shareStatus] || '');
}

function hasShopifyHandoffPayload(){
  const payload = appState.lastShopifyHandoffPayload || appState.lastArtworkMetadata?.productize_info?.handoff_payload;
  return !!payload?.artwork_id;
}

function setShopifyHandoffButtonEnabled(enabled){
  const button = globalThis.ui?.shopifyHandoff;
  if(!button?.elt) return;
  button.elt.disabled = !enabled;
}

function updateHandoffStatusUI(message = null){
  const statusEl = globalThis.ui?.handoffStatus;
  const handoffReady = hasShopifyHandoffPayload();
  setShopifyHandoffButtonEnabled(handoffReady);
  if(!statusEl) return;

  const fallbackMessages = {
    idle: '保存後にShopifyへ進めます。',
    handoff_ready: 'Shopifyへ進めます。',
    handoff_started: 'Shopifyへ移動します。',
    error_retryable: 'Shopify遷移の準備に失敗しました。もう一度試せます。',
  };
  statusEl.html(message || fallbackMessages[appState.handoffStatus] || '');
}

async function copyArtworkUrlToClipboard(url){
  if(navigator.clipboard?.writeText){
    await navigator.clipboard.writeText(url);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = url;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if(!copied) throw new Error('Clipboard copy failed');
}

async function shareLatestArtworkUrl(){
  const url = getLatestArtworkMasterUrl();
  if(!url){
    appState.shareStatus = 'error_retryable';
    appState.shareError = 'artwork_master_url is not ready';
    appState.lastArtworkShareResult = null;
    updateShareStatusUI('保存後にURLを共有できます。');
    return null;
  }

  appState.shareStatus = 'sharing';
  appState.shareError = null;
  updateShareStatusUI();

  try{
    if(navigator.share){
      await navigator.share({
        title: 'Echo Garden',
        text: 'Echo Gardenで作った作品です。',
        url,
      });
      appState.shareStatus = 'shared';
      appState.lastArtworkShareResult = {
        method: 'web_share',
        artwork_master_url: url,
        shared_at: new Date().toISOString(),
      };
      updateShareStatusUI('共有を開始しました。');
    }else{
      await copyArtworkUrlToClipboard(url);
      appState.shareStatus = 'copied';
      appState.lastArtworkShareResult = {
        method: 'clipboard',
        artwork_master_url: url,
        shared_at: new Date().toISOString(),
      };
      updateShareStatusUI('URLをコピーしました。');
    }

    console.info('Echo Garden share result:', appState.lastArtworkShareResult);
    return appState.lastArtworkShareResult;
  }catch(err){
    appState.shareStatus = 'error_retryable';
    appState.shareError = err?.message || String(err);
    appState.lastArtworkShareResult = null;
    updateShareStatusUI(`共有に失敗しました。もう一度試せます。${appState.shareError}`);
    console.error('Echo Garden share failed:', err);
    return null;
  }
}

function applyPublicPresetToUI(){
  const { modePreset, renderPreset, aspectBucket, deviceProfile } = getPublicPresetDefaults();
  const visual = renderPreset.visual || {};
  const audio = renderPreset.audio || {};
  const pitch = renderPreset.pitch || {};

  setUIValue('micGain', deviceProfile.audio?.micGain);
  setUIValue('gain', audio.gain);
  setUIValue('smooth', audio.smooth);
  setUIValue('fft', audio.fft);
  setUIValue('pitchMode', pitch.mode);
  setUIValue('key', pitch.key);
  setUIValue('colorMode', visual.colorMode);
  setUIValue('trail', visual.trail);
  setUIValue('particles', clampParticlesForDeviceProfile(visual.particles, deviceProfile));
  setUIValue('bgColor', visual.bgColor);
  setUIValue('spawnMode', modePreset.spawnMode || visual.spawnMode);

  const aspectBucketId = aspectBucket.id || getDefaultAspectBucketId();
  setUIValue('canvasSize', aspectBucketId);
  appState.aspectBucketId = aspectBucketId;
  syncExportPresetForAspectBucket(aspectBucket);

  const activeScenes = new Set(modePreset.activeScenes || []);
  for(const scene of sceneRegistry){
    if(globalThis.ui?.[scene.uiId]){
      setUIChecked(scene.uiId, activeScenes.has(scene.id));
    }
  }
}

function applyUiRegistryToStaticDom(){
  populateSceneMixOptions();
  populateCanvasPresetOptions();
  populateExportPresetOptions();
}

function replaceSelectOptions(selectEl, options){
  if(!selectEl || !options.length) return;
  const currentValue = selectEl.value;
  selectEl.replaceChildren(...options);
  if([...selectEl.options].some((option) => option.value === currentValue)){
    selectEl.value = currentValue;
  }
}

function populateCanvasPresetOptions(){
  const selectEl = globalThis.ui?.canvasSize?.elt || document.getElementById('canvasSize');
  const buckets = Object.entries(getAspectBuckets());
  if(!selectEl || !buckets.length) return;
  const options = buckets.map(([id, bucket]) => {
    const size = getAspectBucketSize(bucket);
    const option = document.createElement('option');
    option.value = id;
    option.textContent = bucket.label || id;
    if(size){
      option.dataset.width = String(size.w);
      option.dataset.height = String(size.h);
    }
    return option;
  });
  replaceSelectOptions(selectEl, options);
}

function populateExportPresetOptions(){
  const selectEl = globalThis.ui?.exportPreset?.elt || document.getElementById('exportPreset');
  const presets = Object.values(exportPresets);
  if(!selectEl || !presets.length) return;
  const options = presets.map((preset) => {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = preset.label;
    return option;
  });
  replaceSelectOptions(selectEl, options);
}

function createSceneCheckbox(scene){
  const label = document.createElement('label');
  label.style.display = 'flex';
  label.style.alignItems = 'center';
  label.style.gap = '6px';
  label.style.minWidth = 'auto';
  label.dataset.sceneId = scene.id;
  label.dataset.advanced = scene.advanced ? 'true' : 'false';

  const input = document.createElement('input');
  input.id = scene.uiId;
  input.type = 'checkbox';

  const text = document.createElement('span');
  text.textContent = scene.label;

  label.append(input, text);
  return label;
}

function populateSceneMixOptions(){
  const container = document.getElementById('sceneMixOptions');
  if(!container || !sceneRegistry.length) return;
  const sceneControls = sceneRegistry
    .filter((scene) => scene.visible !== false)
    .map(createSceneCheckbox);
  container.replaceChildren(...sceneControls);
}

function getExportPreset(id){
  return id ? (exportPresets[id] || null) : null;
}

function getSelectedExportPreset(){
  return getExportPreset(globalThis.ui.exportPreset?.value()) ||
    getExportPresetForAspectBucket() ||
    exportPresets.social_1280x720;
}

function setFeatureControlAvailable(id, enabled){
  const el = globalThis.ui?.[id]?.elt;
  if(!el) return;

  el.disabled = !enabled;
  if(el.type === 'checkbox' && !enabled){
    el.checked = false;
  }

  const container = el.closest('label') || el;
  container.hidden = !enabled;
}

function setPrintPresetOptionAvailability(){
  const presetEl = globalThis.ui?.exportPreset?.elt;
  if(!presetEl) return;
  for(const option of presetEl.options){
    const preset = getExportPreset(option.value);
    option.disabled = preset.category === 'print' && !isFeatureEnabled('enable_high_res_export');
  }
  if(presetEl.selectedOptions[0]?.disabled){
    const aspectPreset = getExportPresetForAspectBucket();
    presetEl.value = aspectPreset?.id || 'social_1280x720';
  }
}

function applyFeatureFlagsToUI(){
  for(const [flagName, ids] of Object.entries(featureUiControls)){
    const enabled = isFeatureEnabled(flagName);
    for(const id of ids){
      setFeatureControlAvailable(id, enabled);
    }
  }
  setPrintPresetOptionAvailability();
  updateExportPresetInfo();
}

function findExportPresetIdBySize(width, height){
  const match = Object.values(exportPresets).find((preset) => (
    getPresetWidth(preset) === width && getPresetHeight(preset) === height
  ));
  return match?.id || null;
}

function findSelectedExportPresetIdForSize(width, height){
  const selected = globalThis.ui?.exportPreset ? getSelectedExportPreset() : null;
  if(!selected) return null;
  return getPresetWidth(selected) === width && getPresetHeight(selected) === height
    ? selected.id
    : null;
}

function getPresetWidth(preset){
  return preset?.width ?? preset?.w ?? appState.gW;
}

function getPresetHeight(preset){
  return preset?.height ?? preset?.h ?? appState.gH;
}

function inchesToPixels(inches, dpi = DEFAULT_PRINT_DPI){
  return Math.ceil(inches * dpi);
}

function mmToInches(mm){
  return mm / 25.4;
}

function mmToPixels(mm, dpi = DEFAULT_PRINT_DPI){
  return inchesToPixels(mmToInches(mm), dpi);
}

function getPrintSizeInches(spec){
  if(spec.printWidthInches && spec.printHeightInches){
    return {
      width: spec.printWidthInches,
      height: spec.printHeightInches,
    };
  }
  if(spec.printWidthMm && spec.printHeightMm){
    return {
      width: mmToInches(spec.printWidthMm),
      height: mmToInches(spec.printHeightMm),
    };
  }
  return null;
}

function getRequiredPixelSize(widthInches, heightInches, dpi = DEFAULT_PRINT_DPI){
  return {
    width: inchesToPixels(widthInches, dpi),
    height: inchesToPixels(heightInches, dpi),
  };
}

function getRequiredPixelsForPrint(widthInches, heightInches, dpi = DEFAULT_PRINT_DPI){
  const size = getRequiredPixelSize(widthInches, heightInches, dpi);
  return { w: size.width, h: size.height };
}

function getEffectiveDpi(pixelWidth, pixelHeight, printWidthInches, printHeightInches){
  if(!printWidthInches || !printHeightInches) return null;
  return {
    effectiveDpiX: pixelWidth / printWidthInches,
    effectiveDpiY: pixelHeight / printHeightInches,
    minDpi: Math.min(pixelWidth / printWidthInches, pixelHeight / printHeightInches),
  };
}

function getDpiForPixelSize(widthPx, heightPx, widthIn, heightIn){
  const dpi = getEffectiveDpi(widthPx, heightPx, widthIn, heightIn);
  if(!dpi) return null;
  return {
    x: dpi.effectiveDpiX,
    y: dpi.effectiveDpiY,
    min: dpi.minDpi,
  };
}

function buildExportSpecFromPreset(id, options = {}){
  const preset = id ? getExportPreset(id) : null;
  const width = options.width || getPresetWidth(preset);
  const height = options.height || getPresetHeight(preset);
  return {
    presetId: preset?.id || null,
    format: options.format || 'png',
    width,
    height,
    targetDpi: preset?.targetDpi ?? null,
    intendedUse: preset?.intendedUse || 'custom export',
    category: preset?.category || 'custom',
    printWidthInches: preset?.printWidthInches ?? null,
    printHeightInches: preset?.printHeightInches ?? null,
    printWidthMm: preset?.printWidthMm ?? null,
    printHeightMm: preset?.printHeightMm ?? null,
    transparentBackgroundAllowed: !!preset?.transparentBackgroundAllowed,
    transparentBackground: !!options.transparentBackground && !!preset?.transparentBackgroundAllowed,
    fileBaseName: options.fileBaseName || null,
  };
}

function getPrintSafetyCheck(spec){
  const warnings = [];
  const printSize = getPrintSizeInches(spec);

  if(spec.category !== 'print' || !printSize || !spec.targetDpi){
    return {
      isSafe: true,
      effectiveDpiX: null,
      effectiveDpiY: null,
      targetDpi: spec.targetDpi ?? null,
      requiredPixelSize: null,
      warnings,
    };
  }

  const dpi = getEffectiveDpi(spec.width, spec.height, printSize.width, printSize.height);
  const requiredPixelSize = getRequiredPixelSize(printSize.width, printSize.height, spec.targetDpi);
  if(dpi.effectiveDpiX < spec.targetDpi || dpi.effectiveDpiY < spec.targetDpi){
    warnings.push(`effective dpi is below target ${spec.targetDpi}`);
  }

  return {
    isSafe: warnings.length === 0,
    effectiveDpiX: dpi.effectiveDpiX,
    effectiveDpiY: dpi.effectiveDpiY,
    targetDpi: spec.targetDpi,
    requiredPixelSize,
    warnings,
  };
}

function getDpiSafetyCheck(preset){
  const spec = buildExportSpecFromPreset(preset.id);
  const check = getPrintSafetyCheck(spec);
  const required = check.requiredPixelSize ? { w: check.requiredPixelSize.width, h: check.requiredPixelSize.height } : null;
  const dpi = check.effectiveDpiX == null ? null : {
    x: check.effectiveDpiX,
    y: check.effectiveDpiY,
    min: Math.min(check.effectiveDpiX, check.effectiveDpiY),
  };
  return {
    ok: check.isSafe,
    dpi,
    required,
    message: preset.category === 'print'
      ? `${check.isSafe ? 'OK' : '要注意'}: ${dpi.min.toFixed(0)}dpi相当 / 目標${check.targetDpi}dpiには${required.w}x${required.h}px以上`
      : `${getPresetWidth(preset)}x${getPresetHeight(preset)}px / 画面向けプリセット`,
  };
}

function updateExportPresetInfo(){
  const el = globalThis.ui.exportInfo;
  if(!el) return;
  const preset = getSelectedExportPreset();
  if(!preset) return;
  const dpiCheck = getDpiSafetyCheck(preset);
  const scale = getExportScaleFromBaseline(getPresetWidth(preset), getPresetHeight(preset));
  el.html(`${preset.label}: ${getPresetWidth(preset)}x${getPresetHeight(preset)}px / baseline比 ${scale.toFixed(2)}x / ${dpiCheck.message}`);
}

function applyTrailFade(){
  const tr = globalThis.float(globalThis.ui.trail.value());
  if(tr>0){
    const rgb = hexToRGB(appState.bgHex);
    globalThis.g.push();
    globalThis.g.noStroke();
    globalThis.g.colorMode(globalThis.RGB);
    globalThis.g.fill(rgb.r, rgb.g, rgb.b, 255*tr);
    globalThis.g.rect(0,0,appState.gW,appState.gH);
    globalThis.g.pop();
  }
}

function deriveHueFromAudio(a){
  const pmode = globalThis.ui.pitchMode.value();
  let midiNow = a.smoothMidi ?? a.midi;

  let hue;
  if (globalThis.ui.colorMode.value()==='pitch' && (a.smoothMidi || a.midi)) {
    const snapped2 = snapMidi(midiNow, pmode, globalThis.ui.key.value());
    const pc2 = ((Math.round(snapped2)%12)+12)%12;
    const baseHue = globalThis.map(pc2, 0, 12, 0, 360);

    const oct = Math.floor((snapped2||0)/12);
    const variant = (oct % 4 + 4) % 4;
    const jitter = globalThis.random(-10,10);
    hue = (baseHue + variant*15 + jitter + 360) % 360;
  } else {
    hue = (globalThis.centroidHue + globalThis.random(-18,18)) % 360;
  }
  if(!isFinite(hue)){
    hue = (globalThis.centroidHue + globalThis.random(-18,18) + 360) % 360;
  }
  return hue;
}

function toggleFullscreen(){
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    appState.fullscreenMode = true;
    hideUIForFullscreen();
  } else {
    document.exitFullscreen();
  }
}

function hideUIForFullscreen(){
  globalThis.select('#ui').addClass('hidden');
  globalThis.select('#footer').addClass('hidden');
}

function showUIAfterFullscreen(){
  globalThis.select('#ui').removeClass('hidden');
  globalThis.select('#footer').removeClass('hidden');
}

function handleFullscreenChange(){
  if (document.fullscreenElement) {
    appState.fullscreenMode = true;
    hideUIForFullscreen();
  } else {
    appState.fullscreenMode = false;
    showUIAfterFullscreen();
  }
}

function resizeArtworkFromPreset(){
  const aspectBucketId = getAspectBucketIdFromValue(globalThis.ui.canvasSize.value());
  const aspectBucket = getAspectBucketById(aspectBucketId);
  const size = getAspectBucketSize(aspectBucket);
  if(!size) return false;
  appState.aspectBucketId = aspectBucket.id;
  syncExportPresetForAspectBucket(aspectBucket);
  return resizeArtworkToSize(size.w, size.h, { aspectBucketId: aspectBucket.id });
}

function createArtworkGraphics(widthPx, heightPx){
  const nextG = globalThis.createGraphics(widthPx, heightPx);
  nextG.pixelDensity(1);
  return nextG;
}

function transferArtworkToGraphics(sourceG, targetG, targetW, targetH){
  if(!sourceG || !targetG) return;
  targetG.push();
  targetG.drawingContext.imageSmoothingEnabled = true;
  targetG.drawingContext.imageSmoothingQuality = 'high';
  const scale = Math.min(targetW / sourceG.width, targetH / sourceG.height);
  const drawW = sourceG.width * scale;
  const drawH = sourceG.height * scale;
  const x = (targetW - drawW) / 2;
  const y = (targetH - drawH) / 2;
  targetG.image(sourceG, x, y, drawW, drawH);
  targetG.pop();
}

function scaleNumberProp(obj, prop, scale){
  if(typeof obj[prop] === 'number') obj[prop] *= scale;
}

function scalePointObject(obj, sx, sy){
  scaleNumberProp(obj, 'x', sx);
  scaleNumberProp(obj, 'y', sy);
}

function scaleRuntimeObjectsForCanvasResize(prevW, prevH, nextW, nextH){
  const sx = nextW / prevW;
  const sy = nextH / prevH;
  const s = Math.min(sx, sy);

  for(const st of globalThis.strokes){
    scalePointObject(st, sx, sy);
    scaleNumberProp(st, 'w0', s);
    scaleNumberProp(st, 'jitter', s);
    for(const p of st.path || []) scalePointObject(p, sx, sy);
  }

  for(const p of globalThis.fireworks){
    scalePointObject(p, sx, sy);
    scaleNumberProp(p, 'vx', sx);
    scaleNumberProp(p, 'vy', sy);
    scaleNumberProp(p, 'size', s);
  }

  for(const f of globalThis.flowers){
    scalePointObject(f, sx, sy);
    scaleNumberProp(f, 'size', s);
    scaleNumberProp(f, 'sizeGrow', s);
  }

  for(const p of globalThis.particlesFlow){
    scalePointObject(p, sx, sy);
    scaleNumberProp(p, 'vx', sx);
    scaleNumberProp(p, 'vy', sy);
  }

  for(const b of globalThis.inkBlobs){
    scalePointObject(b, sx, sy);
    scaleNumberProp(b, 'r', s);
  }

  for(const band of globalThis.auroraBands){
    scaleNumberProp(band, 'y', sy);
    scaleNumberProp(band, 'amp', sy);
  }

  for(const star of globalThis.galaxyStars){
    scaleNumberProp(star, 'r', s);
    scaleNumberProp(star, 'vr', s);
  }

  for(const drop of globalThis.rainDrops){
    scalePointObject(drop, sx, sy);
    scaleNumberProp(drop, 'vy', sy);
  }

  for(const butterfly of globalThis.butterflies){
    scalePointObject(butterfly, sx, sy);
    scaleNumberProp(butterfly, 'vx', sx);
    scaleNumberProp(butterfly, 'vy', sy);
    scaleNumberProp(butterfly, 'size', s);
  }
}

function resizeArtworkToSize(widthPx, heightPx, options = {}){
  appState.exportScaleCompensation = options.exportScaleCompensation || 1;
  if(options.aspectBucketId){
    appState.aspectBucketId = options.aspectBucketId;
  }
  if(widthPx === appState.gW && heightPx === appState.gH){
    updateDebugSize();
    updateExportPresetInfo();
    return false;
  }

  const previous = { w: appState.gW, h: appState.gH, g: globalThis.g };
  const nextG = createArtworkGraphics(widthPx, heightPx);

  appState.gW = widthPx;
  appState.gH = heightPx;
  globalThis.g = nextG;
  fillBGOnG();
  transferArtworkToGraphics(previous.g, globalThis.g, widthPx, heightPx);
  scaleRuntimeObjectsForCanvasResize(previous.w, previous.h, widthPx, heightPx);
  updateDebugSize();
  updateExportPresetInfo();
  return true;
}

function savePNG(){
  const identity = ensureArtworkIdentity();
  const fileBaseName = createArtworkExportBaseName('visual', identity.artworkId);
  const aspectBucket = getActiveAspectBucket();
  const exportProfile = getExportProfileForAspectBucket(aspectBucket);
  const a = document.createElement('a');
  a.download = `${fileBaseName}.png`;
  a.href = globalThis.g.elt.toDataURL('image/png');
  a.click();
  appState.lastArtworkExport = {
    format: 'png',
    width: appState.gW,
    height: appState.gH,
    fileBaseName,
    artworkId: identity.artworkId,
    serialCode: identity.serialCode,
    presetId: findExportPresetIdBySize(appState.gW, appState.gH),
    aspectBucketId: aspectBucket?.metadataValue || aspectBucket?.id || appState.aspectBucketId,
    exportProfileId: exportProfile.id,
  };
  appState.lastArtworkMetadata = getArtworkMetadata({ export: appState.lastArtworkExport });
  console.info('Echo Garden artwork metadata:', appState.lastArtworkMetadata);
}

function getExportScaleFromBaseline(widthPx, heightPx){
  return Math.min(widthPx / COMPOSITION_BASELINE_SIZE.w, heightPx / COMPOSITION_BASELINE_SIZE.h);
}

function getRenderScale(){
  return appState.exportScaleCompensation || 1;
}

function createArtworkExportBaseName(prefix = 'visual', artworkId = null){
  const resolvedArtworkId = typeof artworkId === 'string' && artworkId
    ? artworkId
    : ensureArtworkIdentity().artworkId;
  return `${prefix}-${resolvedArtworkId}`;
}

function createPrintExportFilename(fileBaseName){
  return `${fileBaseName}.png`;
}

function createPrintExportGraphics(preset){
  const exportG = createArtworkGraphics(getPresetWidth(preset), getPresetHeight(preset));
  const rgb = hexToRGB(appState.bgHex);
  exportG.push();
  exportG.colorMode(globalThis.RGB);
  exportG.noStroke();
  exportG.fill(rgb.r, rgb.g, rgb.b);
  exportG.rect(0, 0, getPresetWidth(preset), getPresetHeight(preset));
  exportG.pop();
  transferArtworkToGraphics(globalThis.g, exportG, getPresetWidth(preset), getPresetHeight(preset));
  return exportG;
}

function exportPrintPNG(){
  if(!isFeatureEnabled('enable_high_res_export') || !isFeatureEnabled('enable_export_presets')){
    requireFeature(!isFeatureEnabled('enable_high_res_export') ? 'enable_high_res_export' : 'enable_export_presets');
    return;
  }
  const preset = getSelectedExportPreset();
  const spec = buildExportSpecFromPreset(preset.id);
  const identity = ensureArtworkIdentity();
  const fileBaseName = createArtworkExportBaseName('print', identity.artworkId);
  const exportG = createPrintExportGraphics(preset);
  const a = document.createElement('a');
  a.download = createPrintExportFilename(fileBaseName);
  a.href = exportG.elt.toDataURL('image/png');
  a.click();
  exportG.remove();
  appState.lastArtworkExport = {
    format: 'png',
    width: spec.width,
    height: spec.height,
    fileBaseName,
    artworkId: identity.artworkId,
    serialCode: identity.serialCode,
    presetId: spec.presetId,
    aspectBucketId: appState.aspectBucketId,
    exportProfileId: getExportProfileForAspectBucket().id,
  };
  appState.lastArtworkMetadata = getArtworkMetadata({ export: appState.lastArtworkExport });
  console.info('Echo Garden artwork metadata:', appState.lastArtworkMetadata);
  updateExportPresetInfo();
}

function getMetadataExportContext(options = {}){
  const last = appState.lastArtworkExport || {};
  const width = options.width || last.width || appState.gW;
  const height = options.height || last.height || appState.gH;
  const identity = ensureArtworkIdentity();
  const fileBaseName = options.fileBaseName || last.fileBaseName || createArtworkExportBaseName('visual', identity.artworkId);
  const presetId = options.presetId || last.presetId || findSelectedExportPresetIdForSize(width, height) || findExportPresetIdBySize(width, height);
  const aspectBucket = getActiveAspectBucket();
  return {
    format: options.format || last.format || 'png',
    width,
    height,
    fileBaseName,
    presetId,
    artworkId: options.artworkId || last.artworkId || identity.artworkId,
    serialCode: options.serialCode || last.serialCode || identity.serialCode,
    aspectBucketId: options.aspectBucketId || last.aspectBucketId || aspectBucket?.metadataValue || aspectBucket?.id || appState.aspectBucketId || null,
    exportProfileId: options.exportProfileId || last.exportProfileId || getExportProfileForAspectBucket(aspectBucket).id || null,
  };
}

function readUIValue(id, fallback = null){
  const el = globalThis.ui?.[id];
  if(!el) return fallback;
  try{
    return el.value();
  }catch(_err){
    return el.elt?.value ?? fallback;
  }
}

function readUINumber(id, fallback = null){
  const value = Number(readUIValue(id, fallback));
  return isFinite(value) ? value : fallback;
}

function getActiveScenes(){
  return sceneRegistry
    .filter((scene) => !!globalThis.ui?.[scene.uiId]?.elt?.checked)
    .map((scene) => scene.id);
}

function getSceneConfig(){
  const mixed = {};
  for(const scene of sceneRegistry){
    mixed[scene.id] = !!globalThis.ui?.[scene.uiId]?.elt?.checked;
  }
  return {
    activeScenes: getActiveScenes(),
    mixed,
  };
}

function buildRenderContext(analysis){
  return {
    analysis,
    sceneId: 'mixed',
    state: appState,
    ui: globalThis.ui,
    guided: buildGuidedContext(),
    features: {
      isFeatureEnabled,
    },
    render: {
      drawArtworkToScreen,
      renderIdleFrame,
    },
  };
}

function buildGuidedMetadata(){
  const guided = buildGuidedContext();
  const reference = getGuidedReferenceInfo();
  return {
    enabled: guided.enabled,
    featureEnabled: guided.featureEnabled,
    targetStyle: guided.targetStyle,
    stylePreset: guided.stylePreset,
    audioInfluence: guided.audioInfluence,
    styleInfluence: guided.styleInfluence,
    guidanceStrength: guided.guidanceStrength,
    hasTargetImage: guided.hasTargetImage,
    targetImageMeta: reference.targetImageMeta,
    targetFitMode: guided.targetFitMode,
    targetOpacity: guided.targetOpacity,
  };
}

function buildArtworkMetadata(options = {}){
  const exportContext = getMetadataExportContext(options.export);
  const presetId = exportContext.presetId || null;
  const exportSpec = buildExportSpecFromPreset(presetId, exportContext);
  exportSpec.fileBaseName = exportContext.fileBaseName;
  const printSafetyCheck = getPrintSafetyCheck(exportSpec);
  const createdAt = options.createdAt || new Date().toISOString();
  const artworkId = options.artworkId || exportContext.artworkId;
  const serialCode = options.serialCode || exportContext.serialCode;
  const aspectBucket = getAspectBucketById(exportContext.aspectBucketId);
  const presetContext = getPublicPresetMetadataContext(aspectBucket, exportContext.exportProfileId);
  const aspectBucketValue = aspectBucket?.metadataValue || aspectBucket?.id || exportContext.aspectBucketId;
  const canvasSize = {
    width: appState.gW,
    height: appState.gH,
    size: `${appState.gW}x${appState.gH}`,
    aspect_bucket: aspectBucketValue,
  };
  const exportInfo = {
    preset_id: exportSpec.presetId,
    export_profile: presetContext.exportProfileId,
    format: exportSpec.format,
    width: exportSpec.width,
    height: exportSpec.height,
    export_size: `${exportSpec.width}x${exportSpec.height}`,
    file_base_name: exportSpec.fileBaseName,
    intended_use: exportSpec.intendedUse,
    category: exportSpec.category,
    target_dpi: exportSpec.targetDpi,
    transparent_background: exportSpec.transparentBackground,
    transparent_background_allowed: exportSpec.transparentBackgroundAllowed,
  };

  return {
    schemaVersion: '1.3.0',
    schema_version: '1.3.0',
    artworkId,
    artwork_id: artworkId,
    serialCode,
    serial_code: serialCode,
    createdAt,
    created_at: createdAt,
    timestamp: createdAt,
    version: appConfig.version ?? null,
    source_app: 'echo_garden',
    aspect_bucket: aspectBucketValue,
    render_preset: presetContext.renderPresetId,
    mode_preset: presetContext.modePresetId,
    device_profile: presetContext.deviceProfileId,
    canvas_size: canvasSize,
    bg_color: appState.bgHex,
    artwork_master_url: null,
    export_info: exportInfo,
    scene_config: getSceneConfig(),
    productize_info: {
      status: 'not_started',
      artwork_master_url: null,
      handoff_payload: null,
    },
    storage_info: {
      status: 'not_uploaded',
      artwork_master_url: null,
      provider: null,
    },
    preset_config: {
      render_preset: presetContext.renderPreset,
      mode_preset: presetContext.modePreset,
      device_profile: presetContext.deviceProfile,
      export_profile: presetContext.exportProfile,
    },
    export: {
      presetId: exportSpec.presetId,
      format: exportSpec.format,
      width: exportSpec.width,
      height: exportSpec.height,
      exportSize: `${exportSpec.width}x${exportSpec.height}`,
      targetDpi: exportSpec.targetDpi,
      intendedUse: exportSpec.intendedUse,
      category: exportSpec.category,
      transparentBackground: exportSpec.transparentBackground,
      transparentBackgroundAllowed: exportSpec.transparentBackgroundAllowed,
      fileBaseName: exportSpec.fileBaseName,
      aspectBucket: aspectBucketValue,
      exportProfileId: exportContext.exportProfileId,
      printSafetyCheck,
    },
    canvas: {
      size: `${appState.gW}x${appState.gH}`,
      width: appState.gW,
      height: appState.gH,
      aspectBucket: appState.aspectBucketId,
      bgColor: appState.bgHex,
    },
    audio: {
      gain: readUINumber('gain'),
      smooth: readUINumber('smooth'),
      fft: readUINumber('fft'),
      pitchMode: readUIValue('pitchMode'),
      key: readUIValue('key'),
    },
    visual: {
      colorMode: readUIValue('colorMode'),
      trail: readUINumber('trail'),
      particles: readUINumber('particles'),
      spawnMode: readUIValue('spawnMode'),
    },
    scene: {
      activeScenes: getActiveScenes(),
      sceneConfig: getSceneConfig(),
    },
    guided: buildGuidedMetadata(),
    app: {
      sourceOfTruth: appConfig.sourceOfTruth || 'index.html',
      appVersion: appConfig.version ?? null,
    },
  };
}

function getArtworkMetadata(options = {}){
  const metadata = buildArtworkMetadata(options);
  appState.lastArtworkMetadata = metadata;
  return metadata;
}

async function saveCurrentArtworkToStorage(){
  const metadata = getArtworkMetadata();
  const imageBlob = await createArtworkImageBlob(globalThis.g);
  const storageResult = await saveArtwork({ imageBlob, metadata });

  appState.lastArtworkStorageResult = storageResult;
  appState.lastArtworkMetadata = storageResult.metadata;

  console.info('Echo Garden artwork storage result:', storageResult);
  return storageResult;
}

function buildProductizeReadyMetadata(metadata, storageResult){
  const handoffPayload = buildShopifyHandoffPayload({ metadata, storageResult });
  return {
    ...metadata,
    artwork_master_url: storageResult.artwork_master_url,
    productize_info: {
      ...(metadata?.productize_info || {}),
      status: 'productize_ready',
      artwork_master_url: storageResult.artwork_master_url,
      handoff_payload: handoffPayload,
    },
  };
}

function buildCurrentShopifyHandoffPayload(options = {}){
  const metadata = options.metadata || appState.lastArtworkMetadata;
  const storageResult = options.storageResult || appState.lastArtworkStorageResult;
  const payload = buildShopifyHandoffPayload({
    metadata,
    storageResult,
    product: options.product,
    print: options.print,
    includeMetadata: options.includeMetadata,
  });
  appState.lastShopifyHandoffPayload = payload;
  console.info('Echo Garden Shopify handoff payload:', payload);
  return payload;
}

function startShopifyDryRunFromCurrentArtwork(){
  try{
    const payload = appState.lastShopifyHandoffPayload || buildCurrentShopifyHandoffPayload();
    appState.handoffStatus = 'handoff_started';
    appState.handoffError = null;
    updateHandoffStatusUI();
    const result = startShopifyDryRunHandoff(payload);
    appState.lastShopifyHandoffResult = result;
    console.info('Echo Garden Shopify dry-run handoff:', result);
    return result;
  }catch(err){
    appState.handoffStatus = 'error_retryable';
    appState.handoffError = err?.message || String(err);
    appState.lastShopifyHandoffResult = null;
    updateHandoffStatusUI(`Shopify dry-runの準備に失敗しました。${appState.handoffError}`);
    console.error('Echo Garden Shopify dry-run handoff failed:', err);
    return null;
  }
}

function startShopifyHandoffFromCurrentArtwork(){
  try{
    const payload = appState.lastShopifyHandoffPayload || buildCurrentShopifyHandoffPayload();
    appState.handoffStatus = 'handoff_started';
    appState.handoffError = null;
    updateHandoffStatusUI();
    const result = startShopifyMvpHandoff(payload);
    appState.lastShopifyHandoffResult = result;
    console.info('Echo Garden Shopify MVP handoff:', result);
    return result;
  }catch(err){
    appState.handoffStatus = 'error_retryable';
    appState.handoffError = err?.message || String(err);
    appState.lastShopifyHandoffResult = null;
    updateHandoffStatusUI(`Shopify遷移の準備に失敗しました。${appState.handoffError}`);
    console.error('Echo Garden Shopify MVP handoff failed:', err);
    return null;
  }
}

async function startProductizeSaveFlow(){
  appState.productizeStatus = 'exporting';
  appState.productizeError = null;
  setGoodsCreateButtonEnabled(false);
  updateProductizeStatusUI();

  try{
    const storageResult = await saveCurrentArtworkToStorage();
    const readyMetadata = buildProductizeReadyMetadata(storageResult.metadata, storageResult);
    const readyResult = {
      ...storageResult,
      metadata: readyMetadata,
      productize_ready: true,
    };

    appState.productizeStatus = 'productize_ready';
    appState.shareStatus = 'share_ready';
    appState.shareError = null;
    appState.lastArtworkStorageResult = readyResult;
    appState.lastArtworkMetadata = readyMetadata;
    appState.lastShopifyHandoffPayload = readyMetadata.productize_info.handoff_payload;
    appState.handoffStatus = 'handoff_ready';
    appState.handoffError = null;
    updateProductizeStatusUI(`グッズ作成の準備ができました: ${storageResult.artwork_master_url}`);
    updateShareStatusUI();
    updateHandoffStatusUI();
    console.info('Echo Garden productize ready:', readyResult);
    return readyResult;
  }catch(err){
    appState.productizeStatus = 'error_retryable';
    appState.productizeError = err?.message || String(err);
    updateProductizeStatusUI(`保存に失敗しました。もう一度試せます。${appState.productizeError}`);
    console.error('Echo Garden productize save failed:', err);
    return null;
  }finally{
    setGoodsCreateButtonEnabled(true);
  }
}

function downloadJsonFile(payload, filename){
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function exportArtworkMetadataJson(){
  if(!isFeatureEnabled('enable_metadata_export')){
    requireFeature('enable_metadata_export');
    return;
  }
  const metadata = getArtworkMetadata();
  downloadJsonFile(metadata, `${metadata.export.fileBaseName}.json`);
}

function guardedToggleRecording(){
  if(!requireFeature('enable_recording')) return;
  return toggleRecording();
}

async function guardedStartRecording(){
  if(!requireFeature('enable_recording')) return;
  return startRecording();
}

function guardedStopRecording(){
  if(!requireFeature('enable_recording')) return;
  return stopRecording();
}

function guardedExportPrintPNG(){
  if(!requireFeature('enable_high_res_export')) return;
  if(!requireFeature('enable_export_presets')) return;
  return exportPrintPNG();
}

function guardedExportArtworkMetadataJson(){
  if(!requireFeature('enable_metadata_export')) return;
  return exportArtworkMetadataJson();
}

async function guardedChooseCaptureFolder(){
  if(!requireFeature('enable_auto_capture')) return;
  return chooseCaptureFolder();
}

function guardedStartAutoCapture(){
  if(!requireFeature('enable_auto_capture')){
    if(globalThis.ui?.autoCapture?.elt){
      globalThis.ui.autoCapture.elt.checked = false;
    }
    return;
  }
  return startAutoCapture();
}

async function guardedPerformAutoCaptureOnce(){
  if(!requireFeature('enable_auto_capture')) return;
  return performAutoCaptureOnce();
}

function clearArt(){
  globalThis.strokes.length = 0;
  globalThis.fireworks.length = 0;
  globalThis.flowers.length = 0;
  globalThis.inkBlobs.length = 0;
  globalThis.particlesFlow.length = 0;
  globalThis.auroraBands.length = 0;
  globalThis.galaxyStars.length = 0;
  globalThis.rainDrops.length = 0;
  globalThis.butterflies.length = 0;
  globalThis.g.clear();
  fillBGOnG();
  startNewArtworkIdentity();
  updateProductizeStatusUI();
  updateShareStatusUI();
  updateHandoffStatusUI();
}

function angleDiff(a,b){
  let d = (b-a+globalThis.PI)%globalThis.TWO_PI - globalThis.PI;
  if(d<-globalThis.PI) d+=globalThis.TWO_PI;
  return d;
}

function resolveSceneRenderOptions(options){
  return {
    applyTrail: options?.applyTrail !== false,
    renderToScreen: options?.renderToScreen !== false
  };
}

function setup(){
  globalThis.createCanvas(globalThis.windowWidth, globalThis.windowHeight);
  globalThis.pixelDensity(Math.min(2, globalThis.pixelDensity()));

  // offscreen artwork canvas
  globalThis.g = globalThis.createGraphics(appState.gW, appState.gH);
  globalThis.g.pixelDensity(1);
  fillBGOnG();

  globalThis.noFill();
  globalThis.background(4,7,11);

  applyUiRegistryToStaticDom();
  globalThis.collectUIElements();
  applyConfiguredUIDefaults();
  globalThis.restorePersistedSettings();
  applyPublicPresetToUI();
  globalThis.syncInitialUIState();
  globalThis.bindUIEvents();
  applyFeatureFlagsToUI();
  updateShareStatusUI();
  updateHandoffStatusUI();
}

function windowResized(){
  globalThis.resizeCanvas(globalThis.windowWidth, globalThis.windowHeight);
}

function draw(){
  if(!appState.micOn || !appState.running || !globalThis.fft){
    renderIdleFrame();
    return;
  }

  const a = analyze();
  const renderContext = buildRenderContext(a);
  runActiveScene(renderContext);
}

function keyPressed(){
  if(globalThis.key === ' '){
    if(appState.micOn){ stopMic(); } else { startMic(); }
    return false;
  }
  if(globalThis.key === 'a' || globalThis.key === 'A'){
    toggleFullscreen();
    return false;
  }
  if(globalThis.key === 'c' || globalThis.key === 'C'){
    clearArt();
    return false;
  }
  if(globalThis.key === 'r' || globalThis.key === 'R'){
    guardedToggleRecording();
    return false;
  }
}

const EchoGardenApp = {
  setup,
  windowResized,
  draw,
  keyPressed,
};

function initializeEchoGarden(){
  return EchoGardenApp;
}

Object.assign(globalThis, {
  EchoGardenApp,
  initializeEchoGarden,
  setup,
  windowResized,
  draw,
  keyPressed,
  hsb,
  fillBGOnG,
  updateDebugSize,
  updateDebugBG,
  updateFolderPathLabel,
  FEATURE_SETS,
  ACTIVE_APP_MODE,
  getAppMode,
  resolveFeatureFlags,
  getCurrentFeatureFlags,
  isFeatureEnabled,
  requireFeature,
  ensureArtworkIdentity,
  startNewArtworkIdentity,
  updateProductizeStatusUI,
  updateShareStatusUI,
  updateHandoffStatusUI,
  applyUiRegistryToStaticDom,
  applyConfiguredUIDefaults,
  applyFeatureFlagsToUI,
  applyTrailFade,
  deriveHueFromAudio,
  toggleFullscreen,
  handleFullscreenChange,
  resizeArtworkFromPreset,
  resizeArtworkToSize,
  savePNG,
  createArtworkExportBaseName,
  exportPresets,
  getExportPreset,
  getSelectedExportPreset,
  findExportPresetIdBySize,
  buildExportSpecFromPreset,
  getArtworkMetadata,
  saveArtwork,
  saveCurrentArtworkToStorage,
  buildShopifyHandoffPayload,
  buildCurrentShopifyHandoffPayload,
  startShopifyHandoffFromCurrentArtwork,
  startShopifyDryRunFromCurrentArtwork,
  startProductizeSaveFlow,
  shareLatestArtworkUrl,
  inchesToPixels,
  mmToPixels,
  getRequiredPixelSize,
  getEffectiveDpi,
  getPrintSafetyCheck,
  getRequiredPixelsForPrint,
  getDpiForPixelSize,
  getDpiSafetyCheck,
  getRenderScale,
  updateExportPresetInfo,
  exportPrintPNG: guardedExportPrintPNG,
  getMetadataExportContext,
  getActiveScenes,
  buildRenderContext,
  buildGuidedMetadata,
  buildArtworkMetadata,
  exportArtworkMetadataJson: guardedExportArtworkMetadataJson,
  toggleRecording: guardedToggleRecording,
  startRecording: guardedStartRecording,
  stopRecording: guardedStopRecording,
  chooseCaptureFolder: guardedChooseCaptureFolder,
  startAutoCapture: guardedStartAutoCapture,
  stopAutoCapture,
  performAutoCaptureOnce: guardedPerformAutoCaptureOnce,
  clearArt,
  angleDiff,
  resolveSceneRenderOptions,
  drawArtworkToScreen,
  renderIdleFrame,
  runActiveScene,
  setup,
  windowResized,
  draw,
  keyPressed,
});
