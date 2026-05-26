import { handleUpload } from '../_lib/mvp-api.js';

export async function onRequestPost(context){
  return handleUpload(context, false);
}
