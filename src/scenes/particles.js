import { appState } from '../state/store.js';

// 粒子流（particles）
export function getParticleSpawnPosition(a){
  const mode = globalThis.ui.spawnMode.value();
  let x, y;
  if(mode === 'structured'){
    const r = globalThis.random(globalThis.min(appState.gW,appState.gH)*0.03, globalThis.min(appState.gW,appState.gH)*0.18 * (1 + a.level*0.6));
    const th = globalThis.random(globalThis.TAU);
    x = appState.gW/2 + r*globalThis.cos(th);
    y = appState.gH/2 + r*globalThis.sin(th);
  }else{
    x = globalThis.random(appState.gW);
    y = globalThis.random(appState.gH);
  }
  return { x, y };
}

export function createParticleFlowItem(a, spawnPosition){
  const scale = globalThis.getRenderScale?.() || 1;
  const ang = globalThis.random(globalThis.TAU);
  return {
    x: spawnPosition.x,
    y: spawnPosition.y,
    vx: globalThis.cos(ang)*0.5*scale,
    vy: globalThis.sin(ang)*0.5*scale,
    life: 180 + globalThis.int(globalThis.random(120)),
    hue: globalThis.random(360)
  };
}

export function spawnParticle(a){
  const spawnPosition = getParticleSpawnPosition(a);
  globalThis.particlesFlow.push(createParticleFlowItem(a, spawnPosition));
}

export function advanceParticleFlowItem(p, a){
  const scale = globalThis.getRenderScale?.() || 1;
  const n = globalThis.noise(p.x*0.002, p.y*0.002, globalThis.frameCount*0.005);
  const th = n * globalThis.TAU * 2.0;
  p.vx += (globalThis.cos(th)*0.08 + (a.level-0.2)*0.12) * scale;
  p.vy += (globalThis.sin(th)*0.08 + (a.level-0.2)*0.12) * scale;
  p.vx *= 0.96;
  p.vy *= 0.96;
  p.x += p.vx;
  p.y += p.vy;
  if(p.x<0) p.x+=appState.gW;
  if(p.x>appState.gW) p.x-=appState.gW;
  if(p.y<0) p.y+=appState.gH;
  if(p.y>appState.gH) p.y-=appState.gH;
  p.life--;
}

export function getParticleFlowStyle(a){
  const scale = globalThis.getRenderScale?.() || 1;
  return {
    hue: globalThis.deriveHueFromAudio(a),
    size: (1 + a.level*3 + a.bass*2) * scale,
    alpha: 0.45 + a.tre*0.35
  };
}

export function drawParticleFlowItem(p, style){
  globalThis.g.stroke(globalThis.hsb(style.hue, 0.8, 1, style.alpha));
  globalThis.g.strokeWeight(style.size);
  globalThis.g.point(p.x, p.y);
}

export function isParticleFlowItemAlive(p){
  return p.life>0;
}

export function getParticlesCap(){
  return globalThis.int(globalThis.ui.particles.value());
}

export function getParticlesSpawnDeficit(){
  return getParticlesCap() - globalThis.particlesFlow.length;
}

export function spawnParticlesToCap(a){
  const deficit = getParticlesSpawnDeficit();
  if (deficit > 0) {
    const add = Math.min(deficit, globalThis.int(1 + a.level * 6));
    for (let i = 0; i < add; i++) spawnParticle(a);
  }
}

export function updateParticleFlow(a){
  for (let i = globalThis.particlesFlow.length - 1; i >= 0; i--) {
    if (!stepParticle(globalThis.particlesFlow[i], a)) globalThis.particlesFlow.splice(i, 1);
  }
}

export function stepParticle(p, a){
  advanceParticleFlowItem(p, a);
  drawParticleFlowItem(p, getParticleFlowStyle(a));
  return isParticleFlowItemAlive(p);
}

export function sceneParticles(a, options){
  const { applyTrail, renderToScreen } = globalThis.resolveSceneRenderOptions(options);
  if(applyTrail) globalThis.applyTrailFade();

  spawnParticlesToCap(a);
  updateParticleFlow(a);
  if(renderToScreen) globalThis.drawArtworkToScreen();
}

Object.assign(globalThis, {
  getParticleSpawnPosition,
  createParticleFlowItem,
  spawnParticle,
  advanceParticleFlowItem,
  getParticleFlowStyle,
  drawParticleFlowItem,
  isParticleFlowItemAlive,
  getParticlesCap,
  getParticlesSpawnDeficit,
  spawnParticlesToCap,
  updateParticleFlow,
  stepParticle,
  sceneParticles,
});
