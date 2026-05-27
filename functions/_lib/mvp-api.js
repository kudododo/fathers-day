const DEFAULT_CAMPAIGN_SLUG = 'fathers-day-2026';

function json(body, init = {}){
  const headers = new Headers(init.headers || {});
  if(!headers.has('content-type')){
    headers.set('content-type', 'application/json; charset=utf-8');
  }
  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

function errorJson(message, status = 400, extra = {}){
  return json({ error: message, ...extra }, { status });
}

function csvEscape(value){
  const text = value == null ? '' : String(value);
  if(/[",\n]/.test(text)){
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function getConfig(env){
  return {
    maxAttempts: Number(env.MAX_GENERATION_ATTEMPTS || 2),
    maxMediaDurationSeconds: Number(env.MAX_MEDIA_DURATION_SECONDS || 60),
    campaignSlug: env.CAMPAIGN_SLUG || DEFAULT_CAMPAIGN_SLUG,
    publicBaseUrl: String(env.R2_PUBLIC_BASE_URL || '').replace(/\/+$/, ''),
  };
}

function safeToken(value){
  if(typeof value !== 'string' || value.trim() === ''){
    const error = new Error('token is required');
    error.statusCode = 400;
    throw error;
  }
  return value.trim();
}

function safeLpId(value){
  if(typeof value !== 'string' || value.trim() === ''){
    const error = new Error('id query parameter is required');
    error.statusCode = 400;
    throw error;
  }
  return value.trim();
}

function safeArtworkId(value){
  if(typeof value !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(value)){
    const error = new Error('artwork_id must contain only letters, numbers, _ or -');
    error.statusCode = 400;
    throw error;
  }
  return value;
}

function normalizeSessionRecord(session){
  return {
    id: session.id,
    token: session.token,
    lp_id: session.lp_id,
    status: session.status,
    max_attempts: Number(session.max_attempts || 0),
    attempts_used: Number(session.attempts_used || 0),
    selected_artwork_id: session.selected_artwork_id || null,
    created_at: session.created_at,
    updated_at: session.updated_at,
    submitted_at: session.submitted_at || null,
  };
}

function normalizeArtworkRecord(artwork){
  return {
    id: artwork.id,
    session_id: artwork.session_id,
    attempt_number: Number(artwork.attempt_number || 0),
    image_url: artwork.image_url || null,
    video_url: artwork.video_url || null,
    original_media_url: artwork.original_media_url || null,
    audio_url: artwork.audio_url || null,
    thumbnail_url: artwork.thumbnail_url || null,
    media_type: artwork.media_type || null,
    duration_seconds: artwork.duration_seconds == null ? null : Number(artwork.duration_seconds),
    width: artwork.width == null ? null : Number(artwork.width),
    height: artwork.height == null ? null : Number(artwork.height),
    aspect_ratio: artwork.aspect_ratio || null,
    status: artwork.status || 'created',
    created_at: artwork.created_at,
  };
}

async function getSessionByToken(env, token){
  const normalizedToken = safeToken(token);
  const existing = await env.DB.prepare(
    `SELECT id, token, lp_id, status, max_attempts, attempts_used, selected_artwork_id, created_at, updated_at, submitted_at
     FROM gift_sessions
     WHERE token = ?1`
  ).bind(normalizedToken).first();
  if(existing){
    return normalizeSessionRecord(existing);
  }
  if(normalizedToken !== 'test'){
    return null;
  }
  const now = new Date().toISOString();
  const session = {
    id: 'sess_test',
    token: 'test',
    lp_id: 'test',
    status: 'draft',
    max_attempts: getConfig(env).maxAttempts,
    attempts_used: 0,
    selected_artwork_id: null,
    created_at: now,
    updated_at: now,
    submitted_at: null,
  };
  await env.DB.prepare(
    `INSERT OR IGNORE INTO gift_sessions
     (id, token, lp_id, status, max_attempts, attempts_used, selected_artwork_id, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
  ).bind(
    session.id,
    session.token,
    session.lp_id,
    session.status,
    session.max_attempts,
    session.attempts_used,
    session.selected_artwork_id,
    session.created_at,
    session.updated_at,
  ).run();
  return normalizeSessionRecord((await env.DB.prepare(
    `SELECT id, token, lp_id, status, max_attempts, attempts_used, selected_artwork_id, created_at, updated_at, submitted_at
     FROM gift_sessions
     WHERE token = ?1`
  ).bind('test').first()) || session);
}

async function getSessionByLpId(env, lpId){
  const normalizedLpId = safeLpId(lpId);
  const row = await env.DB.prepare(
    `SELECT id, token, lp_id, status, max_attempts, attempts_used, selected_artwork_id, created_at, updated_at, submitted_at
     FROM gift_sessions
     WHERE lp_id = ?1`
  ).bind(normalizedLpId).first();
  return row ? normalizeSessionRecord(row) : null;
}

async function listArtworksBySessionId(env, sessionId){
  const result = await env.DB.prepare(
    `SELECT id, session_id, attempt_number, image_url, video_url, original_media_url, audio_url, thumbnail_url,
            media_type, duration_seconds, width, height, aspect_ratio, status, created_at
     FROM artworks
     WHERE session_id = ?1
     ORDER BY attempt_number ASC, created_at ASC`
  ).bind(sessionId).all();
  return (result.results || []).map(normalizeArtworkRecord);
}

async function buildSessionPayload(env, session){
  const giftMessage = await env.DB.prepare(
    `SELECT to_display_name, from_display_name, message
     FROM gift_messages
     WHERE session_id = ?1`
  ).bind(session.id).first();
  const shipping = await env.DB.prepare(
    `SELECT recipient_name, postal_code, address_line1, address_line2, phone
     FROM shipping_addresses
     WHERE session_id = ?1`
  ).bind(session.id).first();
  return {
    session,
    artworks: await listArtworksBySessionId(env, session.id),
    gift_message: giftMessage ? {
      to_display_name: giftMessage.to_display_name,
      from_display_name: giftMessage.from_display_name,
      message: giftMessage.message,
    } : null,
    shipping: shipping ? {
      recipient_name: shipping.recipient_name,
      postal_code: shipping.postal_code,
      address_line1: shipping.address_line1,
      address_line2: shipping.address_line2 || '',
      phone: shipping.phone || '',
    } : null,
  };
}

async function buildLpPayload(env, session){
  const message = await env.DB.prepare(
    `SELECT to_display_name, from_display_name, message
     FROM gift_messages
     WHERE session_id = ?1`
  ).bind(session.id).first();
  const selectedArtwork = session.selected_artwork_id
    ? await env.DB.prepare(
      `SELECT image_url, video_url
       FROM artworks
       WHERE id = ?1 AND session_id = ?2`
    ).bind(session.selected_artwork_id, session.id).first()
    : null;

  return {
    lp_id: session.lp_id,
    to_display_name: message?.to_display_name || 'お父さんへ',
    from_display_name: message?.from_display_name || 'Echo Garden',
    message: message?.message || 'Father’s Day MVP placeholder',
    image_url: selectedArtwork?.image_url || null,
    video_url: selectedArtwork?.video_url || null,
  };
}

function ensureSessionMutable(session){
  if(session.status === 'selected' || session.status === 'submitted'){
    const error = new Error('session is already locked');
    error.statusCode = 409;
    throw error;
  }
}

async function ensureArtworkBelongsToSession(env, artworkId, session){
  const artwork = await env.DB.prepare(
    `SELECT id, session_id, attempt_number, image_url, video_url, original_media_url, audio_url, thumbnail_url,
            media_type, duration_seconds, width, height, aspect_ratio, status, created_at
     FROM artworks
     WHERE id = ?1 AND session_id = ?2`
  ).bind(artworkId, session.id).first();
  if(!artwork){
    const error = new Error('artwork not found for token');
    error.statusCode = 404;
    throw error;
  }
  return normalizeArtworkRecord(artwork);
}

async function parseJson(request){
  try{
    return await request.json();
  }catch{
    const error = new Error('invalid JSON body');
    error.statusCode = 400;
    throw error;
  }
}

function guessFileExtension(contentType, fileName = ''){
  const extensionMap = {
    'image/png': 'png',
    'video/webm': 'webm',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
  };
  if(extensionMap[contentType]) return extensionMap[contentType];
  const match = /\.([a-z0-9]{2,5})$/i.exec(fileName);
  return match?.[1]?.toLowerCase() || 'bin';
}

function sanitizeFileSegment(value, fallback = 'asset'){
  const normalized = String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

const UPLOAD_KINDS = {
  image: {
    directory: 'images',
    responseUrlField: 'image_url',
    allowedTypes: ['image/png'],
  },
  video: {
    directory: 'video',
    responseUrlField: 'video_url',
    allowedTypes: ['video/webm', 'video/mp4', 'video/quicktime'],
  },
  audio: {
    directory: 'audio',
    responseUrlField: 'audio_url',
    allowedTypes: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/x-m4a'],
  },
  original: {
    directory: 'originals',
    responseUrlField: 'original_media_url',
    allowedTypes: [
      'video/webm',
      'video/mp4',
      'video/quicktime',
      'audio/mpeg',
      'audio/mp4',
      'audio/wav',
      'audio/webm',
      'audio/x-m4a',
      'image/png',
    ],
  },
  legacy_image: {
    directory: 'artworks',
    responseUrlField: 'artwork_master_url',
    allowedTypes: ['image/png'],
    fileName: 'master.png',
  },
};

function buildAssetKey({ env, assetKind, artworkId, contentType, fileName }){
  const spec = UPLOAD_KINDS[assetKind];
  if(!spec){
    const error = new Error(`unsupported asset kind: ${assetKind}`);
    error.statusCode = 400;
    throw error;
  }
  if(spec.fileName){
    return `${spec.directory}/${artworkId}/${spec.fileName}`;
  }
  const extension = guessFileExtension(contentType, fileName);
  const safeName = sanitizeFileSegment(fileName.replace(/\.[^.]+$/, '') || assetKind, assetKind);
  return `${getConfig(env).campaignSlug}/${spec.directory}/${artworkId}/${safeName}.${extension}`;
}

async function uploadAssetToR2({ env, assetKind, file, metadata }){
  const spec = UPLOAD_KINDS[assetKind];
  if(!spec){
    throw new Error(`unsupported asset kind: ${assetKind}`);
  }
  const contentType = file.type || 'application/octet-stream';
  if(!spec.allowedTypes.includes(contentType)){
    const error = new Error(`${assetKind} must be one of: ${spec.allowedTypes.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }
  const artworkId = safeArtworkId(metadata?.artwork_id || metadata?.artworkId);
  const key = buildAssetKey({
    env,
    assetKind,
    artworkId,
    contentType,
    fileName: file.name || '',
  });
  await env.ARTWORKS_BUCKET.put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType,
    },
  });
  const publicBaseUrl = getConfig(env).publicBaseUrl;
  const publicUrl = publicBaseUrl ? `${publicBaseUrl}/${key}` : null;
  const response = {
    provider: 'cloudflare_r2',
    artwork_id: artworkId,
    serial_code: metadata?.serial_code || metadata?.serialCode || null,
    asset_kind: assetKind,
    key,
    stored_at: new Date().toISOString(),
    byte_size: file.size,
    content_type: contentType,
  };
  response[spec.responseUrlField] = publicUrl;
  if(assetKind === 'legacy_image'){
    response.artwork_master_url = publicUrl;
  }
  return response;
}

export async function handleGetSession(context){
  try{
    const token = safeToken(new URL(context.request.url).searchParams.get('token'));
    const session = await getSessionByToken(context.env, token);
    if(!session){
      return errorJson('session not found', 404);
    }
    return json(await buildSessionPayload(context.env, session));
  }catch(error){
    return errorJson(error.message, error.statusCode || 400);
  }
}

export async function handleGetLp(context){
  try{
    const id = safeLpId(new URL(context.request.url).searchParams.get('id'));
    const session = await getSessionByLpId(context.env, id);
    if(!session){
      return errorJson('lp not found', 404);
    }
    return json(await buildLpPayload(context.env, session), {
      headers: {
        'x-robots-tag': 'noindex, nofollow',
      },
    });
  }catch(error){
    return errorJson(error.message, error.statusCode || 400);
  }
}

export async function handleCreateArtwork(context){
  try{
    const body = await parseJson(context.request);
    const token = safeToken(body.token);
    const session = await getSessionByToken(context.env, token);
    if(!session){
      return errorJson('session not found', 404);
    }
    ensureSessionMutable(session);
    if(session.attempts_used >= session.max_attempts){
      return errorJson('generation limit reached', 409);
    }
    const nextAttemptNumber = session.attempts_used + 1;
    const artworkId = safeArtworkId(body.artwork_id || `art_${session.id}_${nextAttemptNumber}`);
    const now = new Date().toISOString();
    await context.env.DB.batch([
      context.env.DB.prepare(
        `INSERT INTO artworks
         (id, session_id, attempt_number, image_url, video_url, original_media_url, audio_url,
          media_type, duration_seconds, width, height, aspect_ratio, status, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`
      ).bind(
        artworkId,
        session.id,
        nextAttemptNumber,
        body.image_url || null,
        body.video_url || null,
        body.original_media_url || null,
        body.audio_url || null,
        body.media_type || null,
        body.duration_seconds ?? null,
        body.width ?? null,
        body.height ?? null,
        body.aspect_ratio || null,
        'created',
        now,
      ),
      context.env.DB.prepare(
        `UPDATE gift_sessions
         SET attempts_used = ?1,
             status = ?2,
             updated_at = ?3
         WHERE id = ?4`
      ).bind(
        nextAttemptNumber,
        nextAttemptNumber >= 2 ? 'generated_2' : 'generated_1',
        now,
        session.id,
      ),
    ]);
    const updatedSession = await getSessionByToken(context.env, token);
    const artwork = await ensureArtworkBelongsToSession(context.env, artworkId, updatedSession);
    return json({
      artwork,
      session: (await buildSessionPayload(context.env, updatedSession)).session,
    }, { status: 201 });
  }catch(error){
    return errorJson(error.message || 'failed to create artwork', error.statusCode || 400);
  }
}

export async function handleSelectArtwork(context, artworkId){
  try{
    const body = await parseJson(context.request);
    const token = safeToken(body.token);
    const session = await getSessionByToken(context.env, token);
    if(!session){
      return errorJson('session not found', 404);
    }
    if(session.status === 'submitted' || session.status === 'selected' || session.selected_artwork_id){
      return errorJson('session already selected', 409);
    }
    const artwork = await ensureArtworkBelongsToSession(context.env, artworkId, session);
    const now = new Date().toISOString();
    await context.env.DB.prepare(
      `UPDATE gift_sessions
       SET selected_artwork_id = ?1,
           status = 'selected',
           updated_at = ?2
       WHERE id = ?3`
    ).bind(artwork.id, now, session.id).run();
    const updatedSession = await getSessionByToken(context.env, token);
    return json({
      ok: true,
      artwork_id: artwork.id,
      session: (await buildSessionPayload(context.env, updatedSession)).session,
    });
  }catch(error){
    return errorJson(error.message || 'failed to select artwork', error.statusCode || 400);
  }
}

export async function handleGiftSubmit(context){
  try{
    const body = await parseJson(context.request);
    const token = safeToken(body.token);
    const session = await getSessionByToken(context.env, token);
    if(!session){
      return errorJson('session not found', 404);
    }
    if(!session.selected_artwork_id){
      return errorJson('selected_artwork_id is required before submit', 409);
    }
    const message = body.message || {};
    const shipping = body.shipping || {};
    if(!message.to_display_name || !message.from_display_name || !message.message){
      return errorJson('message fields are required', 400);
    }
    if(!shipping.recipient_name || !shipping.postal_code || !shipping.address_line1){
      return errorJson('shipping fields are required', 400);
    }
    const now = new Date().toISOString();
    await context.env.DB.batch([
      context.env.DB.prepare(
        `INSERT INTO gift_messages
         (id, session_id, to_display_name, from_display_name, message, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(session_id) DO UPDATE SET
           to_display_name = excluded.to_display_name,
           from_display_name = excluded.from_display_name,
           message = excluded.message,
           updated_at = excluded.updated_at`
      ).bind(
        `msg_${session.id}`,
        session.id,
        message.to_display_name,
        message.from_display_name,
        message.message,
        now,
        now,
      ),
      context.env.DB.prepare(
        `INSERT INTO shipping_addresses
         (id, session_id, recipient_name, postal_code, address_line1, address_line2, phone, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT(session_id) DO UPDATE SET
           recipient_name = excluded.recipient_name,
           postal_code = excluded.postal_code,
           address_line1 = excluded.address_line1,
           address_line2 = excluded.address_line2,
           phone = excluded.phone,
           updated_at = excluded.updated_at`
      ).bind(
        `ship_${session.id}`,
        session.id,
        shipping.recipient_name,
        shipping.postal_code,
        shipping.address_line1,
        shipping.address_line2 || '',
        shipping.phone || null,
        now,
        now,
      ),
      context.env.DB.prepare(
        `UPDATE gift_sessions
         SET status = 'submitted',
             submitted_at = ?1,
             updated_at = ?1
         WHERE id = ?2`
      ).bind(now, session.id),
    ]);
    const updatedSession = await getSessionByToken(context.env, token);
    return json({
      ok: true,
      session: (await buildSessionPayload(context.env, updatedSession)).session,
      lp: await buildLpPayload(context.env, updatedSession),
    });
  }catch(error){
    return errorJson(error.message || 'failed to submit gift', error.statusCode || 400);
  }
}

export async function handleUpload(context, legacyImage = false){
  try{
    const formData = await context.request.formData();
    const file = formData.get(legacyImage ? 'image' : 'file');
    const metadataText = formData.get('metadata');
    if(!file || typeof file.arrayBuffer !== 'function'){
      return errorJson('upload file is required', 400);
    }
    if(typeof metadataText !== 'string' || metadataText.trim() === ''){
      return errorJson('metadata JSON is required', 400);
    }
    const metadata = JSON.parse(metadataText);
    const assetKind = legacyImage ? 'legacy_image' : (metadata?.asset_kind || 'original');
    return json(await uploadAssetToR2({
      env: context.env,
      assetKind,
      file,
      metadata,
    }));
  }catch(error){
    return errorJson(
      error.message || 'R2 asset upload failed',
      error.statusCode || 500,
      legacyImage ? {} : {
        retryable: true,
        user_message: 'アップロードに失敗しました。通信状態を確認して、もう一度お試しください。',
      }
    );
  }
}

export async function handleOfficeExport(context){
  const secret = context.request.headers.get('x-office-export-secret')
    || new URL(context.request.url).searchParams.get('secret');
  if(!context.env.OFFICE_EXPORT_SECRET || secret !== context.env.OFFICE_EXPORT_SECRET){
    return new Response('Forbidden', { status: 403 });
  }

  const rows = await context.env.DB.prepare(
    `SELECT
       gs.id AS session_id,
       gs.lp_id AS lp_id,
       gm.to_display_name AS to_display_name,
       gm.from_display_name AS from_display_name,
       gm.message AS message,
       sa.recipient_name AS recipient_name,
       sa.postal_code AS postal_code,
       sa.address_line1 AS address_line1,
       sa.address_line2 AS address_line2,
       sa.shipping_status AS shipping_status,
       a.image_url AS image_url,
       a.video_url AS video_url
     FROM gift_sessions gs
     LEFT JOIN gift_messages gm ON gm.session_id = gs.id
     LEFT JOIN shipping_addresses sa ON sa.session_id = gs.id
     LEFT JOIN artworks a ON a.id = gs.selected_artwork_id
     WHERE gs.status IN ('selected', 'submitted')
     ORDER BY gs.created_at DESC`
  ).all();

  const appBaseUrl = String(context.env.APP_BASE_URL || '').replace(/\/+$/, '');
  const header = [
    'session_id',
    'lp_id',
    'lp_url',
    'qr_target_url',
    'to_display_name',
    'from_display_name',
    'message',
    'recipient_name',
    'postal_code',
    'address_line1',
    'address_line2',
    'image_url',
    'video_url',
    'shipping_status',
  ];
  const lines = [header.join(',')];

  for(const row of rows.results || []){
    const lpUrl = row.lp_id && appBaseUrl ? `${appBaseUrl}/lp/?id=${row.lp_id}` : '';
    const values = [
      row.session_id,
      row.lp_id,
      lpUrl,
      lpUrl,
      row.to_display_name,
      row.from_display_name,
      row.message,
      row.recipient_name,
      row.postal_code,
      row.address_line1,
      row.address_line2,
      row.image_url,
      row.video_url,
      row.shipping_status || 'unshipped',
    ].map(csvEscape);
    lines.push(values.join(','));
  }

  return new Response(lines.join('\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="office-export.csv"',
      'cache-control': 'no-store',
    },
  });
}
