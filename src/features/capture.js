import { appState } from '../state/store.js';

// ===== auto capture =====
export function createAutoCaptureFilename(){
  return `capture-${appState.gW}x${appState.gH}-${Date.now()}.png`;
}

export function getAutoCaptureImageBlob(){
  const dataUrl = globalThis.g.elt.toDataURL('image/png');
  return dataURLtoBlob(dataUrl);
}

export function hasAutoCaptureTarget(){
  return !!appState.captureDirHandle;
}

export function canPerformAutoCapture(){
  return hasAutoCaptureTarget() && appState.micOn;
}

export function setAutoCaptureTimer(){
  appState.captureTimer = setInterval(performAutoCaptureOnce, appState.captureIntervalMs);
}

export function clearAutoCaptureTimer(){
  if(appState.captureTimer){
    clearInterval(appState.captureTimer);
    appState.captureTimer = null;
  }
}

export async function chooseCaptureFolder(){
  try{
    const handle = await globalThis.window.showDirectoryPicker({
      mode: 'readwrite'
    });
    appState.captureDirHandle = handle;
    globalThis.updateFolderPathLabel();
  }catch(err){
    console.warn('フォルダ選択がキャンセル/失敗:', err);
  }
}

export async function saveAutoCaptureBlob(blob){
  const filename = createAutoCaptureFilename();
  const fileHandle = await appState.captureDirHandle.getFileHandle(filename, { create:true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

export async function performAutoCaptureOnce(){
  if(!canPerformAutoCapture()) return;
  const blob = getAutoCaptureImageBlob();

  try{
    await saveAutoCaptureBlob(blob);
  }catch(err){
    console.error('書き込みに失敗:', err);
  }
}

export function dataURLtoBlob(dataUrl){
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  for(let i=0;i<n;i++){
    u8arr[i] = bstr.charCodeAt(i);
  }
  return new Blob([u8arr], {type:mime});
}

export function startAutoCapture(){
  if(appState.captureTimer) return;
  if(!hasAutoCaptureTarget()){
    chooseCaptureFolder().then(()=>{
      globalThis.updateFolderPathLabel();
      if(!hasAutoCaptureTarget()){
        stopAutoCapture();
        globalThis.ui.autoCapture.elt.checked = false;
        return;
      }
      setAutoCaptureTimer();
    });
  }else{
    setAutoCaptureTimer();
  }
}

export function stopAutoCapture(){
  clearAutoCaptureTimer();
}

Object.assign(globalThis, {
  createAutoCaptureFilename,
  getAutoCaptureImageBlob,
  hasAutoCaptureTarget,
  canPerformAutoCapture,
  setAutoCaptureTimer,
  clearAutoCaptureTimer,
  chooseCaptureFolder,
  saveAutoCaptureBlob,
  performAutoCaptureOnce,
  dataURLtoBlob,
  startAutoCapture,
  stopAutoCapture,
});
