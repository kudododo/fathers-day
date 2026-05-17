import { appState } from '../state/store.js';
import { snapMidi } from '../audio/pitch.js';

// --------------------------------------------------
// FIREWORKS シーン（花火）
// --------------------------------------------------
export function getFireworkBurstCenter(a){
  const mode = globalThis.ui.spawnMode.value();
  let cx, cy;

  if(mode === 'structured' && (a.smoothMidi || a.midi)){
    const pmode = globalThis.ui.pitchMode.value();
    const snapped = snapMidi(a.smoothMidi ?? a.midi, pmode, globalThis.ui.key.value());
    const pc = ((Math.round(snapped)%12)+12)%12;
    const ang = globalThis.map(pc, 0, 12, 0, globalThis.TAU);

    const r0 = globalThis.random(
      Math.min(appState.gW,appState.gH)*0.05,
      Math.min(appState.gW,appState.gH)*0.25 * (1 + a.bass*0.4)
    );
    cx = appState.gW/2 + r0 * globalThis.cos(ang);
    cy = appState.gH/2 + r0 * globalThis.sin(ang);
  } else {
    cx = globalThis.random(appState.gW);
    cy = globalThis.random(appState.gH);
  }

  return { cx, cy };
}

export function getFireworkParticleCount(a){
  return globalThis.int(globalThis.map(a.level,0,1,12,40));
}

export function createFireworkParticle(a, center, hueBase){
  const scale = globalThis.getRenderScale?.() || 1;
  const ang = globalThis.random(globalThis.TWO_PI);
  const spd = globalThis.random(1, 4 + a.level*6) * scale;
  return {
    x: center.cx,
    y: center.cy,
    vx: globalThis.cos(ang)*spd,
    vy: globalThis.sin(ang)*spd,
    life: globalThis.int(globalThis.random(20,40) * (1 + a.tre*0.8)),
    hue: (hueBase + globalThis.random(-15,15)+360)%360,
    size: (globalThis.random(1,3) + a.tre*2) * scale
  };
}

export function spawnFireworkBurst(a){
  const center = getFireworkBurstCenter(a);
  const hueBase = globalThis.deriveHueFromAudio(a);
  const count = getFireworkParticleCount(a);
  for(let i=0;i<count;i++){
    globalThis.fireworks.push(createFireworkParticle(a, center, hueBase));
  }
}

export function advanceFireworkParticle(p){
  p.x += p.vx;
  p.y += p.vy;
  p.vx *= 0.98;
  p.vy = p.vy*0.98 + 0.03;
  p.life--;
}

export function getFireworkParticleStyle(p, a){
  let strokeHue = p.hue;
  let sat = 100;
  let bri = 80;
  let alpha = globalThis.map(p.life,0,40,0,0.9);

  const cm = globalThis.ui.colorMode.value();
  if(cm === 'mono'){
    strokeHue = 210;
    sat = 10;
    bri = 95;
  } else if(cm === 'bass'){
    strokeHue = (globalThis.centroidHue + (180 - a.bass*120)*0.5) % 360;
  } else if(cm === 'treble'){
    strokeHue = (globalThis.centroidHue + a.tre*180) % 360;
  } else if(cm === 'centroid'){
    strokeHue = globalThis.centroidHue % 360;
  }

  return { strokeHue, sat, bri, alpha };
}

export function drawFireworkParticle(p, style){
  globalThis.g.noStroke();
  globalThis.g.fill(style.strokeHue, style.sat, style.bri, style.alpha);
  globalThis.g.circle(p.x, p.y, p.size);
}

export function isFireworkParticleAlive(p){
  return !(
    p.life<=0 ||
    p.x < -100 || p.x > appState.gW+100 ||
    p.y < -100 || p.y > appState.gH+100
  );
}

export function stepFireworkParticle(p,a){
  advanceFireworkParticle(p);
  globalThis.g.colorMode(globalThis.HSB,360,100,100,1);
  drawFireworkParticle(p, getFireworkParticleStyle(p, a));
  return isFireworkParticleAlive(p);
}

export function spawnFireworkBeatBurst(a){
  spawnFireworkBurst(a);
  spawnFireworkBurst(a);
}

export function getFireworkRandomBurstChance(a, vol){
  return 0.02 + a.level*0.03 + globalThis.constrain(vol,0,1)*0.03;
}

export function maybeSpawnRandomFireworkBurst(a, vol){
  if(globalThis.random() < getFireworkRandomBurstChance(a, vol)){
    spawnFireworkBurst(a);
  }
}

export function updateFireworkParticles(a){
  for(let i=globalThis.fireworks.length-1;i>=0;i--){
    if(!stepFireworkParticle(globalThis.fireworks[i], a)){
      globalThis.fireworks.splice(i,1);
    }
  }
}

export function sceneFireworks(a){
  globalThis.applyTrailFade();

  if(globalThis.detectBeat(a.level)){
    spawnFireworkBeatBurst(a);
  }

  const vol = globalThis.amp ? globalThis.amp.getLevel() * (+globalThis.ui.gain.value()) : 0.0;
  maybeSpawnRandomFireworkBurst(a, vol);

  updateFireworkParticles(a);

  globalThis.drawArtworkToScreen();
}

Object.assign(globalThis, {
  getFireworkBurstCenter,
  getFireworkParticleCount,
  createFireworkParticle,
  spawnFireworkBurst,
  advanceFireworkParticle,
  getFireworkParticleStyle,
  drawFireworkParticle,
  isFireworkParticleAlive,
  stepFireworkParticle,
  spawnFireworkBeatBurst,
  getFireworkRandomBurstChance,
  maybeSpawnRandomFireworkBurst,
  updateFireworkParticles,
  sceneFireworks,
});
