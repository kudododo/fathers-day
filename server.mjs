import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT_DIR = resolve(__dirname);
const PORT = Number(process.env.PORT || 4173);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function loadDotEnv(filePath = join(ROOT_DIR, '.env')){
  if(!existsSync(filePath)) return;
  const text = readFileSync(filePath, 'utf8');
  for(const line of text.split(/\r?\n/)){
    const trimmed = line.trim();
    if(!trimmed || trimmed.startsWith('#')) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if(!match) continue;
    const [, key, rawValue] = match;
    if(process.env[key] != null) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
}

loadDotEnv();

function requireEnv(name){
  const value = process.env[name];
  if(!value) throw new Error(`${name} is required`);
  return value;
}

function getR2Config(){
  return {
    accountId: requireEnv('R2_ACCOUNT_ID'),
    bucketName: requireEnv('R2_BUCKET_NAME'),
    accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    publicBaseUrl: requireEnv('R2_PUBLIC_BASE_URL').replace(/\/+$/, ''),
  };
}

function getMvpConfig(){
  return {
    maxAttempts: Number(process.env.MAX_GENERATION_ATTEMPTS || 2),
    maxMediaDurationSeconds: Number(process.env.MAX_MEDIA_DURATION_SECONDS || 60),
    campaignSlug: process.env.CAMPAIGN_SLUG || 'fathers-day-2026',
  };
}

let r2Client = null;
const mvpSessions = new Map();
const mvpLpIndex = new Map();
const mvpArtworks = new Map();

function getR2Client(){
  if(r2Client) return r2Client;
  const config = getR2Config();
  r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return r2Client;
}

function jsonResponse(res, statusCode, body){
  const text = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
  });
  res.end(text);
}

function textResponse(res, statusCode, body, contentType = 'text/plain; charset=utf-8'){
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readJsonRequest(req){
  return new Promise((resolvePromise, rejectPromise) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if(body.length > 1024 * 1024){
        rejectPromise(new Error('request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try{
        resolvePromise(body ? JSON.parse(body) : {});
      }catch(err){
        rejectPromise(new Error('invalid JSON body'));
      }
    });
    req.on('error', rejectPromise);
  });
}

function getContentType(req){
  return String(req.headers['content-type'] || '').toLowerCase();
}

const LEGACY_IMAGE_UPLOAD = {
  fieldName: 'image',
  assetKind: 'legacy_image',
};

const MVP_UPLOAD_KINDS = {
  image: {
    fieldName: 'file',
    directory: 'images',
    responseUrlField: 'image_url',
    allowedTypes: ['image/png'],
  },
  video: {
    fieldName: 'file',
    directory: 'video',
    responseUrlField: 'video_url',
    allowedTypes: ['video/webm', 'video/mp4', 'video/quicktime'],
  },
  audio: {
    fieldName: 'file',
    directory: 'audio',
    responseUrlField: 'audio_url',
    allowedTypes: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/x-m4a'],
  },
  original: {
    fieldName: 'file',
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
    fieldName: 'image',
    directory: 'artworks',
    responseUrlField: 'artwork_master_url',
    allowedTypes: ['image/png'],
    fileName: 'master.png',
  },
};

function guessFileExtension(contentType, fileName = ''){
  const normalizedType = String(contentType || '').toLowerCase();
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
  if(extensionMap[normalizedType]) return extensionMap[normalizedType];
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

function createSessionRecord(token){
  const config = getMvpConfig();
  const normalizedToken = token === 'test' ? 'test' : token;
  const lpId = normalizedToken === 'test' ? 'test' : `lp_${normalizedToken}`;
  const session = {
    id: normalizedToken === 'test' ? 'sess_test' : `sess_${normalizedToken}`,
    token: normalizedToken,
    lp_id: lpId,
    status: 'draft',
    max_attempts: config.maxAttempts,
    attempts_used: 0,
    selected_artwork_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    artworks: [],
    gift_message: null,
    shipping: null,
  };
  mvpSessions.set(session.token, session);
  mvpLpIndex.set(session.lp_id, session.token);
  return session;
}

function getSessionByToken(token){
  if(typeof token !== 'string' || token.trim() === ''){
    return null;
  }
  const normalizedToken = token.trim();
  return mvpSessions.get(normalizedToken) || (normalizedToken === 'test' ? createSessionRecord(normalizedToken) : null);
}

function getSessionByLpId(lpId){
  if(typeof lpId !== 'string' || lpId.trim() === ''){
    return null;
  }
  const normalizedLpId = lpId.trim();
  const token = mvpLpIndex.get(normalizedLpId) || (normalizedLpId === 'test' ? 'test' : null);
  return token ? getSessionByToken(token) : null;
}

function buildSessionResponse(session){
  return {
    session: {
      id: session.id,
      token: session.token,
      lp_id: session.lp_id,
      status: session.status,
      max_attempts: session.max_attempts,
      attempts_used: session.attempts_used,
      selected_artwork_id: session.selected_artwork_id,
    },
    artworks: session.artworks.map((artworkId) => mvpArtworks.get(artworkId)).filter(Boolean),
  };
}

function buildLpResponse(session){
  const selectedArtwork = session.selected_artwork_id ? mvpArtworks.get(session.selected_artwork_id) : null;
  return {
    lp_id: session.lp_id,
    to_display_name: session.gift_message?.to_display_name || 'お父さんへ',
    from_display_name: session.gift_message?.from_display_name || 'Echo Garden',
    message: session.gift_message?.message || 'Father’s Day MVP placeholder',
    image_url: selectedArtwork?.image_url || null,
    video_url: selectedArtwork?.video_url || null,
  };
}

function ensureSessionAllowsArtworkMutation(session){
  if(session.status === 'selected' || session.status === 'submitted'){
    const err = new Error('session is already locked');
    err.statusCode = 409;
    throw err;
  }
}

function ensureArtworkBelongsToSession(artworkId, session){
  const artwork = mvpArtworks.get(artworkId);
  if(!artwork || artwork.session_id !== session.id){
    const err = new Error('artwork not found for token');
    err.statusCode = 404;
    throw err;
  }
  return artwork;
}

function safeArtworkId(value){
  if(typeof value !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(value)){
    throw new Error('metadata.artwork_id must contain only letters, numbers, _ or -');
  }
  return value;
}

async function readArtworkUploadRequest(req){
  return readAssetUploadRequest(req, LEGACY_IMAGE_UPLOAD);
}

async function readAssetUploadRequest(req, uploadSpec){
  const request = new Request(`http://localhost${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: req,
    duplex: 'half',
  });
  const formData = await request.formData();
  const file = formData.get(uploadSpec.fieldName);
  const metadataText = formData.get('metadata');
  if(!file || typeof file.arrayBuffer !== 'function'){
    throw new Error('upload file is required');
  }
  if(!metadataText || typeof metadataText !== 'string'){
    throw new Error('metadata JSON is required');
  }
  const metadata = JSON.parse(metadataText);
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  return {
    fileBuffer,
    metadata,
    fileName: file.name || '',
    contentType: file.type || 'application/octet-stream',
    assetKind: metadata?.asset_kind || uploadSpec.assetKind,
  };
}

function buildAssetKey({ assetKind, artworkId, contentType, fileName }){
  const config = getMvpConfig();
  const spec = MVP_UPLOAD_KINDS[assetKind];
  if(!spec){
    throw new Error(`unsupported asset kind: ${assetKind}`);
  }
  if(spec.fileName){
    return `${spec.directory}/${artworkId}/${spec.fileName}`;
  }
  const extension = guessFileExtension(contentType, fileName);
  const safeName = sanitizeFileSegment(fileName.replace(/\.[^.]+$/, '') || assetKind, assetKind);
  return `${config.campaignSlug}/${spec.directory}/${artworkId}/${safeName}.${extension}`;
}

function buildAssetResponse({ assetKind, artworkId, serialCode, key, publicUrl, contentType, byteSize, partialFailure = null }){
  const spec = MVP_UPLOAD_KINDS[assetKind];
  const response = {
    provider: 'cloudflare_r2',
    artwork_id: artworkId,
    serial_code: serialCode,
    asset_kind: assetKind,
    key,
    stored_at: new Date().toISOString(),
    byte_size: byteSize,
    content_type: contentType,
  };
  response[spec.responseUrlField] = publicUrl;
  if(assetKind === 'legacy_image'){
    response.artwork_master_url = publicUrl;
  }
  if(partialFailure){
    response.partial_failure = partialFailure;
  }
  return response;
}

async function uploadAssetToR2({ assetKind, fileBuffer, metadata, contentType, fileName }){
  const config = getR2Config();
  const client = getR2Client();
  const artworkId = safeArtworkId(metadata?.artwork_id || metadata?.artworkId);
  const serialCode = metadata?.serial_code || metadata?.serialCode || null;
  const spec = MVP_UPLOAD_KINDS[assetKind];
  if(!spec){
    throw new Error(`unsupported asset kind: ${assetKind}`);
  }
  if(!spec.allowedTypes.includes(contentType)){
    throw new Error(`${assetKind} must be one of: ${spec.allowedTypes.join(', ')}`);
  }
  const key = buildAssetKey({ assetKind, artworkId, contentType, fileName });

  await client.send(new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType || 'application/octet-stream',
  }));

  const publicUrl = `${config.publicBaseUrl}/${key}`;
  console.log('Echo Garden R2 upload:', {
    asset_kind: assetKind,
    key,
    public_url: publicUrl,
  });

  return buildAssetResponse({
    assetKind,
    artworkId,
    serialCode,
    key,
    publicUrl,
    contentType: contentType || 'application/octet-stream',
    byteSize: fileBuffer.byteLength,
  });
}

async function uploadArtworkToR2({ fileBuffer, metadata, contentType, fileName }){
  return uploadAssetToR2({
    assetKind: 'legacy_image',
    fileBuffer,
    metadata,
    contentType,
    fileName,
  });
}

async function handleArtworkUpload(req, res){
  try{
    const uploadInput = await readArtworkUploadRequest(req);
    if(uploadInput.contentType !== 'image/png'){
      throw new Error('image must be image/png');
    }
    const result = await uploadArtworkToR2(uploadInput);
    jsonResponse(res, 200, result);
  }catch(err){
    console.error('Echo Garden R2 upload failed:', err);
    const statusCode = err?.$metadata?.httpStatusCode || 500;
    jsonResponse(res, statusCode >= 400 && statusCode < 600 ? statusCode : 500, {
      error: err?.message || 'R2 upload failed',
    });
  }
}

async function handleAssetUpload(req, res){
  try{
    const uploadInput = await readAssetUploadRequest(req, {
      fieldName: 'file',
      assetKind: 'original',
    });
    const assetKind = uploadInput.metadata?.asset_kind || uploadInput.assetKind;
    const result = await uploadAssetToR2({
      assetKind,
      fileBuffer: uploadInput.fileBuffer,
      metadata: uploadInput.metadata,
      contentType: uploadInput.contentType,
      fileName: uploadInput.fileName,
    });
    jsonResponse(res, 200, result);
  }catch(err){
    console.error('Echo Garden R2 asset upload failed:', err);
    const statusCode = err?.$metadata?.httpStatusCode || 500;
    jsonResponse(res, statusCode >= 400 && statusCode < 600 ? statusCode : 500, {
      error: err?.message || 'R2 asset upload failed',
      retryable: true,
      user_message: 'アップロードに失敗しました。通信状態を確認して、もう一度お試しください。',
    });
  }
}

function safeToken(value){
  if(typeof value !== 'string' || value.trim() === ''){
    const err = new Error('token is required');
    err.statusCode = 400;
    throw err;
  }
  return value.trim();
}

async function handleGetSession(req, res){
  try{
    const requestUrl = new URL(req.url || '/api/session', 'http://localhost');
    const token = safeToken(requestUrl.searchParams.get('token'));
    const session = getSessionByToken(token);
    if(!session){
      jsonResponse(res, 404, { error: 'session not found' });
      return;
    }
    jsonResponse(res, 200, buildSessionResponse(session));
  }catch(err){
    jsonResponse(res, err.statusCode || 400, { error: err.message });
  }
}

async function handleCreateArtworkRecord(req, res){
  try{
    const body = await readJsonRequest(req);
    const token = safeToken(body.token);
    const session = getSessionByToken(token);
    if(!session){
      jsonResponse(res, 404, { error: 'session not found' });
      return;
    }
    ensureSessionAllowsArtworkMutation(session);
    if(session.attempts_used >= session.max_attempts){
      jsonResponse(res, 409, { error: 'generation limit reached' });
      return;
    }

    const nextAttemptNumber = session.attempts_used + 1;
    const artworkId = body.artwork_id || `art_${session.id}_${nextAttemptNumber}`;
    const artwork = {
      id: artworkId,
      session_id: session.id,
      attempt_number: nextAttemptNumber,
      image_url: body.image_url || null,
      video_url: body.video_url || null,
      original_media_url: body.original_media_url || null,
      audio_url: body.audio_url || null,
      duration_seconds: body.duration_seconds ?? null,
      media_type: body.media_type || null,
      width: body.width ?? null,
      height: body.height ?? null,
      aspect_ratio: body.aspect_ratio || null,
      status: 'created',
      upload_status: body.upload_status || 'complete',
      upload_errors: Array.isArray(body.upload_errors) ? body.upload_errors : [],
      created_at: new Date().toISOString(),
      limits: {
        max_attempts: session.max_attempts,
        max_media_duration_seconds: getMvpConfig().maxMediaDurationSeconds,
      },
    };

    session.attempts_used = nextAttemptNumber;
    session.status = nextAttemptNumber >= 2 ? 'generated_2' : 'generated_1';
    session.updated_at = new Date().toISOString();
    session.artworks.push(artwork.id);
    mvpArtworks.set(artwork.id, artwork);

    jsonResponse(res, 201, {
      artwork,
      session: buildSessionResponse(session).session,
    });
  }catch(err){
    jsonResponse(res, err.statusCode || 400, { error: err.message || 'failed to create artwork' });
  }
}

async function handleSelectArtwork(req, res, artworkId){
  try{
    const body = await readJsonRequest(req);
    const token = safeToken(body.token);
    const session = getSessionByToken(token);
    if(!session){
      jsonResponse(res, 404, { error: 'session not found' });
      return;
    }
    if(session.status === 'submitted' || session.status === 'selected' || session.selected_artwork_id){
      jsonResponse(res, 409, { error: 'session already selected' });
      return;
    }
    const artwork = ensureArtworkBelongsToSession(artworkId, session);
    session.selected_artwork_id = artwork.id;
    session.status = 'selected';
    session.updated_at = new Date().toISOString();
    jsonResponse(res, 200, {
      ok: true,
      artwork_id: artwork.id,
      session: buildSessionResponse(session).session,
    });
  }catch(err){
    jsonResponse(res, err.statusCode || 400, { error: err.message || 'failed to select artwork' });
  }
}

async function handleGiftSubmit(req, res){
  try{
    const body = await readJsonRequest(req);
    const token = safeToken(body.token);
    const session = getSessionByToken(token);
    if(!session){
      jsonResponse(res, 404, { error: 'session not found' });
      return;
    }
    if(!session.selected_artwork_id){
      jsonResponse(res, 409, { error: 'selected_artwork_id is required before submit' });
      return;
    }
    const message = body.message || {};
    const shipping = body.shipping || {};
    if(!message.to_display_name || !message.from_display_name || !message.message){
      jsonResponse(res, 400, { error: 'message fields are required' });
      return;
    }
    if(!shipping.recipient_name || !shipping.postal_code || !shipping.address_line1){
      jsonResponse(res, 400, { error: 'shipping fields are required' });
      return;
    }
    session.gift_message = {
      to_display_name: message.to_display_name,
      from_display_name: message.from_display_name,
      message: message.message,
    };
    session.shipping = {
      recipient_name: shipping.recipient_name,
      postal_code: shipping.postal_code,
      address_line1: shipping.address_line1,
      address_line2: shipping.address_line2 || '',
    };
    session.status = 'submitted';
    session.submitted_at = new Date().toISOString();
    session.updated_at = session.submitted_at;
    jsonResponse(res, 200, {
      ok: true,
      session: buildSessionResponse(session).session,
      lp: buildLpResponse(session),
    });
  }catch(err){
    jsonResponse(res, err.statusCode || 400, { error: err.message || 'failed to submit gift' });
  }
}

async function handleGetLp(req, res){
  try{
    const requestUrl = new URL(req.url || '/api/lp', 'http://localhost');
    const lpId = requestUrl.searchParams.get('id');
    const session = getSessionByLpId(lpId);
    if(!session){
      jsonResponse(res, 404, { error: 'lp not found' });
      return;
    }
    jsonResponse(res, 200, buildLpResponse(session));
  }catch(err){
    jsonResponse(res, err.statusCode || 400, { error: err.message || 'failed to load lp' });
  }
}

function resolveStaticPath(urlPath){
  const decodedPath = decodeURIComponent(urlPath.split('?')[0]);
  const requestedPath = decodedPath === '/' ? '/index.html' : decodedPath;
  const fullPath = normalize(join(ROOT_DIR, requestedPath));
  if(!fullPath.startsWith(ROOT_DIR)) return null;
  if(existsSync(fullPath) && statSync(fullPath).isDirectory()){
    const indexPath = join(fullPath, 'index.html');
    return existsSync(indexPath) ? indexPath : null;
  }
  if(existsSync(fullPath)) return fullPath;

  const fallbackIndexPath = normalize(join(ROOT_DIR, requestedPath, 'index.html'));
  if(fallbackIndexPath.startsWith(ROOT_DIR) && existsSync(fallbackIndexPath)){
    return fallbackIndexPath;
  }
  return fullPath;
}

function serveStatic(req, res){
  const filePath = resolveStaticPath(req.url || '/');
  if(!filePath || !existsSync(filePath)){
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  const ext = extname(filePath);
  res.writeHead(200, {
    'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
  });
  createReadStream(filePath).pipe(res);
}

const server = createServer((req, res) => {
  if(req.method === 'GET' && req.url?.startsWith('/api/session')){
    handleGetSession(req, res);
    return;
  }
  if(req.method === 'GET' && req.url?.startsWith('/api/lp')){
    handleGetLp(req, res);
    return;
  }
  if(req.method === 'POST' && req.url?.startsWith('/api/gift/submit')){
    handleGiftSubmit(req, res);
    return;
  }
  if(req.method === 'POST' && req.url?.startsWith('/api/uploads')){
    handleAssetUpload(req, res);
    return;
  }
  if(req.method === 'POST'){
    const artworkSelectMatch = /^\/api\/artworks\/([^/]+)\/select(?:\?.*)?$/.exec(req.url || '');
    if(artworkSelectMatch){
      handleSelectArtwork(req, res, decodeURIComponent(artworkSelectMatch[1]));
      return;
    }
  }
  if(req.method === 'POST' && req.url?.startsWith('/api/artworks')){
    if(getContentType(req).includes('multipart/form-data')){
      handleArtworkUpload(req, res);
      return;
    }
    handleCreateArtworkRecord(req, res);
    return;
  }
  if(req.method === 'GET' || req.method === 'HEAD'){
    serveStatic(req, res);
    return;
  }
  res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Method not allowed');
});

server.listen(PORT, () => {
  console.log(`Echo Garden server running at http://localhost:${PORT}`);
});
