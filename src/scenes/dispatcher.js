import { sceneAutoBrush } from './autobrush.js';
import { sceneFireworks } from './fireworks.js';
import { sceneFlower } from './flower.js';
import { sceneMixed } from './mixed.js';

const sceneHandlers = {
  autobrush: sceneAutoBrush,
  fireworks: sceneFireworks,
  flower: sceneFlower,
  mixed: sceneMixed,
};

export function resolveSceneId(sceneId, context = {}){
  if(sceneId === 'mixed' && context.features?.isFeatureEnabled && !context.features.isFeatureEnabled('enable_mixed_mode')){
    return null;
  }
  return sceneHandlers[sceneId] ? sceneId : 'mixed';
}

export function getSceneHandler(sceneId){
  return sceneHandlers[sceneId] || sceneHandlers.mixed;
}

export function runScene(sceneId, context){
  const resolvedSceneId = resolveSceneId(sceneId, context);
  if(!resolvedSceneId){
    context.render?.renderIdleFrame?.();
    return;
  }

  const handler = getSceneHandler(resolvedSceneId);
  handler(context.analysis);
}

export function runActiveScene(context){
  runScene(context.sceneId || 'mixed', context);
}
