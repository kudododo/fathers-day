import { appState } from '../state/store.js';

//ink
export function getInkSpawnPosition(a){
  const mode = globalThis.ui.spawnMode.value();
  let x, y;
  if(mode === 'structured'){
    const r = globalThis.random(globalThis.min(appState.gW,appState.gH)*0.05, globalThis.min(appState.gW,appState.gH)*0.22 * (1 + a.bass*0.3));
    const th = globalThis.random(globalThis.TAU);
    x = appState.gW/2 + r*globalThis.cos(th);
    y = appState.gH/2 + r*globalThis.sin(th);
  }else{
    x = globalThis.random(appState.gW);
    y = globalThis.random(appState.gH);
  }
  return { x, y };
}

export function createInkBlob(a, spawnPosition){
  const scale = globalThis.getRenderScale?.() || 1;
  return {
    x: spawnPosition.x,
    y: spawnPosition.y,
    r: (6 + globalThis.random(10) + a.level*25) * scale,
    grow: 0.93 + globalThis.random(0.04) + a.level*0.05,
    alpha: 0.08 + globalThis.random(0.08)
  };
}

export function spawnInk(a){
  const spawnPosition = getInkSpawnPosition(a);
  globalThis.inkBlobs.push(createInkBlob(a, spawnPosition));
}

// 角度用の線形補間（色相のにじみを滑らかに）
export function lerpAngleDeg(a, b, t){
  let d = ((b - a + 540) % 360) - 180; // [-180,180)
  return (a + d * t + 360) % 360;
}

let inkTone = { h: 0 }; // 墨の色相の内部状態（スムージング用）

// 音に応じた色トーン（音高→色相、音量→彩度/明度）
export function updateInkTone(a){
  const targetHue = globalThis.deriveHueFromAudio(a); // ★他シーンと同じ色相ロジックを再利用
  inkTone.h = lerpAngleDeg(inkTone.h, targetHue, 0.18); // 0.08〜0.18で調整可

  const s = 0.60 + a.level * 0.30;         // 音量で彩度アップ
  const b = 0.90 + a.tre * 0.08;           // 高域で少し明るく
  return { h: inkTone.h, s, b };
}

// 音に応じたサイズ倍率（音量＋低域で膨らむ／高域で微揺れ）
export function audioSizeMul(a){
  let m = 0.70 + a.level * 0.90 + a.bass * 0.80; // 低域で太る
  m *= 1 + (a.tre - 0.5) * 0.15;                 // 高域で微振れ
  if (globalThis.detectBeat(a.level)) m *= 1.12;            // ビートで軽くブースト
  return m;
}

export function advanceInkBlob(b){
  b.r     *= b.grow;
  b.alpha *= 0.985;
}

export function getInkDrawState(b, a, tone){
  const maxR = 0.2 * globalThis.min(appState.gW, appState.gH);
  const nx  = globalThis.noise(b.x * 0.004, b.y * 0.004, globalThis.frameCount * 0.01);
  const hue = (tone.h + nx * 18) % 360;          // 18度だけ自然に揺らす
  const sat = tone.s;
  const bri = tone.b;
  const alpha = 0.25 + a.level * 0.25;
  const col = globalThis.hsb(hue, sat, bri, globalThis.min(alpha, b.alpha));
  const drawR = Math.min(b.r * audioSizeMul(a), maxR);
  return { col, drawR };
}

export function drawInkBlob(b, drawState){
  globalThis.g.drawingContext.globalCompositeOperation = 'lighter';
  globalThis.g.noStroke();
  globalThis.g.fill(drawState.col);
  globalThis.g.circle(b.x, b.y, drawState.drawR);
  globalThis.g.drawingContext.globalCompositeOperation = 'source-over';
}

export function isInkBlobAlive(b){
  return b.alpha > 0.01 && b.r < globalThis.max(appState.gW, appState.gH) * 1.4;
}

export function getInkSpawnCount(){
  return 1 + globalThis.int(globalThis.random(3));
}

export function maybeSpawnInkBlobs(a){
  if (globalThis.detectBeat(a.level) || globalThis.random() < 0.04 + a.level * 0.08){
    const n = getInkSpawnCount();
    for (let i = 0; i < n; i++) spawnInk(a);
  }
}

export function updateInkBlobs(a, tone){
  for (let i = globalThis.inkBlobs.length - 1; i >= 0; i--){
    if (!stepInk(globalThis.inkBlobs[i], a, tone)) globalThis.inkBlobs.splice(i, 1);
  }
}

export function stepInk(b, a, tone){ // ← tone を受け取る
  advanceInkBlob(b);
  drawInkBlob(b, getInkDrawState(b, a, tone));
  return isInkBlobAlive(b);
}

export function sceneInk(a, options){
  const { applyTrail, renderToScreen } = globalThis.resolveSceneRenderOptions(options);
  if(applyTrail) globalThis.applyTrailFade();

  const tone = updateInkTone(a);
  maybeSpawnInkBlobs(a);
  updateInkBlobs(a, tone);
  if(renderToScreen) globalThis.drawArtworkToScreen();
}

Object.assign(globalThis, {
  getInkSpawnPosition,
  createInkBlob,
  spawnInk,
  lerpAngleDeg,
  updateInkTone,
  audioSizeMul,
  advanceInkBlob,
  getInkDrawState,
  drawInkBlob,
  isInkBlobAlive,
  getInkSpawnCount,
  maybeSpawnInkBlobs,
  updateInkBlobs,
  stepInk,
  sceneInk,
});
