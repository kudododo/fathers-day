import { MAX_MEDIA_DURATION_SECONDS } from './media-validation.js';

const RECORDER_MIME_TYPES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

function chooseRecorderMimeType(){
  if(typeof MediaRecorder === 'undefined') return '';
  const supportedType = RECORDER_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
  return supportedType || '';
}

function getViewportAspectRatio(){
  return globalThis.matchMedia('(max-width: 767px)').matches ? (9 / 16) : (16 / 9);
}

function stopTracks(stream){
  stream?.getTracks().forEach((track) => track.stop());
}

export function createMediaRecorderController({
  previewElement,
  onTimerChange,
  onStatusChange,
  onStreamStateChange,
}){
  let mediaRecorder = null;
  let mediaStream = null;
  let chunks = [];
  let timerId = null;
  let startedAt = 0;
  let stopResolver = null;

  function clearTimer(){
    if(timerId){
      globalThis.clearInterval(timerId);
      timerId = null;
    }
  }

  function getElapsedSeconds(){
    if(!startedAt) return 0;
    return Math.min(MAX_MEDIA_DURATION_SECONDS, (Date.now() - startedAt) / 1000);
  }

  function updateTimer(){
    onTimerChange?.(getElapsedSeconds());
  }

  async function start(){
    if(!navigator.mediaDevices?.getUserMedia){
      throw new Error('この端末ではカメラ録音に対応していません。');
    }
    if(mediaRecorder?.state === 'recording'){
      return;
    }

    const aspectRatio = getViewportAspectRatio();
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: {
        facingMode: 'user',
        aspectRatio: { ideal: aspectRatio },
        width: globalThis.matchMedia('(max-width: 767px)').matches ? { ideal: 720 } : { ideal: 1280 },
        height: globalThis.matchMedia('(max-width: 767px)').matches ? { ideal: 1280 } : { ideal: 720 },
      },
    });

    previewElement.srcObject = mediaStream;
    previewElement.muted = true;
    previewElement.playsInline = true;
    try{
      await previewElement.play();
    }catch(_err){}

    chunks = [];
    const mimeType = chooseRecorderMimeType();
    mediaRecorder = mimeType ? new MediaRecorder(mediaStream, { mimeType }) : new MediaRecorder(mediaStream);
    mediaRecorder.addEventListener('dataavailable', (event) => {
      if(event.data?.size){
        chunks.push(event.data);
      }
    });
    mediaRecorder.addEventListener('stop', () => {
      const blobType = mediaRecorder.mimeType || 'video/webm';
      const blob = new Blob(chunks, { type: blobType });
      stopTracks(mediaStream);
      previewElement.srcObject = null;
      clearTimer();
      onTimerChange?.(getElapsedSeconds());
      onStatusChange?.('recorded');
      onStreamStateChange?.(false);
      const resolve = stopResolver;
      stopResolver = null;
      startedAt = 0;
      mediaStream = null;
      mediaRecorder = null;
      resolve?.({
        blob,
        mimeType: blobType,
        sourceLabel: '録画データ',
      });
    }, { once: true });

    startedAt = Date.now();
    onTimerChange?.(0);
    onStatusChange?.('recording');
    onStreamStateChange?.(true);
    mediaRecorder.start(250);
    timerId = globalThis.setInterval(() => {
      updateTimer();
      if(getElapsedSeconds() >= MAX_MEDIA_DURATION_SECONDS){
        stop();
      }
    }, 250);
  }

  function stop(){
    if(!mediaRecorder || mediaRecorder.state === 'inactive'){
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      stopResolver = resolve;
      mediaRecorder.stop();
    });
  }

  function cancel(){
    clearTimer();
    if(mediaRecorder && mediaRecorder.state !== 'inactive'){
      mediaRecorder.stop();
    }else{
      stopTracks(mediaStream);
      mediaStream = null;
      previewElement.srcObject = null;
      onStreamStateChange?.(false);
    }
  }

  function isRecording(){
    return mediaRecorder?.state === 'recording';
  }

  return {
    start,
    stop,
    cancel,
    isRecording,
  };
}
