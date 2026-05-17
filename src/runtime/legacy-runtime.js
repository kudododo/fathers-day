// ===== global state =====
let mic, fft, amp;

let micGainNode = null;   // p5.Gain
let audioSource = null; 


// 各シーンごとのオブジェクト
let strokes = [];        // 自動筆
let fireworks = [];      // 花火パーティクル
let flowers = [];        // 花オブジェクト
let wavePhase = 0;
const particlesFlow = [];
const auroraBands = [];
const galaxyStars = [];
const rainDrops = [];
const inkBlobs = [];
const butterflies = [];

let centroidHue = 200;

let ui = {};
let g;

let lastPitchHz = null, lastMidi = null, smoothMidi = null;

Object.defineProperty(globalThis, 'fft', {
  configurable: true,
  enumerable: true,
  get(){
    return fft;
  },
  set(value){
    fft = value;
  }
});

Object.defineProperty(globalThis, 'mic', {
  configurable: true,
  enumerable: true,
  get(){
    return mic;
  },
  set(value){
    mic = value;
  }
});

Object.defineProperty(globalThis, 'amp', {
  configurable: true,
  enumerable: true,
  get(){
    return amp;
  },
  set(value){
    amp = value;
  }
});

Object.defineProperty(globalThis, 'micGainNode', {
  configurable: true,
  enumerable: true,
  get(){
    return micGainNode;
  },
  set(value){
    micGainNode = value;
  }
});

Object.defineProperty(globalThis, 'audioSource', {
  configurable: true,
  enumerable: true,
  get(){
    return audioSource;
  },
  set(value){
    audioSource = value;
  }
});

Object.defineProperty(globalThis, 'strokes', {
  configurable: true,
  enumerable: true,
  get(){
    return strokes;
  },
  set(value){
    strokes = value;
  }
});

Object.defineProperty(globalThis, 'fireworks', {
  configurable: true,
  enumerable: true,
  get(){
    return fireworks;
  },
  set(value){
    fireworks = value;
  }
});

Object.defineProperty(globalThis, 'flowers', {
  configurable: true,
  enumerable: true,
  get(){
    return flowers;
  },
  set(value){
    flowers = value;
  }
});

Object.defineProperty(globalThis, 'particlesFlow', {
  configurable: true,
  enumerable: true,
  get(){
    return particlesFlow;
  },
  set(value){
    particlesFlow.length = 0;
    if(Array.isArray(value)) particlesFlow.push(...value);
  }
});

Object.defineProperty(globalThis, 'inkBlobs', {
  configurable: true,
  enumerable: true,
  get(){
    return inkBlobs;
  },
  set(value){
    inkBlobs.length = 0;
    if(Array.isArray(value)) inkBlobs.push(...value);
  }
});

Object.defineProperty(globalThis, 'auroraBands', {
  configurable: true,
  enumerable: true,
  get(){
    return auroraBands;
  },
  set(value){
    auroraBands.length = 0;
    if(Array.isArray(value)) auroraBands.push(...value);
  }
});

Object.defineProperty(globalThis, 'galaxyStars', {
  configurable: true,
  enumerable: true,
  get(){
    return galaxyStars;
  },
  set(value){
    galaxyStars.length = 0;
    if(Array.isArray(value)) galaxyStars.push(...value);
  }
});

Object.defineProperty(globalThis, 'rainDrops', {
  configurable: true,
  enumerable: true,
  get(){
    return rainDrops;
  },
  set(value){
    rainDrops.length = 0;
    if(Array.isArray(value)) rainDrops.push(...value);
  }
});

Object.defineProperty(globalThis, 'butterflies', {
  configurable: true,
  enumerable: true,
  get(){
    return butterflies;
  },
  set(value){
    butterflies.length = 0;
    if(Array.isArray(value)) butterflies.push(...value);
  }
});

Object.defineProperty(globalThis, 'centroidHue', {
  configurable: true,
  enumerable: true,
  get(){
    return centroidHue;
  },
  set(value){
    centroidHue = value;
  }
});

Object.defineProperty(globalThis, 'lastPitchHz', {
  configurable: true,
  enumerable: true,
  get(){
    return lastPitchHz;
  },
  set(value){
    lastPitchHz = value;
  }
});

Object.defineProperty(globalThis, 'lastMidi', {
  configurable: true,
  enumerable: true,
  get(){
    return lastMidi;
  },
  set(value){
    lastMidi = value;
  }
});

Object.defineProperty(globalThis, 'smoothMidi', {
  configurable: true,
  enumerable: true,
  get(){
    return smoothMidi;
  },
  set(value){
    smoothMidi = value;
  }
});

Object.defineProperty(globalThis, 'ui', {
  configurable: true,
  enumerable: true,
  get(){
    return ui;
  },
  set(value){
    ui = value;
  }
});

Object.defineProperty(globalThis, 'g', {
  configurable: true,
  enumerable: true,
  get(){
    return g;
  },
  set(value){
    g = value;
  }
});

// beat detection buffer
const beat = { buf: [], size: 43, th: 1.35, cd: 0 };
globalThis.beat = beat;

// 波（wave）
function sceneWave(a, options){
  const { applyTrail, renderToScreen } = resolveSceneRenderOptions(options);
  if(applyTrail) applyTrailFade();

  wavePhase += 0.02 + a.level*0.06;
  const rows = 4;
  const spec = fft ? fft.analyze(256) : null;

  // withDraw((dg)=>{
  //   const D = dg || this;
  //   const W = width, H = height;
  //   noFill(); strokeWeight(2);
  const W = gW, H = gH;
  g.noFill(); g.strokeWeight(2);

    for(let r=0;r<rows;r++){
      const t = wavePhase + r*0.7;
      const hue = (r*60 + frameCount*0.5) % 360;
      // stroke(hsb(hue, 0.6, 1, 0.8));
      g.stroke(hsb(hue, 0.6, 1, 0.8));
      // beginShape();
      g.beginShape();
      // for(let x=0; x<=W; x+=8){
      for(let x=0; x<=W; x+=8){
        const nx = x/W;
        const base = sin(nx*TAU*1.5 + t)*0.15;
        const fftAmp = spec ? (spec[int(nx*(spec.length-1))]/255)*0.5 : 0;
        const y = H*(0.25 + r*0.18) + H*(base + fftAmp* a.level*0.8)*0.25;
        // vertex(x, y);
        g.vertex(x, y);
      }
      // endShape();
      g.endShape();
    }
  // });

  if(renderToScreen) drawArtworkToScreen();
}


//オーロラ（aurora）
function ensureAuroraBands(){
  if (auroraBands.length===0){
    for(let i=0;i<3;i++){
      auroraBands.push({
        // y: height*(0.2 + i*0.25),
        y: gH*(0.2 + i*0.25),
        amp: 30 + i*15,
        hue: random(360)
      });
    }
  }
}
function sceneAurora(a, options){
  const { applyTrail, renderToScreen } = resolveSceneRenderOptions(options);
  if(applyTrail) applyTrailFade();
  ensureAuroraBands();

  const steps = 160;
  g.noStroke()
    for(const band of auroraBands){
      band.hue = (band.hue + 0.3 + a.level*3) % 360;
      // for(let x=0;x<width;x+=width/steps){
      //   const nx = x/width;
      for(let x=0;x<gW;x+=gW/steps){
        const nx = x/gW;
        const yOff = (noise(nx*2, frameCount*0.01)+sin(frameCount*0.02+nx*TAU))*0.5;
        const y = band.y + yOff * (band.amp + a.level*120);
        const c = hsb(band.hue, 0.6, 0.9, 0.06 + a.level*0.05);
        g.fill(c);
        g.rect(x, y-30, gW/steps+2, 60);
      }
    }
  // });

  if(renderToScreen) drawArtworkToScreen();
}


//銀河（galaxy）
function spawnStar(){
  const r = random(min(gW,gH)*0.45);
  const th = random(TAU);
  galaxyStars.push({
    r, th, vr: (random()-0.5)*0.02, vth: 0.002 + random(0.01),
    hue: random(200,300), alpha: random(0.4,0.9)
  });
}
function stepStar(s,a){
  s.th += s.vth * (0.5 + a.level*3);
  s.r += s.vr * (0.5 + a.level*1.2);
  const cx = gW*0.5, cy = gH*0.5;
  const x = cx + cos(s.th)*s.r;
  const y = cy + sin(s.th)*s.r;
  g.noStroke(); g.fill(hsb(s.hue,0.6,1, s.alpha));
  g.circle(x,y, 2 + a.level*3);
  return s.r>5 && s.r < max(gW,gH);
}
function sceneGalaxy(a, options){
  const { applyTrail, renderToScreen } = resolveSceneRenderOptions(options);
  if(applyTrail) applyTrailFade();
  if (galaxyStars.length < 800){
    for(let i=0;i<20;i++) spawnStar();
  }
  for(let i=galaxyStars.length-1;i>=0;i--){
    if(!stepStar(galaxyStars[i],a)) galaxyStars.splice(i,1);
  }
  if(renderToScreen) drawArtworkToScreen();
}

//光の雨（rain）
function spawnDrop(intensity){
  rainDrops.push({
    x: random(gW),
    y: -20,
    vy: 4 + intensity*20 + random(3),
    life: 240,
    hue: random([190,210,230,250])
  });
}
// === 改良版 stepDrop ===
function stepDrop(d,a){
  d.y += d.vy;
  d.vy += 0.05 + a.level*0.3;
  d.life--;

  const hue = deriveHueFromAudio(a);
  const w = 1 + a.bass*4;
  const alpha = 0.5 + a.tre*0.4;

  g.stroke(hsb(hue,0.7,1,alpha));
  g.strokeWeight(w);
  g.line(d.x, d.y-12, d.x, d.y+8);

  return d.y < gH+20 && d.life>0;
}
function sceneRain(a, options){
  const { applyTrail, renderToScreen } = resolveSceneRenderOptions(options);
  if(applyTrail) applyTrailFade();
  // 高音域が強いほど降る
  let hi=0;
  if (fft){
    const spec = fft.analyze(64);
    for(let i=int(spec.length*0.6); i<spec.length; i++) hi += spec[i]||0;
    hi = hi / (spec.length*0.4) / 255; // 0-1目安
  }
  const intensity = constrain(hi * (0.4 + a.level*1.2), 0, 2);
  const add = int(5 + intensity*30);
  for(let i=0;i<add;i++) spawnDrop(intensity);

  for(let i=rainDrops.length-1;i>=0;i--){
    if(!stepDrop(rainDrops[i],a)) rainDrops.splice(i,1);
  }
  if(renderToScreen) drawArtworkToScreen();
}




//蝶（butterfly）
function spawnButterfly(a){
  butterflies.push({
    x: random(gW*0.3, gW*0.7),
    y: random(gH*0.3, gH*0.7),
    vx: random(-1,1), vy: random(-1,1),
    ang: random(TAU), vang: random(-0.03,0.03),
    size: 12 + random(20) + a.level*50,
    hue: random(20,70), life: 900
  });
}
function stepButterfly(b,a){
  const flap = sin(frameCount*0.4 + b.ang)* (6 + a.level*20);
  b.vx += (random(-0.5,0.5) + (mouseIsPressed? (mouseX-b.x)*0.0005:0)) * (0.6+a.level);
  b.vy += (random(-0.5,0.5) + (mouseIsPressed? (mouseY-b.y)*0.0005:0)) * (0.6+a.level);
  b.vx = constrain(b.vx,-3,3); b.vy = constrain(b.vy,-3,3);
  b.x += b.vx; b.y += b.vy;
  b.ang += b.vang*(0.6 + a.level);
  b.life--;

  // wrap
  if(b.x< -20) b.x = gW+20; if(b.x>gW+20) b.x = -20;
  if(b.y< -20) b.y = gH+20; if(b.y>gH+20) b.y = -20;

  g.push(); g.translate(b.x,b.y); g.rotate(b.ang);
  g.noStroke(); g.fill(hsb(b.hue,0.7,1,0.9));
  g.ellipse(-b.size*0.6,0, b.size, b.size*0.6+flap);
  g.ellipse( b.size*0.6,0, b.size, b.size*0.6-flap);
  g.fill(0,0,0,160);
  g.rect(-2,-b.size*0.4,4,b.size*0.8, 2);
  g.pop();
  return b.life>0;
}
function sceneButterfly(a, options){
  const { applyTrail, renderToScreen } = resolveSceneRenderOptions(options);
  if(applyTrail) applyTrailFade();
  if (butterflies.length < 50 && (detectBeat(a.level) || random()<0.03+a.level*0.08)){
    const n = 1 + int(random(3));
    for(let i=0;i<n;i++) spawnButterfly(a);
  }
  for(let i=butterflies.length-1;i>=0;i--){
    if(!stepButterfly(butterflies[i],a)) butterflies.splice(i,1);
  }
  if(renderToScreen) drawArtworkToScreen();
}

