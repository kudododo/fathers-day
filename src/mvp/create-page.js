import { generateArtworkFromMedia } from './artwork-save.js';
import { createMediaRecorderController } from './media-recorder.js';
import { clearValidatedMedia, MAX_MEDIA_DURATION_SECONDS, validateSelectedMedia } from './media-validation.js';
import { loadSession, selectArtwork, startSession, submitGift } from './session-api.js';

const PROCESSING_MESSAGE = 'アップロード中です。画面を閉じないでください。';
const MODE_LABELS = {
  record: 'Record camera + microphone',
  'upload-audio': 'Upload audio',
  'upload-video': 'Upload video',
};

const state = {
  token: '',
  sessionPayload: null,
  activeMode: 'record',
  validatedMedia: null,
  recorder: null,
  isGenerating: false,
  isSubmittingGift: false,
  hasStartedSession: false,
};

function getToken(){
  const params = new URLSearchParams(globalThis.location.search);
  return params.get('token') || '';
}

function formatTimer(seconds){
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
  const remainingSeconds = String(safeSeconds % 60).padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
}

function setSessionState({ token, payload, error }){
  document.getElementById('tokenValue').textContent = token || '(missing)';
  document.getElementById('sessionStatus').textContent = error ? 'error' : 'ready';
  document.getElementById('sessionPayload').textContent = JSON.stringify(error ? { error } : payload, null, 2);
  document.getElementById('createFlow').hidden = !!error;

  const banner = document.getElementById('sessionBanner');
  if(error){
    banner.dataset.tone = 'error';
    banner.textContent = error;
    return;
  }

  const session = payload?.session;
  const remaining = Math.max(0, (session?.max_attempts || 0) - (session?.attempts_used || 0));
  banner.dataset.tone = 'neutral';
  banner.textContent = `セッション確認済みです。使用済み ${session?.attempts_used || 0} / ${session?.max_attempts || 0} 回、残り ${remaining} 回です。`;
  document.getElementById('attemptCounter').textContent = `${session?.attempts_used || 0} / ${session?.max_attempts || 0}`;
  renderAttemptState();
  renderResults();
}

function setStatus(message, tone = 'neutral'){
  const status = document.getElementById('mediaStatus');
  status.dataset.tone = tone;
  status.textContent = message;
}

function getSession(){
  return state.sessionPayload?.session || null;
}

async function ensureSessionStarted(){
  if(state.hasStartedSession) return;
  const session = getSession();
  if(!session || session.status !== 'draft') {
    state.hasStartedSession = true;
    return;
  }
  const payload = await startSession(state.token);
  state.sessionPayload = payload;
  state.hasStartedSession = true;
  setSessionState({ token: state.token, payload });
}

function getArtworks(){
  return state.sessionPayload?.artworks || [];
}

function getSelectedArtworkId(){
  return getSession()?.selected_artwork_id || null;
}

function isSelectionLocked(){
  const session = getSession();
  return session?.status === 'selected' || session?.status === 'submitted' || !!session?.selected_artwork_id;
}

function canGenerateAnotherAttempt(){
  const session = getSession();
  if(!session) return false;
  return session.attempts_used < session.max_attempts && !isSelectionLocked();
}

function clearValidationResult(){
  clearValidatedMedia(state.validatedMedia);
  state.validatedMedia = null;
  document.getElementById('validatedPanel').hidden = true;
  const preview = document.getElementById('validatedPreview');
  preview.hidden = true;
  preview.pause();
  preview.removeAttribute('src');
  preview.load();
  document.getElementById('validatedMeta').innerHTML = '';
  renderGenerateButton();
}

function renderMode(){
  for(const button of document.querySelectorAll('[data-mode]')){
    button.dataset.selected = button.dataset.mode === state.activeMode ? 'true' : 'false';
  }
  document.getElementById('recordPanel').hidden = state.activeMode !== 'record';
  document.getElementById('uploadAudioPanel').hidden = state.activeMode !== 'upload-audio';
  document.getElementById('uploadVideoPanel').hidden = state.activeMode !== 'upload-video';
  clearValidationResult();
  setStatus(`${MODE_LABELS[state.activeMode]} を選択しました。`, 'neutral');
}

function renderTimer(seconds){
  document.getElementById('recordTimer').textContent = formatTimer(seconds);
}

function renderRecorderState(status){
  const label = document.getElementById('recordingState');
  const startButton = document.getElementById('recordStartButton');
  const stopButton = document.getElementById('recordStopButton');
  const isRecording = status === 'recording';
  startButton.disabled = isRecording;
  stopButton.disabled = !isRecording;
  label.textContent = isRecording ? '録音中です。60秒で自動停止します。' : '録音前です。';
}

function renderGenerateButton(){
  const button = document.getElementById('generateButton');
  const note = document.getElementById('generationNote');
  const session = getSession();
  const attemptsUsed = session?.attempts_used || 0;
  const maxAttempts = session?.max_attempts || 0;

  button.disabled = !state.validatedMedia || !canGenerateAnotherAttempt() || state.isGenerating;
  button.textContent = state.isGenerating
    ? '生成中...'
    : `この内容で作品を作る (${attemptsUsed}/${maxAttempts})`;

  if(isSelectionLocked()){
    note.textContent = '最終作品が選択済みのため、新しい生成はできません。';
  }else if(canGenerateAnotherAttempt()){
    note.textContent = '検証済みメディアのみ生成に進めます。生成に成功した時点でサーバー側の試行回数が消費されます。';
  }else{
    note.textContent = '生成上限に達しています。比較結果から1点を選択してください。';
  }
}

function renderAttemptState(){
  document.getElementById('generationControls').hidden = isSelectionLocked();
  document.getElementById('messageFormCard').hidden = !isSelectionLocked();
  document.getElementById('selectedSummaryCard').hidden = !isSelectionLocked();
  renderGiftFormState();
  renderGenerateButton();
}

function renderGiftFormState(){
  const button = document.getElementById('giftSubmitButton');
  const status = document.getElementById('giftSubmitStatus');
  const lpLink = document.getElementById('lpPreviewLink');
  const session = getSession();
  const isSubmitted = session?.status === 'submitted';
  button.disabled = !isSelectionLocked() || state.isSubmittingGift || isSubmitted;
  button.textContent = state.isSubmittingGift ? '送信中...' : '内容を送信する';
  if(isSubmitted){
    status.dataset.tone = 'success';
    status.textContent = '送信が完了しました。LP を確認できます。';
  }else if(isSelectionLocked()){
    status.dataset.tone = 'neutral';
    status.textContent = '最終作品が確定しています。メッセージと配送先を送信してください。';
  }else{
    status.dataset.tone = 'neutral';
    status.textContent = '選択後に送信できます。';
  }
  if(session?.lp_id){
    lpLink.href = `/lp/?id=${encodeURIComponent(session.lp_id)}`;
    lpLink.hidden = false;
  }else{
    lpLink.hidden = true;
  }
}

function renderValidatedMedia(result){
  const panel = document.getElementById('validatedPanel');
  const meta = document.getElementById('validatedMeta');
  const preview = document.getElementById('validatedPreview');
  const aspectText = result.width && result.height ? `${result.width} x ${result.height}` : 'audio only';

  panel.hidden = false;
  meta.innerHTML = [
    `<div><dt>Source</dt><dd>${result.sourceLabel}</dd></div>`,
    `<div><dt>Type</dt><dd>${result.mimeType}</dd></div>`,
    `<div><dt>Duration</dt><dd>${result.durationSeconds.toFixed(1)}s / ${MAX_MEDIA_DURATION_SECONDS}s</dd></div>`,
    `<div><dt>Layout</dt><dd>${aspectText}</dd></div>`,
    `<div><dt>Status</dt><dd>validation passed</dd></div>`,
  ].join('');

  preview.hidden = false;
  preview.src = result.previewUrl;
  preview.poster = '';
  preview.controls = true;
  if(result.inputKind === 'audio'){
    preview.classList.add('is-audio');
  }else{
    preview.classList.remove('is-audio');
  }
  preview.load();
  renderGenerateButton();
}

async function validateCandidate({ blob, sourceLabel }){
  clearValidationResult();
  setStatus(PROCESSING_MESSAGE, 'processing');
  try{
    await ensureSessionStarted();
    const result = await validateSelectedMedia({
      blob,
      mode: state.activeMode,
      sourceLabel,
    });
    state.validatedMedia = result;
    renderValidatedMedia(result);
    setStatus('メディアの確認が完了しました。内容が良ければ作品生成へ進めます。', 'success');
  }catch(err){
    setStatus(err.message || 'メディアの確認に失敗しました。', 'error');
  }
}

function createResultCardMarkup(artwork){
  const isSelected = getSelectedArtworkId() === artwork.id;
  const videoSection = artwork.video_url
    ? `<video class="result-video" src="${artwork.video_url}" controls playsinline></video>`
    : '<p class="micro-copy">動画プレビューはまだありません。</p>';
  const uploadIssue = artwork.upload_errors?.length
    ? `<p class="status-inline" data-tone="error">${artwork.upload_errors.map((item) => item.message).join(' / ')}</p>`
    : '';
  const selectButton = isSelectionLocked()
    ? ''
    : `<button type="button" class="primary-button select-artwork-button" data-artwork-select="${artwork.id}">この作品を選ぶ</button>`;

  return `
    <article class="result-card" data-artwork-card="${artwork.id}" data-selected="${isSelected ? 'true' : 'false'}">
      <div class="section-heading">
        <div>
          <h3>Attempt ${artwork.attempt_number}</h3>
          <p class="micro-copy">Artwork ID: ${artwork.id}</p>
        </div>
        <span class="pill">${isSelected ? 'Selected' : `Try ${artwork.attempt_number}`}</span>
      </div>
      <img class="result-image" src="${artwork.image_url}" alt="Attempt ${artwork.attempt_number} preview" />
      ${videoSection}
      ${uploadIssue}
      <dl class="meta-list compact-meta">
        <div><dt>Duration</dt><dd>${artwork.duration_seconds?.toFixed ? artwork.duration_seconds.toFixed(1) : artwork.duration_seconds || '-'}s</dd></div>
        <div><dt>Aspect</dt><dd>${artwork.aspect_ratio || '-'}</dd></div>
        <div><dt>Upload</dt><dd>${artwork.upload_status || 'complete'}</dd></div>
      </dl>
      ${selectButton}
    </article>
  `;
}

function renderSelectedSummary(){
  const selectedArtwork = getArtworks().find((artwork) => artwork.id === getSelectedArtworkId());
  const container = document.getElementById('selectedSummary');
  if(!selectedArtwork){
    container.innerHTML = '<p class="micro-copy">まだ最終作品は選ばれていません。</p>';
    return;
  }
  container.innerHTML = `
    <div class="selected-summary-grid">
      <img class="selected-summary-image" src="${selectedArtwork.image_url}" alt="Selected artwork preview" />
      <div>
        <h3>選択済み作品</h3>
        <p class="micro-copy">Attempt ${selectedArtwork.attempt_number} / ${selectedArtwork.id}</p>
        <p class="micro-copy">この作品で固定されました。比較表示は残りますが、再生成や再選択はできません。</p>
      </div>
    </div>
  `;
}

function populateGiftForm(){
  const payload = state.sessionPayload || {};
  const session = payload.session || {};
  const giftMessage = payload.gift_message || {};
  const shipping = payload.shipping || {};
  document.getElementById('toNameInput').value = giftMessage.to_display_name || '';
  document.getElementById('fromNameInput').value = giftMessage.from_display_name || '';
  document.getElementById('messageInput').value = giftMessage.message || '';
  document.getElementById('recipientNameInput').value = shipping.recipient_name || '';
  document.getElementById('postalCodeInput').value = shipping.postal_code || '';
  document.getElementById('addressLine1Input').value = shipping.address_line1 || '';
  document.getElementById('addressLine2Input').value = shipping.address_line2 || '';
  document.getElementById('phoneInput').value = shipping.phone || '';
  if(session.status === 'submitted'){
    document.getElementById('giftForm').querySelectorAll('input, textarea').forEach((field) => {
      field.disabled = true;
    });
  }
}

function renderResults(){
  const artworks = getArtworks();
  const list = document.getElementById('resultsList');
  const compareCard = document.getElementById('compareCard');
  const empty = document.getElementById('resultsEmpty');

  if(!artworks.length){
    compareCard.hidden = true;
    empty.hidden = false;
    list.innerHTML = '';
    renderSelectedSummary();
    return;
  }

  compareCard.hidden = false;
  empty.hidden = true;
  list.innerHTML = artworks
    .slice()
    .sort((a, b) => a.attempt_number - b.attempt_number)
    .map((artwork) => createResultCardMarkup(artwork))
    .join('');

  for(const button of list.querySelectorAll('[data-artwork-select]')){
    button.addEventListener('click', async () => {
      if(isSelectionLocked()) return;
      const artworkId = button.dataset.artworkSelect;
      setStatus('最終作品を確定しています。', 'processing');
      try{
        await selectArtwork({ artworkId, token: state.token });
        const refreshed = await loadSession(state.token);
        state.sessionPayload = refreshed;
        setSessionState({ token: state.token, payload: refreshed });
        setStatus('最終作品を確定しました。続けてメッセージと配送先を入力してください。', 'success');
      }catch(err){
        setStatus(err.message || '作品の選択に失敗しました。', 'error');
      }
    });
  }

  renderSelectedSummary();
  populateGiftForm();
}

async function handleGenerateArtwork(){
  if(!state.validatedMedia || !canGenerateAnotherAttempt() || state.isGenerating){
    return;
  }

  state.isGenerating = true;
  renderGenerateButton();
  setStatus('作品データを保存しながら生成しています。画面を閉じないでください。', 'processing');
  try{
    const created = await generateArtworkFromMedia({
      token: state.token,
      validatedMedia: state.validatedMedia,
    });
    const refreshed = await loadSession(state.token);
    state.sessionPayload = refreshed;
    clearValidationResult();
    setSessionState({ token: state.token, payload: refreshed });

    if(created.uploadResult.errors.length){
      setStatus('画像は保存できましたが、一部アセットの保存に失敗しました。比較して問題なければ選択に進めます。', 'error');
    }else{
      setStatus('作品を保存しました。比較してよい方を選んでください。', 'success');
    }
  }catch(err){
    setStatus(err.message || '作品の生成に失敗しました。', 'error');
  }finally{
    state.isGenerating = false;
    renderGenerateButton();
  }
}

function getSelectedFile(event){
  const input = event.currentTarget;
  const file = input.files?.[0];
  if(!file) return null;
  return file;
}

async function handleFileInput(event, sourceLabel){
  const file = getSelectedFile(event);
  if(!file) return;
  await validateCandidate({
    blob: file,
    sourceLabel: `${sourceLabel}: ${file.name}`,
  });
}

function bindModeButtons(){
  for(const button of document.querySelectorAll('[data-mode]')){
    button.addEventListener('click', () => {
      if(state.recorder?.isRecording()){
        return;
      }
      state.activeMode = button.dataset.mode;
      renderMode();
    });
  }
}

function bindFileInputs(){
  document.getElementById('audioFileInput').addEventListener('change', (event) => handleFileInput(event, '音声アップロード'));
  document.getElementById('videoFileInput').addEventListener('change', (event) => handleFileInput(event, '動画アップロード'));
}

function bindRecorderControls(){
  const livePreview = document.getElementById('livePreview');
  state.recorder = createMediaRecorderController({
    previewElement: livePreview,
    onTimerChange: renderTimer,
    onStatusChange: renderRecorderState,
    onStreamStateChange: (active) => {
      document.getElementById('previewFrame').dataset.live = active ? 'true' : 'false';
    },
  });

  document.getElementById('recordStartButton').addEventListener('click', async () => {
    clearValidationResult();
    setStatus('カメラとマイクへのアクセスを確認しています。', 'neutral');
    try{
      await ensureSessionStarted();
      await state.recorder.start();
      setStatus('録音を開始しました。', 'neutral');
    }catch(err){
      setStatus(err.message || '録音を開始できませんでした。', 'error');
    }
  });

  document.getElementById('recordStopButton').addEventListener('click', async () => {
    setStatus(PROCESSING_MESSAGE, 'processing');
    const recorded = await state.recorder.stop();
    if(recorded){
      await validateCandidate(recorded);
    }
  });
}

function bindResetButton(){
  document.getElementById('clearMediaButton').addEventListener('click', () => {
    document.getElementById('audioFileInput').value = '';
    document.getElementById('videoFileInput').value = '';
    clearValidationResult();
    setStatus('選択中のメディアをクリアしました。', 'neutral');
  });
}

function bindGenerateButton(){
  document.getElementById('generateButton').addEventListener('click', handleGenerateArtwork);
}

function collectGiftPayload(){
  return {
    token: state.token,
    message: {
      to_display_name: document.getElementById('toNameInput').value.trim(),
      from_display_name: document.getElementById('fromNameInput').value.trim(),
      message: document.getElementById('messageInput').value.trim(),
    },
    shipping: {
      recipient_name: document.getElementById('recipientNameInput').value.trim(),
      postal_code: document.getElementById('postalCodeInput').value.trim(),
      address_line1: document.getElementById('addressLine1Input').value.trim(),
      address_line2: document.getElementById('addressLine2Input').value.trim(),
      phone: document.getElementById('phoneInput').value.trim(),
    },
  };
}

function bindGiftForm(){
  document.getElementById('giftForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if(!isSelectionLocked() || state.isSubmittingGift) return;
    state.isSubmittingGift = true;
    renderGiftFormState();
    setStatus('メッセージと配送先を送信しています。', 'processing');
    try{
      await submitGift(collectGiftPayload());
      const refreshed = await loadSession(state.token);
      state.sessionPayload = refreshed;
      setSessionState({ token: state.token, payload: refreshed });
      document.getElementById('giftForm').querySelectorAll('input, textarea').forEach((field) => {
        field.disabled = true;
      });
      setStatus('送信が完了しました。LP を確認してください。', 'success');
    }catch(err){
      setStatus(err.message || '送信に失敗しました。', 'error');
    }finally{
      state.isSubmittingGift = false;
      renderGiftFormState();
    }
  });
}

async function main(){
  state.token = getToken();
  bindModeButtons();
  bindFileInputs();
  bindRecorderControls();
  bindResetButton();
  bindGenerateButton();
  bindGiftForm();
  renderMode();
  renderTimer(0);
  renderRecorderState('idle');
  renderGenerateButton();

  if(!state.token){
    setSessionState({ token: '', error: 'token query parameter is required' });
    setStatus('トークンが必要です。', 'error');
    return;
  }

  try{
    const payload = await loadSession(state.token);
    state.sessionPayload = payload;
    state.hasStartedSession = payload?.session?.status !== 'draft';
    setSessionState({ token: state.token, payload });
    setStatus('入力方法を選んでください。', 'neutral');
  }catch(err){
    setSessionState({ token: state.token, error: err.message || 'failed to load session' });
    setStatus('セッションの確認に失敗しました。', 'error');
  }
}

globalThis.addEventListener('beforeunload', () => {
  state.recorder?.cancel();
  clearValidatedMedia(state.validatedMedia);
});

main();
