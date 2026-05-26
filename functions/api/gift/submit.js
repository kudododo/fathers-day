import { handleGiftSubmit } from '../../_lib/mvp-api.js';

export async function onRequestPost(context){
  return handleGiftSubmit(context);
}
