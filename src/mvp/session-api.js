export async function loadSession(token){
  const response = await fetch(`/api/session?token=${encodeURIComponent(token)}`);
  const payload = await response.json();
  if(!response.ok){
    throw new Error(payload?.error || 'failed to load session');
  }
  return payload;
}

export async function startSession(token){
  const response = await fetch('/api/session/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  });
  const payload = await response.json();
  if(!response.ok){
    throw new Error(payload?.error || 'failed to start session');
  }
  return payload;
}

export async function createArtworkAttempt(payload){
  const response = await fetch('/api/artworks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if(!response.ok){
    throw new Error(data?.error || 'failed to create artwork attempt');
  }
  return data;
}

export async function selectArtwork({ artworkId, token }){
  const response = await fetch(`/api/artworks/${encodeURIComponent(artworkId)}/select`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  });
  const data = await response.json();
  if(!response.ok){
    throw new Error(data?.error || 'failed to select artwork');
  }
  return data;
}

export async function submitGift(payload){
  const response = await fetch('/api/gift/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if(!response.ok){
    throw new Error(data?.error || 'failed to submit gift');
  }
  return data;
}
