function bindPersistedSettingEvents(){
  for(const id of persistedSettingIds){
    const el = ui[id]?.elt;
    if(!el) continue;
    const eventName = (el.type === 'checkbox' || el.tagName === 'SELECT') ? 'change' : 'input';
    el.addEventListener(eventName, ()=> savePersistedSetting(id));
  }
}

function collectUIElements(){
  [
    'gain','smooth','fft','colorMode','trail','particles','toggle','pause','snap','metaJson',
    'clear','stat','hint','startBtn','gainVal','smoothVal','trailVal',
    'particlesVal','pitchMode','key','noteReadout','canvasSize','fullscreenBtn',
    'exportPreset','exportPrintPng','exportInfo','goodsCreate','shareUrl','shopifyHandoff','productizeStatus','shareStatus','handoffStatus',
    'bgColor','autoCapture','pickFolder','spawnMode','captureIntervalMs',
    'mixAutoBrush','mixFireworks','mixFlower',
    'mixWave','mixParticles','mixAurora','mixGalaxy','mixRain','mixInk','mixButterfly',
    'record','micGain','micGainVal',
  ].forEach(id=> ui[id]=select('#'+id));
}

function syncInitialUIState(){
  appState.bgHex = ui.bgColor.value();
  resizeArtworkFromPreset();
  fillBGOnG();

  ui.gainVal.html(nf(ui.gain.value(),1,1));
  ui.smoothVal.html(nf(ui.smooth.value(),1,2));
  ui.trailVal.html(nf(ui.trail.value(),1,3));
  ui.particlesVal.html(ui.particles.value());
  ui.micGainVal.html(nf(ui.micGain.value(),1,2));

  appState.captureIntervalMs = parseInt(ui.captureIntervalMs.elt.value, 10);
  appState.captureIntervalMs = (isFinite(appState.captureIntervalMs) && appState.captureIntervalMs >= 200) ? appState.captureIntervalMs : 200;
  ui.captureIntervalMs.elt.value = appState.captureIntervalMs;

  updateDebugSize();
  updateDebugBG();
  updateFolderPathLabel();
  updateExportPresetInfo();
}

function bindPrimaryUIEvents(){
  ui.startBtn.mousePressed(startMic);
  ui.toggle.mousePressed(()=> appState.micOn ? stopMic() : startMic());

  ui.pause.mousePressed(()=>{
    appState.running = !appState.running;
    ui.pause.html(appState.running?'⏸ Pause':'▶️ Resume');
  });

  ui.snap.mousePressed(savePNG);
  ui.metaJson.mousePressed(exportArtworkMetadataJson);
  ui.exportPrintPng.mousePressed(exportPrintPNG);
  ui.clear.mousePressed(clearArt);
  ui.goodsCreate.mousePressed(startProductizeSaveFlow);
  ui.shareUrl.mousePressed(shareLatestArtworkUrl);
  ui.shopifyHandoff.mousePressed(startShopifyHandoffFromCurrentArtwork);
  ui.record.mousePressed(toggleRecording);
  ui.fullscreenBtn.mousePressed(toggleFullscreen);
}

function bindUIValueEvents(){
  ui.micGain.input(()=>{
    ui.micGainVal.html(nf(ui.micGain.value(),1,2));
    if(micGainNode){
      micGainNode.amp(float(ui.micGain.value()), 0.02); // 20msでなめらかに
    }
  });

  ui.gain.input(()=> ui.gainVal.html(nf(ui.gain.value(),1,1)));
  ui.smooth.input(()=> ui.smoothVal.html(nf(ui.smooth.value(),1,2)));
  ui.trail.input(()=> ui.trailVal.html(nf(ui.trail.value(),1,3)));
  ui.particles.input(()=> { ui.particlesVal.html(ui.particles.value()); });

  ui.canvasSize.changed(()=> resizeArtworkFromPreset());
  ui.exportPreset.changed(()=> updateExportPresetInfo());

  ui.bgColor.input(()=>{
    appState.bgHex = ui.bgColor.value();
    fillBGOnG();
    updateDebugBG();
  });

  ui.autoCapture.changed(()=>{
    if(ui.autoCapture.elt.checked){
      startAutoCapture();
    }else{
      stopAutoCapture();
    }
  });

  ui.pickFolder.mousePressed(async ()=>{
    await chooseCaptureFolder();
  });

  ui.captureIntervalMs.input(()=>{
    const v = parseInt(ui.captureIntervalMs.elt.value, 10);
    // 200ms未満は危険なので丸める
    appState.captureIntervalMs = (isFinite(v) && v >= 200) ? v : 200;
    ui.captureIntervalMs.elt.value = appState.captureIntervalMs;
    // すでに自動キャプチャ中ならタイマーを張り替え
    if (ui.autoCapture.elt.checked) {
      stopAutoCapture();
      startAutoCapture();
    }
  });
}

function bindUIEvents(){
  bindPrimaryUIEvents();
  bindUIValueEvents();
  bindPersistedSettingEvents();
  document.addEventListener("fullscreenchange", handleFullscreenChange);
}
