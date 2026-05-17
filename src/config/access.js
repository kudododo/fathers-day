const fallbackConfig = {
  app: {
    sourceOfTruth: 'index.html',
    version: null,
    compositionBaselineSize: { w: 1280, h: 720 },
    defaultPrintDpi: 300,
    appMode: 'public',
  },
  commerce: {
    shopifyHandoffTargetUrl: 'https://echo-garden-stg.myshopify.com/',
    shopifyHandoffQueryParam: 'artwork_id',
    includeSerialCodeInShopifyHandoff: false,
  },
  stateDefaults: {
    gW: 2048,
    gH: 1152,
    bgHex: '#04070b',
    aspectBucketId: 'landscape',
    captureIntervalMs: 5000,
  },
  featureSets: {
    full: {
      enable_recording: false,
      enable_auto_capture: false,
      enable_high_res_export: false,
      enable_advanced_scenes: true,
      enable_mixed_mode: true,
      enable_metadata_export: true,
      enable_export_presets: true,
      enable_transparent_export: true,
      enable_guided_mode: true,
      enable_public_audio_controls: false,
      enable_public_visual_controls: false,
      enable_public_direct_export_controls: false,
    },
    public: {
      enable_recording: false,
      enable_auto_capture: false,
      enable_high_res_export: false,
      enable_advanced_scenes: true,
      enable_mixed_mode: true,
      enable_metadata_export: true,
      enable_export_presets: true,
      enable_transparent_export: false,
      enable_guided_mode: false,
      enable_public_audio_controls: false,
      enable_public_visual_controls: false,
      enable_public_direct_export_controls: false,
    },
  },
  exportPresets: {
    social_1280x720: {
      id: 'social_1280x720',
      label: 'social 1280 x 720',
      width: 1280,
      height: 720,
      w: 1280,
      h: 720,
      category: 'social',
      intendedUse: 'social sharing',
      targetDpi: null,
      transparentBackgroundAllowed: false,
    },
    share_landscape_2048x1152: {
      id: 'share_landscape_2048x1152',
      label: 'share landscape 2048 x 1152',
      width: 2048,
      height: 1152,
      w: 2048,
      h: 1152,
      category: 'share',
      intendedUse: 'share landscape',
      targetDpi: null,
      transparentBackgroundAllowed: false,
    },
    share_portrait_1152x2048: {
      id: 'share_portrait_1152x2048',
      label: 'share portrait 1152 x 2048',
      width: 1152,
      height: 2048,
      w: 1152,
      h: 2048,
      category: 'share',
      intendedUse: 'share portrait',
      targetDpi: null,
      transparentBackgroundAllowed: false,
    },
    share_square_2048x2048: {
      id: 'share_square_2048x2048',
      label: 'share square 2048 x 2048',
      width: 2048,
      height: 2048,
      w: 2048,
      h: 2048,
      category: 'share',
      intendedUse: 'share square',
      targetDpi: null,
      transparentBackgroundAllowed: false,
    },
  },
  guidedDefaults: {
    enabled: false,
    targetImage: null,
    targetImageMeta: null,
    targetStyle: null,
    stylePreset: null,
    audioInfluence: 1.0,
    styleInfluence: 0.0,
    guidanceStrength: 0.0,
    targetFitMode: 'contain',
    targetOpacity: 0.0,
  },
  uiDefaults: {},
  publicPresetConfig: {
    publicDefaults: {
      renderPresetId: 'public_default',
      modePresetId: 'balanced_garden',
      aspectBucketId: 'landscape',
      deviceProfileId: 'standard',
      exportProfileId: 'share_landscape',
    },
    renderPresets: {
      public_default: {
        audio: { gain: 2.6, smooth: 0.5, fft: 1024 },
        pitch: { mode: 'cont', key: 'A' },
        visual: {
          colorMode: 'pitch',
          trail: 0.0,
          particles: 600,
          bgColor: '#04070b',
          spawnMode: 'randomized',
        },
      },
    },
    modePresets: {
      balanced_garden: {
        activeScenes: ['autobrush', 'fireworks', 'flower', 'particles', 'ink'],
        defaultRenderPresetId: 'public_default',
        spawnMode: 'randomized',
      },
    },
    aspectBuckets: {
      landscape: {
        label: '横長',
        width: 2048,
        height: 1152,
        exportProfileId: 'share_landscape',
        metadataValue: 'landscape',
      },
      portrait: {
        label: '縦長',
        width: 1152,
        height: 2048,
        exportProfileId: 'share_portrait',
        metadataValue: 'portrait',
      },
      square: {
        label: '正方形',
        width: 2048,
        height: 2048,
        exportProfileId: 'share_square',
        metadataValue: 'square',
      },
    },
    deviceProfiles: {
      standard: {
        audio: { micGain: 1.0 },
        limits: {
          maxParticles: 800,
          maxCanvasPixels: 4194304,
        },
        performance: { targetFrameRate: 60 },
      },
    },
    exportProfiles: {
      share_landscape: {
        exportPresetId: 'share_landscape_2048x1152',
        intendedUse: 'share',
        requiresMetadata: true,
        requiresUpload: false,
        transparentBackground: false,
      },
      share_portrait: {
        exportPresetId: 'share_portrait_1152x2048',
        intendedUse: 'share',
        requiresMetadata: true,
        requiresUpload: false,
        transparentBackground: false,
      },
      share_square: {
        exportPresetId: 'share_square_2048x2048',
        intendedUse: 'share',
        requiresMetadata: true,
        requiresUpload: false,
        transparentBackground: false,
      },
    },
  },
  canvasPresets: [],
};

const fallbackUiRegistry = {
  scenes: [
    { id: 'autobrush', uiId: 'mixAutoBrush', label: '線', advanced: false, requiresMixedMode: true, visible: true },
    { id: 'fireworks', uiId: 'mixFireworks', label: '花火', advanced: false, requiresMixedMode: true, visible: true },
    { id: 'flower', uiId: 'mixFlower', label: '花', advanced: false, requiresMixedMode: true, visible: true },
    { id: 'particles', uiId: 'mixParticles', label: '粒子流', advanced: true, requiresMixedMode: true, visible: true },
    { id: 'ink', uiId: 'mixInk', label: '墨', advanced: true, requiresMixedMode: true, visible: true },
  ],
  featureUiMap: {
    enable_recording: ['record'],
    enable_auto_capture: ['autoCapture', 'pickFolder', 'captureIntervalMs'],
    enable_high_res_export: ['exportPrintPng'],
    enable_export_presets: ['exportPreset', 'exportInfo'],
    enable_metadata_export: ['metaJson'],
    enable_mixed_mode: ['mixAutoBrush', 'mixFireworks', 'mixFlower', 'mixParticles', 'mixInk'],
    enable_advanced_scenes: ['mixParticles', 'mixInk'],
    enable_public_audio_controls: ['micGain', 'micGainVal', 'gain', 'gainVal', 'smooth', 'smoothVal', 'fft', 'pitchMode', 'key', 'noteReadout'],
    enable_public_visual_controls: ['bgColor', 'spawnMode', 'colorMode', 'trail', 'trailVal', 'particles', 'particlesVal'],
    enable_public_direct_export_controls: ['snap', 'metaJson', 'exportPreset', 'exportPrintPng', 'exportInfo'],
  },
};

function cloneObject(value){
  return JSON.parse(JSON.stringify(value));
}

export function getRootConfig(){
  const config = globalThis.ECHO_GARDEN_CONFIG || {};
  return {
    ...fallbackConfig,
    ...config,
    app: { ...fallbackConfig.app, ...(config.app || {}) },
    commerce: { ...fallbackConfig.commerce, ...(config.commerce || {}) },
    stateDefaults: { ...fallbackConfig.stateDefaults, ...(config.stateDefaults || {}) },
    featureSets: { ...fallbackConfig.featureSets, ...(config.featureSets || {}) },
    exportPresets: { ...fallbackConfig.exportPresets, ...(config.exportPresets || {}) },
    guidedDefaults: { ...fallbackConfig.guidedDefaults, ...(config.guidedDefaults || {}) },
    uiDefaults: { ...fallbackConfig.uiDefaults, ...(config.uiDefaults || {}) },
    publicPresetConfig: { ...fallbackConfig.publicPresetConfig, ...(config.publicPresetConfig || {}) },
    canvasPresets: config.canvasPresets || fallbackConfig.canvasPresets,
  };
}

export function getAppConfig(){
  return getRootConfig().app;
}

export function getCommerceConfig(){
  return cloneObject(getRootConfig().commerce);
}

export function getStateDefaults(){
  return getRootConfig().stateDefaults;
}

export function getFeatureSets(){
  return cloneObject(getRootConfig().featureSets);
}

export function getExportPresets(){
  return cloneObject(getRootConfig().exportPresets);
}

export function getGuidedDefaults(){
  return cloneObject(getRootConfig().guidedDefaults);
}

export function getUiDefaults(){
  return cloneObject(getRootConfig().uiDefaults);
}

export function getPublicPresetConfig(){
  return cloneObject(getRootConfig().publicPresetConfig);
}

export function getCanvasPresets(){
  return cloneObject(getRootConfig().canvasPresets);
}

export function getUiRegistry(){
  const registry = globalThis.ECHO_GARDEN_UI_REGISTRY || {};
  return {
    ...fallbackUiRegistry,
    ...registry,
    scenes: registry.scenes || fallbackUiRegistry.scenes,
    featureUiMap: { ...fallbackUiRegistry.featureUiMap, ...(registry.featureUiMap || {}) },
  };
}

export function getSceneRegistry(){
  return cloneObject(getUiRegistry().scenes);
}

export function getFeatureUiMap(){
  return cloneObject(getUiRegistry().featureUiMap);
}
