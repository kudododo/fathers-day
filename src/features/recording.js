import { appState } from '../state/store.js';

// ===== video/audio recording =====
export function createRecordingFilename(){
  return `recording-${appState.gW}x${appState.gH}-${Date.now()}.webm`;
}

export function updateRecordingUI(isActive){
  if(isActive){
    globalThis.ui.record.html('⏹ 録画停止');
    if(appState.micOn){
      globalThis.ui.stat.html('録画中... (稼働中)');
    }else{
      globalThis.ui.stat.html('録画中...');
    }
    return;
  }

  globalThis.ui.record.html('🎬 録画開始');
  if(appState.micOn){
    globalThis.ui.stat.html('稼働中');
  }else{
    globalThis.ui.stat.html('停止');
  }
}

export function resetRecordingState(){
  appState.mediaRecorder = null;
  appState.recordedChunks = [];
  appState.isRecording = false;
  appState.canvasStream = null;
  appState.audioStream = null;
}

export function cleanupRecordingStreams(){
  if(appState.audioStream){
    appState.audioStream.getTracks().forEach(track => track.stop());
  }
  appState.canvasStream = null;
  appState.audioStream = null;
}

export async function createRecordingCanvasStream(){
  return globalThis.g.elt.captureStream(60);
}

export async function requestPreferredRecordingAudioStream(){
  return globalThis.navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      sampleRate: 48000,
      channelCount: 2,
      sampleSize: 16
    }
  });
}

export async function requestFallbackRecordingAudioStream(){
  return globalThis.navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false
    }
  });
}

export async function createRecordingAudioStream(){
  try{
    return await requestPreferredRecordingAudioStream();
  }catch(audioErr){
    console.warn('音声ストリーム取得エラー:', audioErr);
    try{
      return await requestFallbackRecordingAudioStream();
    }catch(fallbackErr){
      console.warn('音声ストリーム取得エラー（フォールバック）:', fallbackErr);
      return null;
    }
  }
}

export function attachAudioTracksToCanvasStream(stream, sourceStream){
  if(!sourceStream) return;
  const audioTracks = sourceStream.getAudioTracks();
  audioTracks.forEach(track => {
    stream.addTrack(track);
  });
}

export function getRecordingVideoBitrate(){
  const pixelCount = appState.gW * appState.gH;
  const baseBitrate = 8000000;
  const scaleFactor = pixelCount / (1920 * 1080);
  return Math.max(4000000, Math.min(16000000, baseBitrate * scaleFactor));
}

export function createRecordingOptions(){
  const options = {
    mimeType: 'video/webm;codecs=vp9,opus',
    videoBitsPerSecond: getRecordingVideoBitrate(),
    audioBitsPerSecond: 192000
  };

  if(!globalThis.MediaRecorder.isTypeSupported(options.mimeType)){
    options.mimeType = 'video/webm;codecs=vp8,opus';
  }
  if(!globalThis.MediaRecorder.isTypeSupported(options.mimeType)){
    options.mimeType = 'video/webm';
  }

  return options;
}

export function handleRecordingDataAvailable(event){
  if(event.data && event.data.size > 0){
    appState.recordedChunks.push(event.data);
    console.log('データチャンク受信:', event.data.size, 'bytes');
  }
}

export async function finalizeRecordingSave(){
  if(appState.recordedChunks.length === 0){
    console.warn('録画データが空です');
    globalThis.alert('録画データが取得できませんでした。録画時間が短すぎる可能性があります。');
    return;
  }

  const blob = new globalThis.Blob(appState.recordedChunks, { type: 'video/webm' });
  console.log('Blob作成完了、サイズ:', blob.size, 'bytes');
  await saveRecording(blob);
}

export function scheduleRecordingFinalize(){
  setTimeout(async () => {
    try{
      await finalizeRecordingSave();
    } finally {
      cleanupRecordingStreams();
      appState.recordedChunks = [];
    }
  }, 100);
}

export function handleRecordingStop(){
  console.log('録画停止、チャンク数:', appState.recordedChunks.length);
  if(appState.mediaRecorder && appState.mediaRecorder.state !== 'inactive'){
    appState.mediaRecorder.requestData();
  }
  scheduleRecordingFinalize();
}

export function createMediaRecorderInstance(stream){
  return new globalThis.MediaRecorder(stream, createRecordingOptions());
}

export function configureMediaRecorder(recorder){
  appState.recordedChunks = [];
  recorder.ondataavailable = handleRecordingDataAvailable;
  recorder.onstop = handleRecordingStop;
}

export async function prepareRecordingSession(){
  appState.canvasStream = await createRecordingCanvasStream();
  appState.audioStream = await createRecordingAudioStream();
  attachAudioTracksToCanvasStream(appState.canvasStream, appState.audioStream);

  appState.mediaRecorder = createMediaRecorderInstance(appState.canvasStream);
  configureMediaRecorder(appState.mediaRecorder);
}

export async function toggleRecording(){
  if(appState.isRecording){
    stopRecording();
  }else{
    await startRecording();
  }
}

export async function startRecording(){
  try{
    await prepareRecordingSession();
    appState.mediaRecorder.start(1000);
    appState.isRecording = true;
    updateRecordingUI(true);
  }catch(err){
    console.error('録画開始エラー:', err);
    globalThis.alert('録画を開始できませんでした: ' + err.message);
    cleanupRecordingStreams();
    resetRecordingState();
    globalThis.ui.record.html('🎬 録画開始');
  }
}

export function stopRecording(){
  if(appState.mediaRecorder && appState.isRecording){
    if(appState.mediaRecorder.state === 'recording'){
      appState.mediaRecorder.requestData();
    }
    appState.mediaRecorder.stop();
    appState.isRecording = false;
    updateRecordingUI(false);
  }
}

export async function saveRecordingToFolder(blob){
  const filename = createRecordingFilename();
  const fileHandle = await appState.captureDirHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
  console.log('録画を保存しました:', filename);
}

export function downloadRecordingBlob(blob){
  const a = globalThis.document.createElement('a');
  a.download = createRecordingFilename();
  a.href = globalThis.URL.createObjectURL(blob);
  a.click();
  globalThis.URL.revokeObjectURL(a.href);
}

export async function saveRecording(blob){
  try{
    if(appState.captureDirHandle){
      await saveRecordingToFolder(blob);
    }else{
      downloadRecordingBlob(blob);
      console.log('録画をダウンロードしました');
    }
  }catch(err){
    console.error('録画保存エラー:', err);
    downloadRecordingBlob(blob);
  }
}

Object.assign(globalThis, {
  createRecordingFilename,
  updateRecordingUI,
  resetRecordingState,
  cleanupRecordingStreams,
  createRecordingCanvasStream,
  requestPreferredRecordingAudioStream,
  requestFallbackRecordingAudioStream,
  createRecordingAudioStream,
  attachAudioTracksToCanvasStream,
  getRecordingVideoBitrate,
  createRecordingOptions,
  handleRecordingDataAvailable,
  finalizeRecordingSave,
  scheduleRecordingFinalize,
  handleRecordingStop,
  createMediaRecorderInstance,
  configureMediaRecorder,
  prepareRecordingSession,
  toggleRecording,
  startRecording,
  stopRecording,
  saveRecordingToFolder,
  downloadRecordingBlob,
  saveRecording,
});
