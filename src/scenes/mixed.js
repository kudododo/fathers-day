import { spawnStroke, stepStroke } from './autobrush.js';
import { spawnFireworkBurst, stepFireworkParticle } from './fireworks.js';
import { spawnFlower, stepFlower } from './flower.js';
import { sceneParticles } from './particles.js';
import { sceneInk } from './ink.js';

export function getMixedSceneFlags(){
  const mixedEnabled = globalThis.isFeatureEnabled?.('enable_mixed_mode') ?? true;
  const advancedEnabled = globalThis.isFeatureEnabled?.('enable_advanced_scenes') ?? true;
  return {
    useBrush: mixedEnabled && !!globalThis.ui.mixAutoBrush?.elt?.checked,
    useFire: mixedEnabled && !!globalThis.ui.mixFireworks?.elt?.checked,
    useFlow: mixedEnabled && !!globalThis.ui.mixFlower?.elt?.checked,
    useWave: mixedEnabled && advancedEnabled && !!globalThis.ui.mixWave?.elt?.checked,
    useParticles: mixedEnabled && advancedEnabled && !!globalThis.ui.mixParticles?.elt?.checked,
    useAurora: mixedEnabled && advancedEnabled && !!globalThis.ui.mixAurora?.elt?.checked,
    useGalaxy: mixedEnabled && advancedEnabled && !!globalThis.ui.mixGalaxy?.elt?.checked,
    useRain: mixedEnabled && advancedEnabled && !!globalThis.ui.mixRain?.elt?.checked,
    useInk: mixedEnabled && advancedEnabled && !!globalThis.ui.mixInk?.elt?.checked,
    useButterfly: mixedEnabled && advancedEnabled && !!globalThis.ui.mixButterfly?.elt?.checked,
  };
}

export function spawnMixedCoreScenes(a, flags, beatDetected, vol){
  if (beatDetected) {
    if (flags.useBrush){
      const cnt = 2 + globalThis.int(a.level*6);
      for(let k=0;k<cnt;k++) spawnStroke(a);
    }
    if (flags.useFire){
      spawnFireworkBurst(a);
      spawnFireworkBurst(a);
    }
    if (flags.useFlow){
      const cnt = 1 + globalThis.int(a.level*4);
      for(let k=0;k<cnt;k++) spawnFlower(a);
    }
  }

  if (flags.useBrush && globalThis.random() < 0.02 + a.level*0.04 + globalThis.constrain(vol,0,1)*0.05){
    spawnStroke(a);
  }
  if (flags.useFire  && globalThis.random() < 0.02 + a.level*0.03 + globalThis.constrain(vol,0,1)*0.03){
    spawnFireworkBurst(a);
  }
  if (flags.useFlow  && globalThis.random() < 0.015 + a.level*0.03 + globalThis.constrain(vol,0,1)*0.03){
    spawnFlower(a);
  }
}

export function updateMixedCoreScenes(a, flags){
  if (flags.useBrush){
    for(let i=globalThis.strokes.length-1;i>=0;i--){
      if(!stepStroke(globalThis.strokes[i], a)) globalThis.strokes.splice(i,1);
    }
  }
  if (flags.useFire){
    for(let i=globalThis.fireworks.length-1;i>=0;i--){
      if(!stepFireworkParticle(globalThis.fireworks[i], a)) globalThis.fireworks.splice(i,1);
    }
  }
  if (flags.useFlow){
    for(let i=globalThis.flowers.length-1;i>=0;i--){
      if(!stepFlower(globalThis.flowers[i], a)) globalThis.flowers.splice(i,1);
    }
  }
}

export function updateMixedDelegatedScenes(a, flags){
  const mixedSceneOptions = { applyTrail: false, renderToScreen: false };
  if (flags.useWave)      globalThis.sceneWave(a, mixedSceneOptions);
  if (flags.useParticles) sceneParticles(a, mixedSceneOptions);
  if (flags.useAurora)    globalThis.sceneAurora(a, mixedSceneOptions);
  if (flags.useGalaxy)    globalThis.sceneGalaxy(a, mixedSceneOptions);
  if (flags.useRain)      globalThis.sceneRain(a, mixedSceneOptions);
  if (flags.useInk)       sceneInk(a, mixedSceneOptions);
  if (flags.useButterfly) globalThis.sceneButterfly(a, mixedSceneOptions);
}

export function sceneMixed(a){
  const flags = getMixedSceneFlags();

  globalThis.applyTrailFade();

  const vol = globalThis.amp ? globalThis.amp.getLevel() * (+globalThis.ui.gain.value()) : 0.0;
  const beatDetected = globalThis.detectBeat(a.level);

  spawnMixedCoreScenes(a, flags, beatDetected, vol);
  updateMixedCoreScenes(a, flags);
  updateMixedDelegatedScenes(a, flags);

  globalThis.drawArtworkToScreen();
}

Object.assign(globalThis, {
  getMixedSceneFlags,
  spawnMixedCoreScenes,
  updateMixedCoreScenes,
  updateMixedDelegatedScenes,
  sceneMixed,
});
