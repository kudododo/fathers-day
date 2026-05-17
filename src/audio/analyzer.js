import { estimatePitch, noteNames } from './pitch.js';

export function detectBeat(level){
  globalThis.beat.buf.push(level);
  if(globalThis.beat.buf.length>globalThis.beat.size) globalThis.beat.buf.shift();
  const avg = globalThis.beat.buf.reduce((a,b)=>a+b,0)/globalThis.beat.buf.length;
  const on = (level > avg*globalThis.beat.th) && globalThis.beat.cd<=0;
  globalThis.beat.cd = on?10:Math.max(0, globalThis.beat.cd-1);
  return on;
}

// ===== analysis =====
export function analyze(){
  globalThis.fft.smooth(globalThis.float(globalThis.ui.smooth.value()));
  if(globalThis.fft.bins !== globalThis.int(globalThis.ui.fft.value())){
    // fft = new p5.FFT(float(ui.smooth.value()), int(ui.fft.value()));
    // fft.setInput(mic);
    globalThis.fft = new globalThis.p5.FFT(globalThis.float(globalThis.ui.smooth.value()), globalThis.int(globalThis.ui.fft.value()));
    globalThis.fft.setInput(globalThis.getCurrentAudioInput());
  }

  const spectrum = globalThis.fft.analyze();
  const waveform = globalThis.fft.waveform();

  // band energies
  let bass=0, mid=0, tre=0;
  const N = spectrum.length;
  for(let i=0;i<N;i++){
    const hz = i * (globalThis.sampleRate()/2) / N;
    const v = spectrum[i]/255;
    if(hz<160) bass+=v;
    else if(hz<2000) mid+=v;
    else tre+=v;
  }
  bass/=N*0.12;
  mid /=N*0.6;
  tre /=N*0.28;

  const level = globalThis.constrain(bass*1.4 + mid*0.9 + tre*0.5, 0, 1);

  // centroid hue fallback
  let num=0, den=0;
  for(let i=0;i<N;i++){ num += spectrum[i]*i; den += spectrum[i]; }
  const cIdx = den>0 ? num/den : 0;
  globalThis.centroidHue = globalThis.map(cIdx, 0, N, 0, 360);

  // pitch detection
  const pitchHz = estimatePitch(waveform, globalThis.sampleRate());
  if(pitchHz){
    globalThis.lastPitchHz = pitchHz;
    const midi = 69 + 12 * Math.log2(pitchHz/440);
    globalThis.smoothMidi = globalThis.smoothMidi==null ? midi : globalThis.lerp(globalThis.smoothMidi, midi, 0.25);
    globalThis.lastMidi = midi;

    const m = Math.round(globalThis.smoothMidi);
    const note = noteNames[(m%12+12)%12];
    const oct = Math.floor(m/12)-1;
    const cents = Math.round((globalThis.smoothMidi - m)*100);
    globalThis.ui.noteReadout.html(`♪ ${note}${oct} ${(cents>0?'+':'')}${cents}¢ / ${globalThis.nf(pitchHz,3,1)} Hz`);
  } else {
    globalThis.ui.noteReadout.html('♪ --');
  }

  return {
    bass, mid, tre,
    level,
    pitchHz:globalThis.lastPitchHz,
    midi:globalThis.lastMidi,
    smoothMidi:globalThis.smoothMidi
  };
}

Object.assign(globalThis, {
  detectBeat,
  analyze,
});
