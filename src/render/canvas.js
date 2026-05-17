import { appState } from '../state/store.js';

export function getPreviewRect(){
  const scaleFactor = Math.min(globalThis.width / appState.gW, globalThis.height / appState.gH);
  const width = appState.gW * scaleFactor;
  const height = appState.gH * scaleFactor;
  return {
    x: (globalThis.width - width) / 2,
    y: (globalThis.height - height) / 2,
    width,
    height,
    scaleFactor,
  };
}

export function drawPreviewFrame(rect){
  if(appState.fullscreenMode) return;

  globalThis.push();
  globalThis.noStroke();
  globalThis.fill(0, 0, 0, 80);
  globalThis.rect(rect.x - 8, rect.y - 8, rect.width + 16, rect.height + 16, 12);
  globalThis.pop();
}

export function drawPreviewBorder(rect){
  if(appState.fullscreenMode) return;

  globalThis.push();
  globalThis.noFill();
  globalThis.stroke(255, 180);
  globalThis.strokeWeight(2);
  globalThis.rect(rect.x, rect.y, rect.width, rect.height, 8);
  globalThis.pop();
}

export function drawArtworkToScreen(){
  globalThis.background(4, 7, 11);

  const rect = getPreviewRect();
  drawPreviewFrame(rect);
  globalThis.image(globalThis.g, rect.x, rect.y, rect.width, rect.height);
  drawPreviewBorder(rect);
}

export function renderIdleFrame(){
  drawArtworkToScreen();
}
