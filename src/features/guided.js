import { appState, DEFAULT_GUIDED_STATE } from '../state/store.js';

function clamp01(value, fallback){
  const numericValue = Number(value);
  if(!Number.isFinite(numericValue)) return fallback;
  return Math.min(1, Math.max(0, numericValue));
}

export function getGuidedState(){
  return appState.guided;
}

export function setGuidedEnabled(value){
  appState.guided.enabled = !!value;
  return getGuidedState();
}

export function updateGuidedState(patch = {}){
  appState.guided = {
    ...appState.guided,
    ...patch,
  };

  appState.guided.audioInfluence = clamp01(appState.guided.audioInfluence, DEFAULT_GUIDED_STATE.audioInfluence);
  appState.guided.styleInfluence = clamp01(appState.guided.styleInfluence, DEFAULT_GUIDED_STATE.styleInfluence);
  appState.guided.guidanceStrength = clamp01(appState.guided.guidanceStrength, DEFAULT_GUIDED_STATE.guidanceStrength);
  appState.guided.targetOpacity = clamp01(appState.guided.targetOpacity, DEFAULT_GUIDED_STATE.targetOpacity);

  return getGuidedState();
}

export function resetGuidedState(){
  appState.guided = { ...DEFAULT_GUIDED_STATE };
  return getGuidedState();
}

export function hasGuidedTarget(){
  return !!appState.guided.targetImage || !!appState.guided.targetImageMeta;
}

export function canUseGuidedMode(){
  const featureEnabled = globalThis.isFeatureEnabled?.('enable_guided_mode') ?? true;
  return featureEnabled && !!appState.guided.enabled;
}

export function getGuidedInfluenceValues(){
  return {
    audioInfluence: appState.guided.audioInfluence,
    styleInfluence: appState.guided.styleInfluence,
    guidanceStrength: appState.guided.guidanceStrength,
  };
}

export function getGuidedReferenceInfo(){
  return {
    hasTargetImage: hasGuidedTarget(),
    targetImageMeta: appState.guided.targetImageMeta,
    targetStyle: appState.guided.targetStyle,
    stylePreset: appState.guided.stylePreset,
    targetFitMode: appState.guided.targetFitMode,
    targetOpacity: appState.guided.targetOpacity,
  };
}

export function buildGuidedContext(){
  const state = getGuidedState();
  return {
    enabled: canUseGuidedMode(),
    featureEnabled: globalThis.isFeatureEnabled?.('enable_guided_mode') ?? true,
    hasTargetImage: hasGuidedTarget(),
    targetImageMeta: state.targetImageMeta,
    targetStyle: state.targetStyle,
    stylePreset: state.stylePreset,
    audioInfluence: state.audioInfluence,
    styleInfluence: state.styleInfluence,
    guidanceStrength: state.guidanceStrength,
    targetFitMode: state.targetFitMode,
    targetOpacity: state.targetOpacity,
  };
}

Object.assign(globalThis, {
  DEFAULT_GUIDED_STATE,
  getGuidedState,
  setGuidedEnabled,
  updateGuidedState,
  resetGuidedState,
  hasGuidedTarget,
  canUseGuidedMode,
  getGuidedInfluenceValues,
  getGuidedReferenceInfo,
  buildGuidedContext,
});
