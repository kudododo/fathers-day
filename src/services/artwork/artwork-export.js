export function dataUrlToBlob(dataUrl){
  const [header, body] = String(dataUrl || '').split(',');
  const mime = header?.match(/:(.*?);/)?.[1] || 'application/octet-stream';
  const binary = globalThis.atob(body || '');
  const bytes = new Uint8Array(binary.length);

  for(let i = 0; i < binary.length; i += 1){
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mime });
}

export function canvasToPngBlob(canvas){
  if(!canvas) return Promise.reject(new Error('canvas is required'));

  if(typeof canvas.toBlob === 'function'){
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if(blob){
          resolve(blob);
        }else{
          reject(new Error('PNG Blob generation failed'));
        }
      }, 'image/png');
    });
  }

  if(typeof canvas.toDataURL === 'function'){
    return Promise.resolve(dataUrlToBlob(canvas.toDataURL('image/png')));
  }

  return Promise.reject(new Error('canvas export is not supported'));
}

export function createArtworkImageBlob(graphics){
  return canvasToPngBlob(graphics?.elt || graphics);
}

Object.assign(globalThis, {
  dataUrlToBlob,
  canvasToPngBlob,
  createArtworkImageBlob,
});
