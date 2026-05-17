const DEFAULT_ARTWORK_UPLOAD_ENDPOINT = '/api/artworks';
const DEFAULT_ASSET_UPLOAD_ENDPOINT = '/api/uploads';

const ASSET_RESPONSE_FIELD_BY_KIND = {
  image: 'image_url',
  video: 'video_url',
  audio: 'audio_url',
  original: 'original_media_url',
  legacy_image: 'artwork_master_url',
};

function getMetadataArtworkId(metadata){
  return metadata?.artwork_id || metadata?.artworkId || null;
}

function getMetadataSerialCode(metadata){
  return metadata?.serial_code || metadata?.serialCode || null;
}

function withStorageMetadata(metadata, storageResult){
  return {
    ...metadata,
    artwork_master_url: storageResult.artwork_master_url,
    storage_info: {
      ...(metadata?.storage_info || {}),
      status: 'r2_uploaded',
      provider: storageResult.provider,
      key: storageResult.key,
      artwork_master_url: storageResult.artwork_master_url,
      stored_at: storageResult.stored_at,
      byte_size: storageResult.byte_size,
      content_type: storageResult.content_type,
    },
  };
}

async function parseUploadError(response){
  try{
    const body = await response.json();
    return body?.user_message || body?.error || body?.message || response.statusText;
  }catch(_err){
    return response.statusText;
  }
}

async function postMultipartUpload({ endpoint, fileFieldName, fileBlob, fileName, metadata }){
  const formData = new FormData();
  formData.append(fileFieldName, fileBlob, fileName);
  formData.append('metadata', JSON.stringify(metadata || {}));

  return fetch(endpoint, {
    method: 'POST',
    body: formData,
  });
}

function buildRetryableError(message, cause){
  const error = new Error(message);
  error.retryable = true;
  error.cause = cause;
  return error;
}

export async function uploadArtworkAsset({
  assetKind,
  fileBlob,
  metadata,
  endpoint = DEFAULT_ASSET_UPLOAD_ENDPOINT,
  retryCount = 1,
} = {}){
  const artworkId = getMetadataArtworkId(metadata);
  if(!artworkId) throw new Error('metadata.artwork_id is required');
  if(!(fileBlob instanceof Blob)) throw new Error('fileBlob must be a Blob');
  if(!ASSET_RESPONSE_FIELD_BY_KIND[assetKind]){
    throw new Error(`unsupported asset kind: ${assetKind}`);
  }

  let lastError = null;
  for(let attempt = 0; attempt <= retryCount; attempt += 1){
    try{
      const response = await postMultipartUpload({
        endpoint,
        fileFieldName: 'file',
        fileBlob,
        fileName: `${assetKind}.${fileBlob.type.split('/')[1] || 'bin'}`,
        metadata: {
          ...(metadata || {}),
          asset_kind: assetKind,
        },
      });

      if(!response.ok){
        const message = await parseUploadError(response);
        throw buildRetryableError(`R2 upload failed: ${message}`, response);
      }

      const uploadResult = await response.json();
      const urlField = ASSET_RESPONSE_FIELD_BY_KIND[assetKind];
      return {
        provider: uploadResult.provider || 'cloudflare_r2',
        artwork_id: uploadResult.artwork_id || artworkId,
        asset_kind: assetKind,
        key: uploadResult.key,
        url: uploadResult[urlField],
        stored_at: uploadResult.stored_at || new Date().toISOString(),
        byte_size: uploadResult.byte_size ?? fileBlob.size,
        content_type: uploadResult.content_type || fileBlob.type || 'application/octet-stream',
        partial_failure: uploadResult.partial_failure || null,
      };
    }catch(err){
      lastError = err;
      if(attempt >= retryCount){
        throw buildRetryableError(
          assetKind === 'video'
            ? '動画の保存に失敗しました。もう一度お試しください。'
            : assetKind === 'audio'
              ? '音声の保存に失敗しました。もう一度お試しください。'
              : 'ファイルの保存に失敗しました。もう一度お試しください。',
          err,
        );
      }
    }
  }
  throw lastError;
}

export async function uploadArtworkAssets({
  metadata,
  assets = {},
  endpoint = DEFAULT_ASSET_UPLOAD_ENDPOINT,
  retryCount = 1,
} = {}){
  const uploadEntries = Object.entries(assets).filter(([, blob]) => blob instanceof Blob);
  const uploaded = {};
  const errors = [];

  for(const [assetKind, fileBlob] of uploadEntries){
    try{
      uploaded[assetKind] = await uploadArtworkAsset({
        assetKind,
        fileBlob,
        metadata,
        endpoint,
        retryCount,
      });
    }catch(err){
      errors.push({
        asset_kind: assetKind,
        message: err.message,
        retryable: err.retryable !== false,
      });
    }
  }

  return {
    uploaded,
    errors,
    ok: errors.length === 0,
  };
}

export async function saveArtwork({
  imageBlob,
  metadata,
  endpoint = DEFAULT_ARTWORK_UPLOAD_ENDPOINT,
} = {}){
  const artworkId = getMetadataArtworkId(metadata);
  if(!artworkId) throw new Error('metadata.artwork_id is required');
  if(!(imageBlob instanceof Blob)) throw new Error('imageBlob must be a Blob');

  const response = await postMultipartUpload({
    endpoint,
    fileFieldName: 'image',
    fileBlob: imageBlob,
    fileName: 'master.png',
    metadata,
  });

  if(!response.ok){
    const message = await parseUploadError(response);
    throw new Error(`R2 upload failed: ${message}`);
  }

  const uploadResult = await response.json();
  const storageResult = {
    provider: uploadResult.provider || 'cloudflare_r2',
    artwork_id: uploadResult.artwork_id || artworkId,
    serial_code: uploadResult.serial_code || getMetadataSerialCode(metadata),
    key: uploadResult.key,
    artwork_master_url: uploadResult.artwork_master_url,
    stored_at: uploadResult.stored_at || new Date().toISOString(),
    byte_size: uploadResult.byte_size ?? imageBlob.size,
    content_type: uploadResult.content_type || imageBlob.type || 'image/png',
  };

  console.info('Echo Garden R2 upload result:', {
    key: storageResult.key,
    artwork_master_url: storageResult.artwork_master_url,
  });

  return {
    ...storageResult,
    metadata: withStorageMetadata(metadata, storageResult),
  };
}

Object.assign(globalThis, {
  saveArtwork,
  uploadArtworkAsset,
  uploadArtworkAssets,
});
