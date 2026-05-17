const SHOPIFY_HANDOFF_SCHEMA_VERSION = '1.0.0';

function getArtworkMasterUrl(metadata = {}, storageResult = {}){
  return storageResult?.artwork_master_url ||
    metadata?.artwork_master_url ||
    metadata?.storage_info?.artwork_master_url ||
    metadata?.productize_info?.artwork_master_url ||
    null;
}

function getExportSize(metadata = {}){
  return metadata?.export_info?.export_size ||
    metadata?.export?.exportSize ||
    metadata?.canvas_size?.size ||
    null;
}

function collectMissingRequiredFields(payload){
  return [
    'artwork_id',
    'serial_code',
    'artwork_master_url',
    'aspect_bucket',
    'render_preset',
    'created_at',
    'version',
    'source_app',
  ].filter((key) => payload[key] == null || payload[key] === '');
}

export function buildShopifyHandoffPayload({
  metadata = {},
  storageResult = null,
  product = {},
  print = {},
  createdAt = new Date().toISOString(),
  includeMetadata = false,
} = {}){
  const handoffPayload = {
    schema_version: SHOPIFY_HANDOFF_SCHEMA_VERSION,
    handoff_type: 'shopify_productize',
    handoff_status: 'dry_run_ready',
    handoff_created_at: createdAt,

    artwork_id: metadata.artwork_id || metadata.artworkId || storageResult?.artwork_id || null,
    serial_code: metadata.serial_code || metadata.serialCode || null,
    artwork_master_url: getArtworkMasterUrl(metadata, storageResult),
    aspect_bucket: metadata.aspect_bucket || metadata.canvas?.aspectBucket || null,
    render_preset: metadata.render_preset || metadata.preset_config?.render_preset?.id || null,
    mode_preset: metadata.mode_preset || metadata.preset_config?.mode_preset?.id || null,
    created_at: metadata.created_at || metadata.createdAt || metadata.timestamp || null,
    version: metadata.version ?? null,
    source_app: metadata.source_app || 'echo_garden',

    export_size: getExportSize(metadata),
    export_info: metadata.export_info || null,
    metadata_version: metadata.schema_version || metadata.schemaVersion || null,

    product_selection: {
      product_type: product.product_type ?? null,
      variant_id: product.variant_id ?? null,
      product_color: product.product_color ?? null,
      product_size: product.product_size ?? null,
    },
    print_options: {
      print_position: print.print_position ?? null,
      print_transform: print.print_transform ?? null,
      logo_color: print.logo_color ?? null,
    },
    responsibility_boundary: {
      echo_garden: [
        'artwork_id',
        'serial_code',
        'artwork_master_url',
        'aspect_bucket',
        'render_preset',
        'export_info',
      ],
      shopify: [
        'product_type',
        'variant_id',
        'product_color',
        'product_size',
        'cart',
        'checkout',
      ],
      backend_or_printful: [
        'artwork_url_validation',
        'final_print_asset',
        'print_position',
        'print_transform',
        'order_webhook',
      ],
    },
  };

  const missing = collectMissingRequiredFields(handoffPayload);
  if(missing.length > 0){
    throw new Error(`Shopify handoff payload missing required fields: ${missing.join(', ')}`);
  }

  if(includeMetadata){
    handoffPayload.metadata = metadata;
  }

  return handoffPayload;
}

Object.assign(globalThis, {
  buildShopifyHandoffPayload,
});
