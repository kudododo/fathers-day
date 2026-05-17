(function(){
  window.ECHO_GARDEN_COMMERCE_PRODUCT_STRATEGY_EXAMPLE = {
    mvpOwner: {
      echoGarden: [
        'artwork_generation',
        'artwork_export',
        'artwork_master_url',
        'handoff_payload',
        'handoff_start',
      ],
      shopify: [
        'product_type',
        'variant_id',
        'product_color',
        'product_size',
        'quantity',
        'cart',
        'checkout',
      ],
      backendOrPrintful: [
        'artwork_url_validation',
        'final_print_asset',
        'print_position',
        'print_transform',
        'logo_color',
        'order_webhook',
      ],
    },
    handoffTarget: {
      mvpRecommended: 'shopify_collection',
      alternatives: [
        'shopify_product_page',
        'shopify_customizer_page',
        'backend_relay',
      ],
    },
    defaultProductFamily: 'poster',
    aspectBucketRecommendations: {
      landscape: {
        product_family: 'poster',
        recommended_products: ['poster', 'canvas_print'],
        default_print_position: 'center',
        logo_color_rule: 'auto_by_product_color',
      },
      portrait: {
        product_family: 'poster',
        recommended_products: ['poster', 'apparel_front_print'],
        default_print_position: 'front_center',
        logo_color_rule: 'auto_by_product_color',
      },
      square: {
        product_family: 'apparel',
        recommended_products: ['t_shirt', 'tote_bag', 'sticker'],
        default_print_position: 'front_center',
        logo_color_rule: 'auto_by_product_color',
      },
    },
    optionalPayloadHints: [
      'product_family',
      'recommended_products',
      'default_print_position',
      'logo_color_rule',
    ],
    shopifyOwnedFields: [
      'product_type',
      'variant_id',
      'product_color',
      'product_size',
      'quantity',
    ],
    backendOwnedFields: [
      'print_position',
      'print_transform',
      'logo_color',
      'final_print_asset',
      'order_webhook',
    ],
  };
})();
