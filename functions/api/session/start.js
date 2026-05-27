import { handleStartSession } from '../../_lib/mvp-api.js';

export async function onRequestPost(context){
  return handleStartSession(context);
}
