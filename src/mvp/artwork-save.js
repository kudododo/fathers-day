import { uploadArtworkAssets } from '../services/storage/artwork-upload.js';
import { createArtworkAttempt } from './session-api.js';
import { renderEchoArtworkImage } from './echo-artwork-renderer.js';

function getViewportAspectRatioLabel(){
  return globalThis.matchMedia('(max-width: 767px)').matches ? '9:16' : '16:9';
}

async function createPreviewImageBlob({ validatedMedia, artworkId }){
  return renderEchoArtworkImage({ validatedMedia, artworkId });
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
