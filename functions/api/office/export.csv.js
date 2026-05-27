import { handleOfficeExport } from '../../_lib/mvp-api.js';

export async function onRequestGet(context){
  return handleOfficeExport(context);
}
