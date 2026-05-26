import { handleCreateArtwork, handleUpload } from '../../_lib/mvp-api.js';

export async function onRequestPost(context){
  const contentType = String(context.request.headers.get('content-type') || '').toLowerCase();
  if(contentType.includes('multipart/form-data')){
    return handleUpload(context, true);
  }
  return handleCreateArtwork(context);
}
