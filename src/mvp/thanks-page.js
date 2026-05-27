function getLpId(){
  const params = new URLSearchParams(globalThis.location.search);
  return params.get('id') || '';
}

async function loadLp(lpId){
  const response = await fetch(`/api/lp?id=${encodeURIComponent(lpId)}`);
  const payload = await response.json();
  if(!response.ok){
    throw new Error(payload?.error || 'failed to load LP');
  }
  return payload;
}

function renderPreview(payload){
  const preview = document.getElementById('thanksPreview');
  const imageSection = payload?.image_url
    ? `<img class="selected-summary-image" src="${payload.image_url}" alt="LP image preview" />`
    : '<div><p class="micro-copy">画像はまだありません。</p></div>';
  const videoSection = payload?.video_url
    ? `<video class="result-video" src="${payload.video_url}" controls playsinline></video>`
    : '<p class="micro-copy">動画はまだありません。</p>';
  preview.innerHTML = `
    ${imageSection}
    <div>
      <p class="eyebrow">To ${payload?.to_display_name || '-'}</p>
      <h2>${payload?.message || '-'}</h2>
      <p class="micro-copy">From ${payload?.from_display_name || '-'}</p>
      ${videoSection}
    </div>
  `;
}

async function main(){
  const lpId = getLpId();
  const link = document.getElementById('thanksLpLink');
  const status = document.getElementById('thanksStatus');
  document.getElementById('thanksLpId').textContent = lpId || '(missing)';
  link.href = lpId ? `/lp/?id=${encodeURIComponent(lpId)}` : '#';
  if(!lpId){
    status.dataset.tone = 'error';
    status.textContent = 'id query parameter is required';
    return;
  }
  try{
    const payload = await loadLp(lpId);
    renderPreview(payload);
    status.dataset.tone = 'success';
    status.textContent = '公開LPの確認準備ができました。';
  }catch(err){
    status.dataset.tone = 'error';
    status.textContent = err.message || 'failed to load LP';
  }
}

main();
