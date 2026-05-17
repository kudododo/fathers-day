export const ECHO_GARDEN_HANDOFF_SESSION_KEY = 'echo_garden_handoff';
export const ECHO_GARDEN_DRY_RUN_SESSION_KEY = 'echo_garden_shopify_handoff_payload';

const REQUIRED_ARTWORK_FIELDS = [
  'artwork_id',
  'serial_code',
  'artwork_master_url',
  'aspect_bucket',
  'render_preset',
  'created_at',
  'version',
  'source_app',
];

function parseStoredRecord(rawText, storageKey){
  if(!rawText) return null;
  try{
    const parsed = JSON.parse(rawText);
    const payload = parsed?.payload || parsed;
    return {
      source: parsed?.source || 'echo_garden',
      mode: parsed?.mode || 'unknown',
      storage_key: storageKey,
      stored_at: parsed?.stored_at || null,
      payload,
      raw: parsed,
    };
  }catch(err){
    return {
      source: 'echo_garden',
      mode: 'parse_error',
      storage_key: storageKey,
      stored_at: null,
      payload: null,
      raw: rawText,
      error: err,
    };
  }
}

function getSearchParam(name, locationRef = globalThis.location){
  try{
    return new URL(locationRef.href).searchParams.get(name);
  }catch(_err){
    return null;
  }
}

function collectMissingPayloadFields(payload){
  return REQUIRED_ARTWORK_FIELDS.filter((field) => payload[field] == null || payload[field] === '');
}

function buildFallbackPayloadFromQuery(locationRef = globalThis.location){
  const artworkId = getSearchParam('artwork_id', locationRef);
  if(!artworkId) return null;
  return {
    artwork_id: artworkId,
    serial_code: null,
    artwork_master_url: null,
    aspect_bucket: null,
    render_preset: null,
    mode_preset: null,
    created_at: null,
    version: null,
    source_app: 'echo_garden',
    handoff_status: 'query_only',
  };
}

export function normalizeEchoGardenPayload(payload = {}){
  const normalized = {
    schema_version: payload.schema_version || null,
    handoff_type: payload.handoff_type || 'shopify_productize',
    handoff_status: payload.handoff_status || 'received',
    handoff_created_at: payload.handoff_created_at || null,
    artwork_id: payload.artwork_id || null,
    serial_code: payload.serial_code || null,
    artwork_master_url: payload.artwork_master_url || null,
    aspect_bucket: payload.aspect_bucket || null,
    render_preset: payload.render_preset || payload.mode || null,
    mode_preset: payload.mode_preset || payload.mode || null,
    created_at: payload.created_at || null,
    version: payload.version || null,
    source_app: payload.source_app || 'echo_garden',
    export_size: payload.export_size || null,
    export_info: payload.export_info || null,
    metadata_version: payload.metadata_version || null,
    product_selection: payload.product_selection || {},
    print_options: payload.print_options || {},
    metadata: payload.metadata || null,
  };
  const missing_required_fields = collectMissingPayloadFields(normalized);
  return {
    ...normalized,
    missing_required_fields,
    is_valid_artwork_payload: missing_required_fields.length === 0,
  };
}

export function hasValidArtworkPayload(handoff){
  return Boolean(handoff?.payload?.is_valid_artwork_payload);
}

export function getEchoGardenHandoff({
  storage = globalThis.sessionStorage,
  locationRef = globalThis.location,
  keys = [ECHO_GARDEN_HANDOFF_SESSION_KEY, ECHO_GARDEN_DRY_RUN_SESSION_KEY],
} = {}){
  let record = null;
  for(const storageKey of keys){
    record = parseStoredRecord(storage.getItem(storageKey), storageKey);
    if(record) break;
  }

  if(!record){
    const queryPayload = buildFallbackPayloadFromQuery(locationRef);
    if(queryPayload){
      record = {
        source: 'echo_garden',
        mode: 'query_fallback',
        storage_key: null,
        stored_at: null,
        payload: queryPayload,
        raw: queryPayload,
      };
    }
  }

  if(!record){
    return {
      status: 'missing',
      source: 'echo_garden',
      mode: 'none',
      storage_key: null,
      stored_at: null,
      payload: normalizeEchoGardenPayload({}),
      raw: null,
      error: null,
    };
  }

  if(record.error){
    return {
      status: 'error',
      ...record,
      payload: normalizeEchoGardenPayload({}),
    };
  }

  const payload = normalizeEchoGardenPayload(record.payload || {});
  return {
    status: payload.is_valid_artwork_payload ? 'ready' : 'incomplete',
    ...record,
    payload,
    error: null,
  };
}

Object.assign(globalThis, {
  ECHO_GARDEN_HANDOFF_SESSION_KEY,
  ECHO_GARDEN_DRY_RUN_SESSION_KEY,
  getEchoGardenHandoff,
  normalizeEchoGardenPayload,
  hasValidArtworkPayload,
});
