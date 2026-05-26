import { handleGetSession } from '../_lib/mvp-api.js';

export async function onRequestGet(context){
  return handleGetSession(context);
}
