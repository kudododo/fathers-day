export const SHOPIFY_HANDOFF_SESSION_KEY = 'echo_garden_shopify_handoff_payload';
export const SHOPIFY_MVP_HANDOFF_SESSION_KEY = 'echo_garden_handoff';
export const SHOPIFY_MVP_TARGET_URL = getShopifyHandoffConfig().targetUrl;

function getShopifyHandoffConfig(){
  const commerceConfig = globalThis.ECHO_GARDEN_CONFIG?.commerce || {};
  return {
    targetUrl: commerceConfig.shopifyHandoffTargetUrl || 'https://echo-garden-stg.myshopify.com/',
    queryParam: commerceConfig.shopifyHandoffQueryParam || 'artwork_id',
    includeSerialCode: commerceConfig.includeSerialCodeInShopifyHandoff === true,
  };
}

function saveSessionPayload(storageKey, payload, storage, mode){
  if(!payload?.artwork_id) throw new Error('Shopify handoff payload is required');
  const record = {
    source: 'echo_garden',
    mode,
    stored_at: new Date().toISOString(),
    payload,
  };
  storage.setItem(storageKey, JSON.stringify(record));
  return record;
}

export function saveShopifyHandoffPayloadForDryRun(payload, storage = globalThis.sessionStorage){
  return saveSessionPayload(SHOPIFY_HANDOFF_SESSION_KEY, payload, storage, 'dry_run');
}

export function saveShopifyHandoffPayloadForMvp(payload, storage = globalThis.sessionStorage){
  return saveSessionPayload(SHOPIFY_MVP_HANDOFF_SESSION_KEY, payload, storage, 'shopify_mvp_handoff');
}

export function buildShopifyDryRunUrl(payload, destination = 'shopify-handoff-dry-run.html'){
  const url = new URL(destination, globalThis.location.href);
  url.searchParams.set('handoff', 'dry-run');
  url.searchParams.set('artwork_id', payload.artwork_id);
  return url.href;
}

export function buildShopifyMvpHandoffUrl(payload, destination = SHOPIFY_MVP_TARGET_URL){
  if(!payload?.artwork_id) throw new Error('artwork_id is required for Shopify handoff');
  const config = getShopifyHandoffConfig();
  const url = new URL(destination, globalThis.location?.href || 'http://localhost/');
  // Shopify側は query の artwork_id を主キーとして受け取り、後続で artwork 情報を取得する想定。
  url.searchParams.set(config.queryParam, payload.artwork_id);
  if(config.includeSerialCode && payload.serial_code){
    url.searchParams.set('serial_code', payload.serial_code);
  }
  return url.href;
}

export function startShopifyDryRunHandoff(payload, options = {}){
  const record = saveShopifyHandoffPayloadForDryRun(payload, options.storage || globalThis.sessionStorage);
  const url = buildShopifyDryRunUrl(payload, options.destination);
  if(options.navigate !== false){
    globalThis.location.href = url;
  }
  return {
    url,
    storage_key: SHOPIFY_HANDOFF_SESSION_KEY,
    payload: record.payload,
    stored_at: record.stored_at,
  };
}

export function startShopifyMvpHandoff(payload, options = {}){
  const record = saveShopifyHandoffPayloadForMvp(payload, options.storage || globalThis.sessionStorage);
  const url = buildShopifyMvpHandoffUrl(payload, options.destination);
  console.info('Echo Garden Shopify artwork_id handoff:', {
    url,
    artwork_id: payload.artwork_id,
    artwork_master_url: payload.artwork_master_url || null,
  });
  if(options.navigate !== false){
    globalThis.location.href = url;
  }
  return {
    url,
    storage_key: SHOPIFY_MVP_HANDOFF_SESSION_KEY,
    payload: record.payload,
    stored_at: record.stored_at,
  };
}

Object.assign(globalThis, {
  SHOPIFY_HANDOFF_SESSION_KEY,
  SHOPIFY_MVP_HANDOFF_SESSION_KEY,
  SHOPIFY_MVP_TARGET_URL,
  saveShopifyHandoffPayloadForDryRun,
  saveShopifyHandoffPayloadForMvp,
  buildShopifyDryRunUrl,
  buildShopifyMvpHandoffUrl,
  startShopifyDryRunHandoff,
  startShopifyMvpHandoff,
});
