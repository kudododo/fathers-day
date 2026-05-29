function createCanvas(width, height){
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function waitForEvent(target, eventName){
  return new Promise((resolve, reject) => {
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('media could not be rendered'));
    };
    const cleanup = () => {
      target.removeEventListener(eventName, onReady);
      target.removeEventListener('error', onError);
    };
    target.addEventListener(eventName, onReady, { once: true });
    target.addEventListener('error', onError, { once: true });
  });
}

function createDetachedVideo(blob){
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  const objectUrl = URL.createObjectURL(blob);
  video.src = objectUrl;
  return { video, objectUrl };
}

async function captureVideoFrame(blob, seekTime = 0.25){
  const { video, objectUrl } = createDetachedVideo(blob);
  try{
    await waitForEvent(video, 'loadeddata');
    try{
      video.currentTime = Math.min(seekTime, Math.max(0, (video.duration || 0) * 0.25));
      await waitForEvent(video, 'seeked');
    }catch(_err){}

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, width, height);
    return canvas;
  }finally{
    URL.revokeObjectURL(objectUrl);
    video.removeAttribute('src');
    video.load();
  }
}

function normalizeSamples(samples, sampleCount = 160){
  if(!samples?.length) return new Array(sampleCount).fill(0);
  const output = [];
  const windowSize = Math.max(1, Math.floor(samples.length / sampleCount));
  for(let index = 0; index < sampleCount; index += 1){
    const start = index * windowSize;
    const end = Math.min(samples.length, start + windowSize);
    let sum = 0;
    let peak = 0;
    for(let cursor = start; cursor < end; cursor += 1){
      const value = samples[cursor] || 0;
      const abs = Math.abs(value);
      sum += abs;
      peak = Math.max(peak, abs);
    }
    const avg = end > start ? sum / (end - start) : 0;
    output.push(Math.min(1, (avg * 0.7) + (peak * 0.6)));
  }
  return output;
}

async function decodeAudioSamples(blob){
  const AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext;
  if(!AudioContextCtor){
    return null;
  }
  const audioContext = new AudioContextCtor();
  try{
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const channelData = [];
    for(let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1){
      channelData.push(audioBuffer.getChannelData(channel));
    }

    const mixed = new Float32Array(audioBuffer.length);
    for(let index = 0; index < audioBuffer.length; index += 1){
      let sum = 0;
      for(const channel of channelData){
        sum += channel[index] || 0;
      }
      mixed[index] = sum / channelData.length;
    }

    const envelope = normalizeSamples(mixed, 180);
    let rms = 0;
    let peak = 0;
    let zeroCrossings = 0;
    for(let index = 0; index < mixed.length; index += 1){
      const value = mixed[index];
      rms += value * value;
      peak = Math.max(peak, Math.abs(value));
      if(index > 0){
        const prev = mixed[index - 1];
        if((prev < 0 && value >= 0) || (prev >= 0 && value < 0)){
          zeroCrossings += 1;
        }
      }
    }
    rms = Math.sqrt(rms / mixed.length);
    const brightness = Math.min(1, (rms * 3.5) + (peak * 0.4));
    const motion = Math.min(1, zeroCrossings / Math.max(1, mixed.length * 0.12));
    return {
      envelope,
      brightness,
      motion,
      peak,
    };
  }catch(_error){
    return null;
  }finally{
    await audioContext.close().catch(() => {});
  }
}

function getAverageColor(imageData){
  const { data } = imageData;
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for(let index = 0; index < data.length; index += 16){
    r += data[index];
    g += data[index + 1];
    b += data[index + 2];
    count += 1;
  }
  return count ? {
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count),
  } : { r: 200, g: 92, b: 59 };
}

function shiftColor(color, shift){
  const clamp = (value) => Math.max(0, Math.min(255, value));
  return {
    r: clamp(color.r + shift.r),
    g: clamp(color.g + shift.g),
    b: clamp(color.b + shift.b),
  };
}

function colorString(color, alpha = 1){
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

function drawBackground(context, width, height, palette, intensity){
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, colorString(palette.dark));
  gradient.addColorStop(0.5, colorString(palette.accent, 0.92));
  gradient.addColorStop(1, colorString(palette.light));
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.fillStyle = 'rgba(255,255,255,0.06)';
  for(let index = 0; index < 18; index += 1){
    const radius = Math.max(width, height) * (0.08 + (index * 0.015));
    const x = width * ((index % 5) / 4);
    const y = height * (((index * 3) % 7) / 6);
    context.beginPath();
    context.arc(x, y, radius * (0.35 + intensity), 0, Math.PI * 2);
    context.fill();
  }
}

function drawWaveform(context, width, height, envelope, palette){
  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = colorString(palette.highlight, 0.95);
  context.lineWidth = Math.max(4, width * 0.006);
  context.beginPath();
  envelope.forEach((value, index) => {
    const x = (width * 0.08) + ((width * 0.84) * (index / Math.max(1, envelope.length - 1)));
    const wobble = Math.sin(index * 0.22) * height * 0.05;
    const y = (height * 0.55) - (value * height * 0.24) + wobble;
    if(index === 0){
      context.moveTo(x, y);
    }else{
      context.lineTo(x, y);
    }
  });
  context.stroke();

  context.strokeStyle = colorString(palette.light, 0.4);
  context.lineWidth = Math.max(1, width * 0.002);
  context.beginPath();
  envelope.forEach((value, index) => {
    const x = (width * 0.08) + ((width * 0.84) * (index / Math.max(1, envelope.length - 1)));
    const y = (height * 0.72) - (value * height * 0.16);
    if(index === 0){
      context.moveTo(x, y);
    }else{
      context.lineTo(x, y);
    }
  });
  context.stroke();
  context.restore();
}

function drawPulseRings(context, width, height, palette, motion){
  context.save();
  context.translate(width * 0.78, height * 0.26);
  for(let index = 0; index < 6; index += 1){
    context.beginPath();
    context.strokeStyle = colorString(index % 2 === 0 ? palette.light : palette.highlight, 0.14 + (index * 0.05));
    context.lineWidth = Math.max(2, width * 0.0035);
    context.arc(0, 0, width * (0.06 + (index * 0.03) + (motion * 0.05)), 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();
}

function drawFrameOverlay(context, frameCanvas, width, height){
  const sourceRatio = frameCanvas.width / frameCanvas.height;
  const targetWidth = width * 0.34;
  const targetHeight = targetWidth / sourceRatio;
  const x = width * 0.1;
  const y = height * 0.12;

  context.save();
  context.shadowColor = 'rgba(0,0,0,0.2)';
  context.shadowBlur = 28;
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x - 10, y - 10, targetWidth + 20, targetHeight + 20);
  context.globalAlpha = 0.82;
  context.drawImage(frameCanvas, x, y, targetWidth, targetHeight);
  context.restore();
}

function drawTypography(context, width, height, metadata){
  context.save();
  context.fillStyle = 'rgba(255,248,240,0.95)';
  context.font = `600 ${Math.floor(width * 0.033)}px sans-serif`;
  context.fillText('Echo Garden Father’s Day', width * 0.08, height * 0.12);
  context.font = `${Math.floor(width * 0.021)}px sans-serif`;
  context.fillText(`Artwork ID: ${metadata.artworkId}`, width * 0.08, height * 0.88);
  context.fillText(`Duration: ${metadata.durationSeconds.toFixed(1)} sec`, width * 0.08, height * 0.92);
  context.restore();
}

async function canvasToBlob(canvas){
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if(blob){
        resolve(blob);
      }else{
        reject(new Error('artwork image could not be created'));
      }
    }, 'image/png');
  });
}

function getCanvasSize(validatedMedia){
  if(validatedMedia.width && validatedMedia.height){
    const aspectRatio = validatedMedia.width / validatedMedia.height;
    if(aspectRatio < 0.9){
      return { width: 1080, height: 1920 };
    }
    return { width: 1600, height: 900 };
  }
  const isMobile = globalThis.matchMedia('(max-width: 767px)').matches;
  return isMobile ? { width: 1080, height: 1440 } : { width: 1600, height: 900 };
}

export async function renderEchoArtworkImage({ validatedMedia, artworkId }){
  const [audioAnalysis, frameCanvas] = await Promise.all([
    decodeAudioSamples(validatedMedia.blob),
    validatedMedia.inputKind === 'video' ? captureVideoFrame(validatedMedia.blob) : Promise.resolve(null),
  ]);

  const { width, height } = getCanvasSize(validatedMedia);
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  const baseColor = frameCanvas
    ? getAverageColor(frameCanvas.getContext('2d').getImageData(0, 0, frameCanvas.width, frameCanvas.height))
    : { r: 200, g: 92, b: 59 };
  const intensity = audioAnalysis?.brightness || 0.42;
  const palette = {
    dark: shiftColor(baseColor, { r: -115, g: -95, b: -88 }),
    accent: shiftColor(baseColor, { r: 25, g: 18, b: 36 }),
    light: shiftColor(baseColor, { r: 48, g: 76, b: 84 }),
    highlight: shiftColor(baseColor, { r: 82, g: 96, b: 118 }),
  };

  drawBackground(context, width, height, palette, intensity);
  if(frameCanvas){
    drawFrameOverlay(context, frameCanvas, width, height);
  }
  drawPulseRings(context, width, height, palette, audioAnalysis?.motion || 0.3);
  drawWaveform(context, width, height, audioAnalysis?.envelope || new Array(180).fill(0.24), palette);
  drawTypography(context, width, height, {
    artworkId,
    durationSeconds: validatedMedia.durationSeconds,
  });

  return canvasToBlob(canvas);
}
