import { getGuidedDefaults, getStateDefaults } from '../config/access.js';
import { createArtworkIdentity } from '../services/artwork/artwork-id.js';

const stateDefaults = getStateDefaults();
const initialArtworkIdentity = createArtworkIdentity();

export const DEFAULT_GUIDED_STATE = getGuidedDefaults();

export const appState = globalThis.appState || {
  running: true,
  micOn: false,
  isRecording: false,
  fullscreenMode: false,
  gW: stateDefaults.gW,
  gH: stateDefaults.gH,
  bgHex: stateDefaults.bgHex,
  aspectBucketId: stateDefaults.aspectBucketId,
  artworkId: initialArtworkIdentity.artworkId,
  serialCode: initialArtworkIdentity.serialCode,
  exportScaleCompensation: 1,
  lastArtworkExport: null,
  lastArtworkMetadata: null,
  lastArtworkStorageResult: null,
  productizeStatus: 'idle',
  productizeError: null,
  shareStatus: 'idle',
  shareError: null,
  lastArtworkShareResult: null,
  lastShopifyHandoffPayload: null,
  handoffStatus: 'idle',
  handoffError: null,
  lastShopifyHandoffResult: null,
  captureIntervalMs: stateDefaults.captureIntervalMs,
  captureDirHandle: null,
  captureTimer: null,
  mediaRecorder: null,
  recordedChunks: [],
  canvasStream: null,
  audioStream: null,
  guided: { ...DEFAULT_GUIDED_STATE },
};

globalThis.appState = appState;

if(!appState.guided){
  appState.guided = { ...DEFAULT_GUIDED_STATE };
}

function defineStateProp(name){
  Object.defineProperty(globalThis, name, {
    configurable: true,
    enumerable: true,
    get(){
      return appState[name];
    },
    set(value){
      appState[name] = value;
    }
  });
}

[
  'running',
  'micOn',
  'isRecording',
  'fullscreenMode',
  'gW',
  'gH',
  'bgHex',
  'aspectBucketId',
  'artworkId',
  'serialCode',
  'lastArtworkStorageResult',
  'productizeStatus',
  'productizeError',
  'shareStatus',
  'shareError',
  'lastArtworkShareResult',
  'lastShopifyHandoffPayload',
  'handoffStatus',
  'handoffError',
  'lastShopifyHandoffResult',
  'captureIntervalMs',
].forEach(defineStateProp);
