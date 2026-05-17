import { appState } from '../state/store.js';

// ===== audio =====
// async function startMic(){
//   try{
//     userStartAudio();
//     if(!mic){ mic = new p5.AudioIn(); }
//     await mic.start();
//     amp = new p5.Amplitude();
//     amp.setInput(mic);

//     if(!fft){
//       fft = new p5.FFT(+ui.smooth.value(), int(+ui.fft.value()));
//     }
//     fft.setInput(mic);

//     appState.micOn = true;
//     ui.stat.html('稼働中');
//     ui.toggle.html('🛑 Stop');
//     ui.hint.addClass('hidden');
//   }catch(e){
//     ui.stat.html('エラー: '+e.message);
//     console.error(e);
//   }
// }
export function getCurrentAudioInput(){
  return globalThis.audioSource || globalThis.mic;
}

export function ensureMicInput(){
  if(!globalThis.mic){
    globalThis.mic = new globalThis.p5.AudioIn();
  }
  return globalThis.mic;
}

export function ensureMicGainNode(){
  if(!globalThis.micGainNode){
    globalThis.micGainNode = new globalThis.p5.Gain();
  }
  return globalThis.micGainNode;
}

export function applyMicGainValue(){
  if(globalThis.micGainNode){
    globalThis.micGainNode.amp(globalThis.float(globalThis.ui.micGain.value()), 0.02);
  }
}

export function wireMicToAnalysisInput(input){
  const gainNode = ensureMicGainNode();
  input.disconnect();
  input.connect(gainNode);
  applyMicGainValue();
  globalThis.audioSource = gainNode;
  return globalThis.audioSource;
}

export function ensureAmplitudeAnalyzer(input){
  globalThis.amp = new globalThis.p5.Amplitude();
  globalThis.amp.setInput(input);
  return globalThis.amp;
}

export function ensureFFTAnalyzer(input){
  if(!globalThis.fft){
    globalThis.fft = new globalThis.p5.FFT(+globalThis.ui.smooth.value(), globalThis.int(+globalThis.ui.fft.value()));
  }
  globalThis.fft.setInput(input);
  return globalThis.fft;
}

export function updateMicStartedUI(){
  appState.micOn = true;
  globalThis.ui.stat.html('稼働中');
  globalThis.ui.toggle.html('🛑 Stop');
  globalThis.ui.hint.addClass('hidden');
}

export function updateMicStoppedUI(){
  appState.micOn = false;
  globalThis.ui.stat.html('停止');
  globalThis.ui.toggle.html('🎤 Start');
}

export async function startMic(){
  try{
    globalThis.userStartAudio();
    const input = ensureMicInput();
    await input.start();

    const analysisInput = wireMicToAnalysisInput(input);
    ensureAmplitudeAnalyzer(analysisInput);
    ensureFFTAnalyzer(analysisInput);

    updateMicStartedUI();
  }catch(e){
    globalThis.ui.stat.html('エラー: '+e.message);
    console.error(e);
  }
}

export function stopMic(){
  if(globalThis.mic){
    globalThis.mic.stop();
  }
  updateMicStoppedUI();
}

Object.assign(globalThis, {
  getCurrentAudioInput,
  ensureMicInput,
  ensureMicGainNode,
  applyMicGainValue,
  wireMicToAnalysisInput,
  ensureAmplitudeAnalyzer,
  ensureFFTAnalyzer,
  updateMicStartedUI,
  updateMicStoppedUI,
  startMic,
  stopMic,
});
