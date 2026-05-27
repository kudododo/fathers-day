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

function renderState({ lpId, payload, error }){
  document.getElementById('lpIdValue').textContent = lpId || '(missing)';
  document.getElementById('lpPayload').textContent = JSON.stringify(error ? { error } : payload, null, 2);
  const preview = document.getElementById('lpPreview');
  if(error){
    preview.innerHTML = `<p class="status-banner" data-tone="error">${error}</p>`;
    return;
  }
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
  if(!lpId){
    renderState({ lpId, error: 'id query parameter is required' });
    return;
  }
  try{
    const payload = await loadLp(lpId);
    renderState({ lpId, payload });
  }catch(err){
    renderState({ lpId, error: err.message || 'failed to load LP' });
  }
}

main();
