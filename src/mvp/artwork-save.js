import { uploadArtworkAssets } from '../services/storage/artwork-upload.js';
import { createArtworkAttempt } from './session-api.js';

function getViewportAspectRatioLabel(){
  return globalThis.matchMedia('(max-width: 767px)').matches ? '9:16' : '16:9';
}

function createCanvas(width, height){
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function createDetachedVideo(blob){
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  const objectUrl = URL.createObjectURL(blob);
  video.src = objectUrl;
  return { video, objectUrl };
}

function waitForEvent(target, eventName){
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      target.removeEventListener(eventName, onReady);
      target.removeEventListener('error', onError);
    };
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('media could not be rendered'));
    };
    target.addEventListener(eventName, onReady, { once: true });
    target.addEventListener('error', onError, { once: true });
  });
}

async function captureVideoStill(blob){
  const { video, objectUrl } = createDetachedVideo(blob);
  try{
    await waitForEvent(video, 'loadeddata');
    try{
      video.currentTime = Math.min(0.2, (video.duration || 0) / 2);
      await waitForEvent(video, 'seeked');
    }catch(_err){}

    const width = video.videoWidth || 1080;
    const height = video.videoHeight || 1920;
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, width, height);
    return new Promise((resolve, reject) => {
      canvas.toBlob((blobResult) => {
        if(blobResult){
          resolve(blobResult);
        }else{
          reject(new Error('video still image could not be created'));
        }
      }, 'image/png');
    });
  }finally{
    URL.revokeObjectURL(objectUrl);
    video.removeAttribute('src');
    video.load();
  }
}

async function createAudioPoster({ validatedMedia, artworkId }){
  const isMobile = globalThis.matchMedia('(max-width: 767px)').matches;
  const width = isMobile ? 1080 : 1280;
  const height = isMobile ? 1920 : 720;
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');

  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#13251e');
  gradient.addColorStop(0.5, '#c85c3b');
  gradient.addColorStop(1, '#f1dfc5');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.fillStyle = 'rgba(255,255,255,0.2)';
  for(let index = 0; index < 18; index += 1){
    const x = (width / 18) * index;
    const barHeight = height * (0.18 + ((index % 5) * 0.07));
    context.fillRect(x + 12, height - barHeight - 120, Math.max(18, width / 36), barHeight);
  }

  context.fillStyle = '#fff8f0';
  context.font = `${Math.floor(width * 0.05)}px sans-serif`;
  context.fillText('Father’s Day Voice Artwork', width * 0.08, height * 0.16);
  context.font = `${Math.floor(width * 0.03)}px sans-serif`;
  context.fillText(`Artwork ID: ${artworkId}`, width * 0.08, height * 0.24);
  context.fillText(`Duration: ${validatedMedia.durationSeconds.toFixed(1)} sec`, width * 0.08, height * 0.3);
  context.fillText('Audio upload validated and ready for comparison.', width * 0.08, height * 0.36);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blobResult) => {
      if(blobResult){
        resolve(blobResult);
      }else{
        reject(new Error('audio preview image could not be created'));
      }
    }, 'image/png');
  });
}

async function createPreviewImageBlob({ validatedMedia, artworkId }){
  if(validatedMedia.inputKind === 'video'){
    return captureVideoStill(validatedMedia.blob);
  }
  return createAudioPoster({ validatedMedia, artworkId });
}

function buildArtworkId(){
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `art_${random.replace(/[^a-zA-Z0-9_-]+/g, '')}`;
}

function getMediaType(validatedMedia){
  if(validatedMedia.mode === 'record') return 'recorded_video';
  if(validatedMedia.mode === 'upload-audio') return 'uploaded_audio';
  return 'uploaded_video';
}

export async function generateArtworkFromMedia({ token, validatedMedia }){
  const artworkId = buildArtworkId();
  const previewImageBlob = await createPreviewImageBlob({ validatedMedia, artworkId });
  const metadata = {
    artwork_id: artworkId,
  };

  const assets = {
    image: previewImageBlob,
    original: validatedMedia.blob,
  };
  if(validatedMedia.inputKind === 'video'){
    assets.video = validatedMedia.blob;
  }else{
    assets.audio = validatedMedia.blob;
  }

  const uploadResult = await uploadArtworkAssets({
    metadata,
    assets,
    retryCount: 1,
  });

  if(!uploadResult.uploaded.image?.url){
    throw new Error('画像の保存に失敗しました。もう一度お試しください。');
  }

  const payload = {
    token,
    artwork_id: artworkId,
    image_url: uploadResult.uploaded.image.url,
    video_url: uploadResult.uploaded.video?.url || null,
    original_media_url: uploadResult.uploaded.original?.url || null,
    audio_url: uploadResult.uploaded.audio?.url || null,
    duration_seconds: validatedMedia.durationSeconds,
    width: validatedMedia.width,
    height: validatedMedia.height,
    aspect_ratio: validatedMedia.width && validatedMedia.height
      ? `${validatedMedia.width}:${validatedMedia.height}`
      : getViewportAspectRatioLabel(),
    media_type: getMediaType(validatedMedia),
    upload_status: uploadResult.errors.length ? 'partial' : 'complete',
    upload_errors: uploadResult.errors,
  };

  const created = await createArtworkAttempt(payload);
  return {
    artwork: created.artwork,
    session: created.session,
    uploadResult,
  };
}
