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
