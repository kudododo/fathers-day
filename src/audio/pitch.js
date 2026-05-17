// pitch/scale info
export const noteNames = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
export const major = [0,2,4,5,7,9,11];
export const minor = [0,2,3,5,7,8,10];
export const keyToSemitone = {C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11};

// pitch estimator (autocorrelation-ish)
export function estimatePitch(wave, sr){
  if(!wave || wave.length<512) return null;
  const buf = new Float32Array(wave.length);
  let mean = 0;
  for(let i=0;i<wave.length;i++) mean+=wave[i];
  mean/=wave.length;
  for(let i=0;i<wave.length;i++){
    buf[i] = (wave[i]-mean) * (0.5 - 0.5*Math.cos(2*Math.PI*i/(wave.length-1)));
  }

  const minF=80, maxF=1000;
  const minLag=Math.floor(sr/maxF),
        maxLag=Math.floor(sr/minF);
  let bestLag=-1, best=0;
  for(let lag=minLag; lag<=maxLag; lag++){
    let sum=0;
    for(let i=0;i<buf.length-lag;i++){
      sum += buf[i]*buf[i+lag];
    }
    if(sum>best){
      best=sum; bestLag=lag;
    }
  }
  if(bestLag>0){
    return sr/bestLag;
  }
  return null;
}

// snap pitch to scale
export function snapMidi(midi, mode, keyName){
  if(mode==='off' || !isFinite(midi)) return midi;
  const keyRoot = keyToSemitone[keyName] ?? 9;
  const scale = (mode==='snapM') ? major : minor;
  const roundMidi = Math.round(midi);
  const oct = Math.floor(roundMidi/12);
  let nearest = null, best = 1e9;
  for(let o=-1;o<=1;o++){
    for(const deg of scale){
      const cand = (oct+o)*12 + ((deg + keyRoot)%12);
      const d = Math.abs(cand - midi);
      if(d<best){
        best=d; nearest=cand;
      }
    }
  }
  return nearest ?? midi;
}

Object.assign(globalThis, {
  noteNames,
  major,
  minor,
  keyToSemitone,
  estimatePitch,
  snapMidi,
});
