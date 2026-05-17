export const MAX_MEDIA_DURATION_SECONDS = 60;
export const SILENT_AUDIO_ERROR = '音声が検出できませんでした。もう一度録音してください。';

const AUDIO_TYPES = new Set([
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/webm',
  'audio/x-m4a',
]);

const VIDEO_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

const RMS_SILENCE_THRESHOLD = 0.009;

function createObjectUrl(blob){
  return URL.createObjectURL(blob);
}

function revokeObjectUrl(url){
  if(url){
    URL.revokeObjectURL(url);
  }
}

function createDetachedMediaElement(kind){
  const element = document.createElement(kind === 'audio' ? 'audio' : 'video');
  element.preload = 'metadata';
  element.muted = true;
  element.playsInline = true;
  element.crossOrigin = 'anonymous';
  element.style.position = 'fixed';
  element.style.left = '-9999px';
  element.style.width = '1px';
  element.style.height = '1px';
  document.body.appendChild(element);
  return element;
}

function destroyDetachedMediaElement(element){
  if(!element) return;
  try{
    element.pause();
  }catch(_err){}
  element.removeAttribute('src');
  element.load();
  element.remove();
}

function waitForEvent(target, eventName){
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      target.removeEventListener(eventName, onLoad);
      target.removeEventListener('error', onError);
    };
    const onLoad = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('media metadata could not be loaded'));
    };
    target.addEventListener(eventName, onLoad, { once: true });
    target.addEventListener('error', onError, { once: true });
  });
}

function measureBufferRms(audioBuffer){
  let energy = 0;
  let samples = 0;
  for(let channelIndex = 0; channelIndex < audioBuffer.numberOfChannels; channelIndex += 1){
    const data = audioBuffer.getChannelData(channelIndex);
    for(let index = 0; index < data.length; index += 1){
      const sample = data[index];
      energy += sample * sample;
      samples += 1;
    }
  }
  if(samples === 0) return 0;
  return Math.sqrt(energy / samples);
}

async function detectSilenceFromDecodedAudio(blob){
  const audioContext = new AudioContext();
  try{
    const arrayBuffer = await blob.arrayBuffer();
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    return measureBufferRms(decoded) < RMS_SILENCE_THRESHOLD;
  }finally{
    await audioContext.close();
  }
}

function getCaptureStream(element){
  if(typeof element.captureStream === 'function') return element.captureStream();
  if(typeof element.mozCaptureStream === 'function') return element.mozCaptureStream();
  return null;
}

function computeRmsFromAnalyser(analyser, buffer){
  analyser.getFloatTimeDomainData(buffer);
  let energy = 0;
  for(let index = 0; index < buffer.length; index += 1){
    const sample = buffer[index];
    energy += sample * sample;
  }
  return Math.sqrt(energy / buffer.length);
}

async function detectSilenceFromElement(blob, inputKind){
  const mediaKind = inputKind === 'audio' ? 'audio' : 'video';
  const element = createDetachedMediaElement(mediaKind);
  const objectUrl = createObjectUrl(blob);
  const audioContext = new AudioContext();
  let stream = null;
  try{
    element.src = objectUrl;
    await waitForEvent(element, 'loadedmetadata');
    stream = getCaptureStream(element);
    if(!stream){
      throw new Error('captureStream is not supported');
    }
    const audioTracks = stream.getAudioTracks();
    if(audioTracks.length === 0){
      return true;
    }
    await audioContext.resume();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    const buffer = new Float32Array(analyser.fftSize);
    const maxPlaybackSeconds = Math.min(Number(element.duration) || 0, 8) || 8;
    const startedAt = performance.now();
    let maxRms = 0;
    try{
      await element.play();
    }catch(_err){}
    while(((performance.now() - startedAt) / 1000) < maxPlaybackSeconds){
      const rms = computeRmsFromAnalyser(analyser, buffer);
      if(rms > maxRms){
        maxRms = rms;
      }
      await new Promise((resolve) => globalThis.setTimeout(resolve, 120));
    }
    return maxRms < RMS_SILENCE_THRESHOLD;
  }finally{
    if(stream){
      stream.getTracks().forEach((track) => track.stop());
    }
    await audioContext.close();
    destroyDetachedMediaElement(element);
    revokeObjectUrl(objectUrl);
  }
}

async function detectSilentAudio(blob, inputKind){
  try{
    return await detectSilenceFromDecodedAudio(blob);
  }catch(_err){
    return detectSilenceFromElement(blob, inputKind);
  }
}

async function readMediaMetadata(blob, inputKind){
  const mediaKind = inputKind === 'audio' ? 'audio' : 'video';
  const element = createDetachedMediaElement(mediaKind);
  const objectUrl = createObjectUrl(blob);
  try{
    element.src = objectUrl;
    await waitForEvent(element, 'loadedmetadata');
    const durationSeconds = Number(element.duration) || 0;
    const width = mediaKind === 'video' ? element.videoWidth || null : null;
    const height = mediaKind === 'video' ? element.videoHeight || null : null;
    return { durationSeconds, width, height };
  }finally{
    destroyDetachedMediaElement(element);
    revokeObjectUrl(objectUrl);
  }
}

export function getAcceptedTypes(mode){
  if(mode === 'upload-audio'){
    return [...AUDIO_TYPES];
  }
  if(mode === 'upload-video'){
    return [...VIDEO_TYPES];
  }
  return [];
}

export function getInputKind(mode){
  return mode === 'upload-audio' ? 'audio' : 'video';
}

export function validateMimeType(mode, type){
  const accepted = getAcceptedTypes(mode);
  return accepted.includes(type);
}

export async function validateSelectedMedia({ blob, mode, sourceLabel }){
  if(!(blob instanceof Blob)){
    throw new Error('media blob is required');
  }

  if(mode !== 'record' && !validateMimeType(mode, blob.type)){
    throw new Error('対応していないファイル形式です。音声または動画ファイルを選択してください。');
  }

  const inputKind = getInputKind(mode);
  const metadata = await readMediaMetadata(blob, inputKind);

  if(!metadata.durationSeconds || Number.isNaN(metadata.durationSeconds)){
    throw new Error('メディアの長さを確認できませんでした。別のファイルでもう一度お試しください。');
  }

  if(metadata.durationSeconds > MAX_MEDIA_DURATION_SECONDS){
    throw new Error('60秒を超えるメディアは利用できません。60秒以内でご利用ください。');
  }

  const silent = await detectSilentAudio(blob, inputKind);
  if(silent){
    throw new Error(SILENT_AUDIO_ERROR);
  }

  return {
    ok: true,
    sourceLabel,
    mode,
    blob,
    mimeType: blob.type || 'application/octet-stream',
    durationSeconds: metadata.durationSeconds,
    width: metadata.width,
    height: metadata.height,
    sizeBytes: blob.size,
    previewUrl: createObjectUrl(blob),
    inputKind,
  };
}

export function clearValidatedMedia(result){
  if(result?.previewUrl){
    revokeObjectUrl(result.previewUrl);
  }
}
