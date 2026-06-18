<?php
/**
 * Plugin Name: TargX CRM — Lead Capture
 * Plugin URI:  https://targx.com
 * Description: Integra formulários Elementor com o TargX CRM via Edge Function.
 * Version:     1.0.0
 * Author:      TargX
 * License:     Proprietary
 *
 * Uso:
 *   1. Instalar e activar este plugin no WordPress.
 *   2. Definir TARGX_EDGE_URL e TARGX_ANON_KEY em wp-config.php (ver abaixo).
 *   3. No formulário Elementor, nomear os campos conforme indicado no README.
 *
 * wp-config.php:
 *   define( 'TARGX_EDGE_URL',  'https://<project>.supabase.co/functions/v1/capture-website-lead' );
 *   define( 'TARGX_ANON_KEY',  'eyJ...' );
 *   define( 'TARGX_PARTNER_ID', '' );  // UUID do partner por defeito (opcional)
 */

defined( 'ABSPATH' ) || exit;

// ---------------------------------------------------------------------------
// 1. Interceptar submit do Elementor Pro Forms
// ---------------------------------------------------------------------------
add_action( 'elementor_pro/forms/new_record', 'targx_handle_elementor_form', 10, 2 );

function targx_handle_elementor_form( $record, $handler ) {
    $edge_url = defined( 'TARGX_EDGE_URL' ) ? TARGX_EDGE_URL : '';
    $anon_key = defined( 'TARGX_ANON_KEY' ) ? TARGX_ANON_KEY : '';

    if ( empty( $edge_url ) || empty( $anon_key ) ) {
        error_log( '[TargX] TARGX_EDGE_URL ou TARGX_ANON_KEY não definidos em wp-config.php' );
        return;
    }

    // Verificar se é um formulário TargX (campo oculto targx_form=1 ou meta do form)
    $raw = $record->get( 'fields' );
    $marker = isset( $raw['targx_form'] ) ? sanitize_text_field( $raw['targx_form']['value'] ) : '';
    if ( $marker !== '1' ) {
        return; // Não é um formulário TargX — ignorar
    }

    // Mapear campos do Elementor para o payload da Edge Function
    $fields = array_map( function ( $f ) {
        return sanitize_text_field( $f['value'] );
    }, $raw );

    $payload = [
        'name'         => $fields['name']         ?? '',
        'email'        => $fields['email']         ?? '',
        'project_type' => $fields['project_type']  ?? '',
        'company'      => $fields['company']       ?? null,
        'phone'        => $fields['phone']         ?? null,
        'message'      => $fields['message']       ?? null,
        'source'       => $fields['source']        ?? 'wordpress',
        'partner_id'   => $fields['partner_id']    ?? ( defined( 'TARGX_PARTNER_ID' ) ? TARGX_PARTNER_ID : null ),
        'budget'       => $fields['budget']        ?? null,
    ];

    // Remover campos nulos
    $payload = array_filter( $payload, fn( $v ) => $v !== null && $v !== '' );

    // Validação mínima
    if ( empty( $payload['name'] ) || empty( $payload['email'] ) || empty( $payload['project_type'] ) ) {
        error_log( '[TargX] Campos obrigatórios em falta: name, email, project_type' );
        return;
    }

    // POST para a Edge Function
    $response = wp_remote_post( $edge_url, [
        'method'    => 'POST',
        'timeout'   => 15,
        'headers'   => [
            'Content-Type'  => 'application/json',
            'apikey'        => $anon_key,
            'Authorization' => 'Bearer ' . $anon_key,
        ],
        'body'      => wp_json_encode( $payload ),
    ] );

    if ( is_wp_error( $response ) ) {
        error_log( '[TargX] Erro ao enviar lead: ' . $response->get_error_message() );
    } else {
        $code = wp_remote_retrieve_response_code( $response );
        if ( $code !== 200 ) {
            $body = wp_remote_retrieve_body( $response );
            error_log( "[TargX] Edge Function devolveu HTTP $code: $body" );
        }
    }
}

// ---------------------------------------------------------------------------
// 2. Shortcode [targx_lead_form] — alternativa sem Elementor
//    Parâmetros: partner_id, source, lang (pt|en)
// ---------------------------------------------------------------------------
add_shortcode( 'targx_lead_form', 'targx_lead_form_shortcode' );

function targx_lead_form_shortcode( $atts ) {
    $atts = shortcode_atts( [
        'partner_id' => '',
        'source'     => 'website',
        'lang'       => 'pt',
    ], $atts, 'targx_lead_form' );

    $widget_url = plugin_dir_url( __FILE__ ) . 'lead-widget.html';
    $params     = http_build_query( array_filter( [
        'partner_id' => sanitize_text_field( $atts['partner_id'] ),
        'source'     => sanitize_text_field( $atts['source'] ),
        'lang'       => sanitize_text_field( $atts['lang'] ),
    ] ) );

    return sprintf(
        '<iframe src="%s" width="100%%" height="540" style="border:none;border-radius:12px;" loading="lazy" title="Formulário de contacto TargX"></iframe>',
        esc_url( $widget_url . ( $params ? "?$params" : '' ) )
    );
}

// ---------------------------------------------------------------------------
// 3. Copiar lead-widget.html para a pasta do plugin (no activate)
// ---------------------------------------------------------------------------
register_activation_hook( __FILE__, 'targx_plugin_activate' );

function targx_plugin_activate() {
    $widget_src  = WP_CONTENT_DIR . '/uploads/targx-lead-widget.html';
    $widget_dest = plugin_dir_path( __FILE__ ) . 'lead-widget.html';

    // Se ainda não existe uma cópia, criar placeholder
    if ( ! file_exists( $widget_dest ) ) {
        file_put_contents( $widget_dest, '<!-- Substituir por lead-widget.html do TargX CRM -->' );
    }
}
