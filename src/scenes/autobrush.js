import { appState } from '../state/store.js';
import { snapMidi } from '../audio/pitch.js';

// --------------------------------------------------
// AUTO BRUSH（既存）
// --------------------------------------------------
export function getAutoBrushPitchAngle(a){
  const pmode = globalThis.ui.pitchMode.value();
  const midiNow = a.smoothMidi ?? a.midi;
  if(midiNow && pmode!=='off'){
    const snapped = snapMidi(midiNow, pmode, globalThis.ui.key.value());
    const pc = ((Math.round(snapped)%12)+12)%12;
    return globalThis.map(pc, 0, 12, 0, globalThis.TAU);
  }
  return globalThis.random(globalThis.TAU);
}

export function getAutoBrushSpawnState(a){
  const mode = globalThis.ui.spawnMode.value();
  let ang = getAutoBrushPitchAngle(a);
  let cx, cy;

  if(mode === 'structured'){
    const r0 = globalThis.random(
      Math.min(appState.gW,appState.gH)*0.05,
      Math.min(appState.gW,appState.gH)*0.22 * (1 + a.bass*0.3)
    );
    cx = appState.gW/2 + r0 * globalThis.cos(ang);
    cy = appState.gH/2 + r0 * globalThis.sin(ang);
  }else{
    ang += globalThis.random(-globalThis.PI/3, globalThis.PI/3);
    cx = globalThis.random(appState.gW);
    cy = globalThis.random(appState.gH);
  }

  return { ang, cx, cy };
}

export function createAutoBrushStroke(a, spawnState){
  const scale = globalThis.getRenderScale?.() || 1;
  const hue = globalThis.deriveHueFromAudio(a);
  const len = globalThis.int(globalThis.random(160, 520) * (1 + a.level*1.2) * scale);
  const w0 = (1.2 + a.bass*8) * scale;
  const jitter = (0.6 + a.tre*1.6) * scale;

  return {
    x:spawnState.cx,
    y:spawnState.cy,
    ang:spawnState.ang,
    hue,
    len,
    i:0,
    w0,
    jitter,
    life: len,
    path:[]
  };
}

export function spawnStroke(a){
  const spawnState = getAutoBrushSpawnState(a);
  globalThis.strokes.push(createAutoBrushStroke(a, spawnState));
}

export function getAutoBrushTurn(st, a){
  const mode = globalThis.ui.spawnMode.value();
  const n = globalThis.noise(st.x*0.002, st.y*0.002, globalThis.frameCount*0.002);
  let turn = globalThis.map(n,0,1,-0.9,0.9) + (a.mid-0.3)*0.6;

  if(a.smoothMidi||a.midi){
    const pmode = globalThis.ui.pitchMode.value();
    const snapped = snapMidi(a.smoothMidi ?? a.midi, pmode, globalThis.ui.key.value());
    const pcAng = globalThis.map(((Math.round(snapped)%12)+12)%12, 0, 12, 0, globalThis.TAU);
    const diff = globalThis.angleDiff(st.ang, pcAng);
    turn += diff * (mode === 'structured' ? 0.12 : 0.03);
  }

  if(mode === 'randomized'){
    turn += globalThis.random(-0.15, 0.15);
  }

  return turn;
}

export function advanceAutoBrushStroke(st, a){
  const scale = globalThis.getRenderScale?.() || 1;
  const vol = globalThis.amp ? globalThis.amp.getLevel() * (+globalThis.ui.gain.value()) : 0.0;
  const sp = (1.6 + (a.level*3.0) + vol*8.0) * scale;
  const dx = globalThis.cos(st.ang)*sp;
  const dy = globalThis.sin(st.ang)*sp;

  st.x += dx + globalThis.randomGaussian()*st.jitter*0.15;
  st.y += dy + globalThis.randomGaussian()*st.jitter*0.15;
  st.i++;
  st.life--;

  return vol;
}

export function getAutoBrushStrokeWeight(st, vol){
  return Math.max(
    0.6,
    st.w0 * (1 - st.i/st.len) + globalThis.sin(globalThis.frameCount*0.03)*0.4 + vol*6.0
  );
}

export function getAutoBrushStrokeStyle(st, a){
  let strokeHue = st.hue;
  if(!isFinite(strokeHue)){
    strokeHue = (globalThis.centroidHue + globalThis.random(-18,18) + 360) % 360;
  }

  let sat = 100;
  let bri = 60;
  let alpha = 0.92;

  const cm = globalThis.ui.colorMode.value();
  if(cm === 'mono'){
    strokeHue = 210;
    sat = 20;
    bri = 95;
    alpha = 0.9;
  } else if (cm === 'bass'){
    strokeHue = (globalThis.centroidHue + (180 - a.bass*120)*0.5) % 360;
    sat = 100;
    bri = 60;
  } else if (cm === 'treble'){
    strokeHue = (globalThis.centroidHue + a.tre*180) % 360;
    sat = 100;
    bri = 65;
  } else if (cm === 'centroid'){
    strokeHue = globalThis.centroidHue % 360;
    sat = 100;
    bri = 60;
  }

  return { strokeHue, sat, bri, alpha };
}

export function drawAutoBrushStrokeSegment(st){
  if(st.path.length){
    const p = st.path[st.path.length-1];
    globalThis.g.line(p.x, p.y, st.x, st.y);
  }
  st.path.push({x:st.x, y:st.y});
}

export function drawAutoBrushSpeckles(st){
  if(globalThis.random()<0.2){
    globalThis.g.stroke(0,0,100,0.16);
    globalThis.g.strokeWeight(1);
    globalThis.g.point(st.x + globalThis.random(-2,2), st.y + globalThis.random(-2,2));
  }
}

export function isAutoBrushStrokeAlive(st){
  return !(
    st.life<=0 ||
    st.x<-60||st.x>appState.gW+60||
    st.y<-60||st.y>appState.gH+60
  );
}

export function getAutoBrushBurstCount(a){
  return 2 + globalThis.int(a.level*6);
}

export function getAutoBrushSpawnChance(a, vol){
  return 0.02 + a.level*0.04 + globalThis.constrain(vol,0,1)*0.05;
}

export function spawnAutoBrushBurst(a){
  const cnt = getAutoBrushBurstCount(a);
  for(let k=0;k<cnt;k++) spawnStroke(a);
}

export function maybeSpawnAutoBrushStroke(a, vol){
  if(globalThis.random() < getAutoBrushSpawnChance(a, vol)){
    spawnStroke(a);
  }
}

export function updateAutoBrushStrokes(a){
  for(let i=globalThis.strokes.length-1;i>=0;i--){
    if(!stepStroke(globalThis.strokes[i], a)){
      globalThis.strokes.splice(i,1);
    }
  }
}

export function stepStroke(st, a){
  const turn = getAutoBrushTurn(st, a);
  st.ang += turn*0.15;
  const vol = advanceAutoBrushStroke(st, a);
  const w = getAutoBrushStrokeWeight(st, vol);

  globalThis.g.colorMode(globalThis.HSB, 360, 100, 100, 1);
  const { strokeHue, sat, bri, alpha } = getAutoBrushStrokeStyle(st, a);

  globalThis.g.stroke(strokeHue, sat, bri, alpha);
  globalThis.g.strokeWeight(w);
  globalThis.g.noFill();

  drawAutoBrushStrokeSegment(st);
  drawAutoBrushSpeckles(st);

  return isAutoBrushStrokeAlive(st);
}

export function sceneAutoBrush(a){
  globalThis.applyTrailFade();

  if(globalThis.detectBeat(a.level)){
    spawnAutoBrushBurst(a);
  }

  const vol = globalThis.amp ? globalThis.amp.getLevel() * (+globalThis.ui.gain.value()) : 0.0;
  maybeSpawnAutoBrushStroke(a, vol);

  updateAutoBrushStrokes(a);

  globalThis.drawArtworkToScreen();
}

Object.assign(globalThis, {
  getAutoBrushPitchAngle,
  getAutoBrushSpawnState,
  createAutoBrushStroke,
  spawnStroke,
  getAutoBrushTurn,
  advanceAutoBrushStroke,
  getAutoBrushStrokeWeight,
  getAutoBrushStrokeStyle,
  drawAutoBrushStrokeSegment,
  drawAutoBrushSpeckles,
  isAutoBrushStrokeAlive,
  getAutoBrushBurstCount,
  getAutoBrushSpawnChance,
  spawnAutoBrushBurst,
  maybeSpawnAutoBrushStroke,
  updateAutoBrushStrokes,
  stepStroke,
  sceneAutoBrush,
});
