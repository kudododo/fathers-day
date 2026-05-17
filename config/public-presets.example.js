(function(){
  window.ECHO_GARDEN_PUBLIC_PRESET_CONFIG = {
    publicDefaults: {
      renderPresetId: 'public_default',
      modePresetId: 'balanced_garden',
      aspectBucketId: 'landscape',
      deviceProfileId: 'standard',
      exportProfileId: 'share_landscape',
    },
    renderPresets: {
      public_default: {
        label: 'Public Default',
        audio: {
          gain: 2.6,
          smooth: 0.5,
          fft: 1024,
        },
        pitch: {
          mode: 'cont',
          key: 'A',
        },
        visual: {
          colorMode: 'pitch',
          trail: 0.0,
          particles: 600,
          bgColor: '#04070b',
          spawnMode: 'randomized',
        },
      },
      vivid: {
        label: 'Vivid',
        audio: {
          gain: 3.0,
          smooth: 0.42,
          fft: 1024,
        },
        pitch: {
          mode: 'cont',
          key: 'A',
        },
        visual: {
          colorMode: 'pitch',
          trail: 0.015,
          particles: 800,
          bgColor: '#04070b',
          spawnMode: 'randomized',
        },
      },
      calm: {
        label: 'Calm',
        audio: {
          gain: 2.1,
          smooth: 0.68,
          fft: 1024,
        },
        pitch: {
          mode: 'cont',
          key: 'A',
        },
        visual: {
          colorMode: 'pitch',
          trail: 0.03,
          particles: 450,
          bgColor: '#04070b',
          spawnMode: 'structured',
        },
      },
      print_safe: {
        label: 'Print Safe',
        audio: {
          gain: 2.6,
          smooth: 0.5,
          fft: 1024,
        },
        pitch: {
          mode: 'cont',
          key: 'A',
        },
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
        label: 'Balanced Garden',
        activeScenes: ['autobrush', 'fireworks', 'flower', 'particles', 'ink'],
        defaultRenderPresetId: 'public_default',
        spawnMode: 'randomized',
      },
      quiet_bloom: {
        label: 'Quiet Bloom',
        activeScenes: ['autobrush', 'flower', 'ink'],
        defaultRenderPresetId: 'calm',
        spawnMode: 'structured',
      },
      bright_flow: {
        label: 'Bright Flow',
        activeScenes: ['autobrush', 'fireworks', 'particles'],
        defaultRenderPresetId: 'vivid',
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
        label: 'Standard',
        audio: {
          micGain: 1.0,
        },
        limits: {
          maxParticles: 800,
          maxCanvasPixels: 4194304,
        },
        performance: {
          targetFrameRate: 60,
        },
      },
      low_power: {
        label: 'Low Power',
        audio: {
          micGain: 1.0,
        },
        limits: {
          maxParticles: 350,
          maxCanvasPixels: 921600,
        },
        performance: {
          targetFrameRate: 30,
        },
      },
    },
    exportProfiles: {
      share_landscape: {
        label: 'Share Landscape',
        exportPresetId: 'share_landscape_2048x1152',
        intendedUse: 'share',
        requiresMetadata: true,
        requiresUpload: false,
        transparentBackground: false,
      },
      share_portrait: {
        label: 'Share Portrait',
        exportPresetId: 'share_portrait_1152x2048',
        intendedUse: 'share',
        requiresMetadata: true,
        requiresUpload: false,
        transparentBackground: false,
      },
      share_square: {
        label: 'Share Square',
        exportPresetId: 'share_square_2048x2048',
        intendedUse: 'share',
        requiresMetadata: true,
        requiresUpload: false,
        transparentBackground: false,
      },
      productize_print_square: {
        label: 'Productize Print Square',
        exportPresetId: 'print_square_3000x3000',
        intendedUse: 'productize',
        requiresMetadata: true,
        requiresUpload: true,
        transparentBackground: false,
      },
    },
  };
})();
