import { appState } from '../state/store.js';
import { snapMidi } from '../audio/pitch.js';

// --------------------------------------------------
// FLOWER シーン（花が咲く）
// --------------------------------------------------
export function getFlowerSpawnPosition(a){
  const mode = globalThis.ui.spawnMode.value();
  let fx, fy;

  if(mode === 'structured' && (a.smoothMidi || a.midi)){
    const pmode = globalThis.ui.pitchMode.value();
    const snapped = snapMidi(a.smoothMidi ?? a.midi, pmode, globalThis.ui.key.value());
    const pc = ((Math.round(snapped)%12)+12)%12;
    const ang = globalThis.map(pc, 0, 12, 0, globalThis.TAU);

    const r0 = globalThis.random(
      Math.min(appState.gW,appState.gH)*0.05,
      Math.min(appState.gW,appState.gH)*0.3 * (1 + a.mid*0.4)
    );
    fx = appState.gW/2 + r0 * globalThis.cos(ang);
    fy = appState.gH/2 + r0 * globalThis.sin(ang);
  }else{
    fx = globalThis.random(appState.gW);
    fy = globalThis.random(appState.gH);
  }

  return { fx, fy };
}

export function createFlower(a, spawnPosition){
  const scale = globalThis.getRenderScale?.() || 1;
  const hueBase = globalThis.deriveHueFromAudio(a);
  const petalsCount = globalThis.int(globalThis.random(5,10));
  const baseSize = (6 + a.level*30 + a.bass*15) * 0.5 * scale;

  return {
    x:spawnPosition.fx,
    y:spawnPosition.fy,
    hue:hueBase,
    petals:petalsCount,
    size:baseSize,
    sizeGrow: (0.4+ a.tre*1.2) * scale,
    rot:globalThis.random(globalThis.TWO_PI),
    life:globalThis.int(30 + a.tre*20 + a.mid*10),
  };
}

export function spawnFlower(a){
  const spawnPosition = getFlowerSpawnPosition(a);
  globalThis.flowers.push(createFlower(a, spawnPosition));
}

export function getFlowerStyle(f, a){
  const alpha = globalThis.map(f.life,0,80,0,0.8);
  let petalHue = f.hue;
  let sat = 90;
  let bri = 90;

  const cm = globalThis.ui.colorMode.value();
  if(cm==='mono'){
    petalHue=210; sat=20; bri=95;
  }else if(cm==='bass'){
    petalHue=(globalThis.centroidHue + (180 - a.bass*120)*0.5)%360;
  }else if(cm==='treble'){
    petalHue=(globalThis.centroidHue + a.tre*180)%360;
  }else if(cm==='centroid'){
    petalHue=globalThis.centroidHue%360;
  }

  return { petalHue, sat, bri, alpha };
}

export function drawFlowerPetals(f, style){
  for(let i=0;i<f.petals;i++){
    const ang = (globalThis.TWO_PI * i)/f.petals;
    globalThis.g.push();
    globalThis.g.rotate(ang);
    globalThis.g.noStroke();
    globalThis.g.fill(style.petalHue, style.sat, style.bri, style.alpha);
    globalThis.g.ellipse(0, -f.size*0.4, f.size*0.6, f.size);
    globalThis.g.pop();
  }
}

export function drawFlowerCenter(f, style){
  globalThis.g.noStroke();
  globalThis.g.fill(style.petalHue, style.sat*0.4, style.bri*0.6, style.alpha);
  globalThis.g.circle(0,0, f.size*0.4);
}

export function drawFlowerShape(f, style){
  globalThis.g.push();
  globalThis.g.translate(f.x, f.y);
  globalThis.g.rotate(f.rot);
  drawFlowerPetals(f, style);
  drawFlowerCenter(f, style);
  globalThis.g.pop();
}

export function advanceFlowerState(f, a){
  f.size += f.sizeGrow;

  const maxSize = Math.min(appState.gW, appState.gH) * 0.06;
  if (f.size > maxSize) f.size = maxSize;

  f.rot += 0.01 + a.tre*0.02;
  f.life--;
}

export function isFlowerAlive(f){
  return !(
    f.life<=0 ||
    f.x<-200||f.x>appState.gW+200||
    f.y<-200||f.y>appState.gH+200
  );
}

export function getFlowerBeatSpawnCount(a){
  return 1 + globalThis.int(a.level*4);
}

export function spawnFlowerBeatBurst(a){
  const cnt = getFlowerBeatSpawnCount(a);
  for(let k=0;k<cnt;k++){
    spawnFlower(a);
  }
}

export function getFlowerRandomSpawnChance(a, vol){
  return 0.015 + a.level*0.03 + globalThis.constrain(vol,0,1)*0.03;
}

export function maybeSpawnRandomFlower(a, vol){
  if(globalThis.random() < getFlowerRandomSpawnChance(a, vol)){
    spawnFlower(a);
  }
}

export function updateFlowers(a){
  for(let i=globalThis.flowers.length-1;i>=0;i--){
    if(!stepFlower(globalThis.flowers[i], a)){
      globalThis.flowers.splice(i,1);
    }
  }
}

export function stepFlower(f,a){
  globalThis.g.colorMode(globalThis.HSB,360,100,100,1);
  const style = getFlowerStyle(f, a);
  drawFlowerShape(f, style);
  advanceFlowerState(f, a);
  return isFlowerAlive(f);
}

export function sceneFlower(a){
  globalThis.applyTrailFade();

  if(globalThis.detectBeat(a.level)){
    spawnFlowerBeatBurst(a);
  }

  const vol = globalThis.amp ? globalThis.amp.getLevel() * (+globalThis.ui.gain.value()) : 0.0;
  maybeSpawnRandomFlower(a, vol);

  updateFlowers(a);

  globalThis.drawArtworkToScreen();
}

Object.assign(globalThis, {
  getFlowerSpawnPosition,
  createFlower,
  spawnFlower,
  getFlowerStyle,
  drawFlowerPetals,
  drawFlowerCenter,
  drawFlowerShape,
  advanceFlowerState,
  isFlowerAlive,
  getFlowerBeatSpawnCount,
  spawnFlowerBeatBurst,
  getFlowerRandomSpawnChance,
  maybeSpawnRandomFlower,
  updateFlowers,
  stepFlower,
  sceneFlower,
});
