import { handleSelectArtwork } from '../../../_lib/mvp-api.js';

export async function onRequestPost(context){
  const artworkId = context.params?.artworkId;
  return handleSelectArtwork(context, artworkId);
}
