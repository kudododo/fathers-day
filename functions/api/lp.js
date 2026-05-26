import { handleGetLp } from '../_lib/mvp-api.js';

export async function onRequestGet(context){
  return handleGetLp(context);
}
