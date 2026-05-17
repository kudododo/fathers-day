function getRandomSegment(length = 10){
  const cryptoApi = globalThis.crypto;
  if(cryptoApi?.getRandomValues){
    const bytes = new Uint8Array(length);
    cryptoApi.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(36).padStart(2, '0')).join('').slice(0, length);
  }
  return Math.random().toString(36).slice(2, 2 + length).padEnd(length, '0');
}

function getTimestampSegment(date = new Date()){
  return date.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
}

export function createArtworkId(date = new Date()){
  if(globalThis.crypto?.randomUUID){
    return `eg-${globalThis.crypto.randomUUID()}`;
  }
  return `eg-${getTimestampSegment(date)}-${getRandomSegment(12)}`;
}

export function createSerialCode(artworkId = createArtworkId()){
  return artworkId
    .replace(/^eg-/, '')
    .replace(/-/g, '')
    .slice(0, 16)
    .toUpperCase();
}

export function createArtworkIdentity(){
  const artworkId = createArtworkId();
  return {
    artworkId,
    serialCode: createSerialCode(artworkId),
  };
}

Object.assign(globalThis, {
  createArtworkId,
  createSerialCode,
  createArtworkIdentity,
});
