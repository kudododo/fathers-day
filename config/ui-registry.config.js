(function(){
  window.ECHO_GARDEN_UI_REGISTRY = {
    scenes: [
      { id: 'autobrush', uiId: 'mixAutoBrush', label: '線', advanced: false, requiresMixedMode: true, visible: true },
      { id: 'fireworks', uiId: 'mixFireworks', label: '花火', advanced: false, requiresMixedMode: true, visible: true },
      { id: 'flower', uiId: 'mixFlower', label: '花', advanced: false, requiresMixedMode: true, visible: true },
      { id: 'particles', uiId: 'mixParticles', label: '粒子流', advanced: true, requiresMixedMode: true, visible: true },
      { id: 'ink', uiId: 'mixInk', label: '墨', advanced: true, requiresMixedMode: true, visible: true },
      { id: 'wave', uiId: 'mixWave', label: '波', advanced: true, requiresMixedMode: true, visible: false },
      { id: 'aurora', uiId: 'mixAurora', label: 'オーロラ', advanced: true, requiresMixedMode: true, visible: false },
      { id: 'galaxy', uiId: 'mixGalaxy', label: '銀河', advanced: true, requiresMixedMode: true, visible: false },
      { id: 'rain', uiId: 'mixRain', label: '光の雨', advanced: true, requiresMixedMode: true, visible: false },
      { id: 'butterfly', uiId: 'mixButterfly', label: '蝶', advanced: true, requiresMixedMode: true, visible: false },
    ],
    featureUiMap: {
      enable_recording: ['record'],
      enable_auto_capture: ['autoCapture', 'pickFolder', 'captureIntervalMs'],
      enable_high_res_export: ['exportPrintPng'],
      enable_export_presets: ['exportPreset', 'exportInfo'],
      enable_metadata_export: ['metaJson'],
      enable_mixed_mode: ['mixAutoBrush', 'mixFireworks', 'mixFlower', 'mixParticles', 'mixInk'],
      enable_advanced_scenes: ['mixParticles', 'mixInk', 'mixWave', 'mixAurora', 'mixGalaxy', 'mixRain', 'mixButterfly'],
      enable_public_audio_controls: ['micGain', 'micGainVal', 'gain', 'gainVal', 'smooth', 'smoothVal', 'fft', 'pitchMode', 'key', 'noteReadout'],
      enable_public_visual_controls: ['bgColor', 'spawnMode', 'colorMode', 'trail', 'trailVal', 'particles', 'particlesVal'],
      enable_public_direct_export_controls: ['snap', 'metaJson', 'exportPreset', 'exportPrintPng', 'exportInfo'],
    },
  };
})();
