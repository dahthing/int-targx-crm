# TargX CRM — Plugin WordPress

Integração entre WordPress + Elementor Pro e o TargX CRM.

---

## Instalação

1. Copiar a pasta `targx-crm-leads/` para `wp-content/plugins/`
2. Copiar `lead-widget.html` (de `targx-crm/public/lead-widget/`) para dentro da pasta do plugin
3. Activar o plugin em **WordPress → Plugins**
4. Adicionar ao `wp-config.php`:

```php
define( 'TARGX_EDGE_URL',   'https://<project-ref>.supabase.co/functions/v1/capture-website-lead' );
define( 'TARGX_ANON_KEY',   'eyJ...' );      // Supabase anon key (pública, segura)
define( 'TARGX_PARTNER_ID', '' );            // UUID do partner por defeito (opcional)
```

---

## Opção A — Elementor Pro Forms (recomendada)

### Criar o formulário

No Elementor Pro → widget **Form**:

| ID do campo (obrigatório) | Label sugerido | Tipo | Obrigatório |
|---|---|---|---|
| `name` | Nome | Text | ✅ |
| `email` | Email | Email | ✅ |
| `project_type` | Tipo de projecto | Select | ✅ |
| `company` | Empresa | Text | — |
| `phone` | Telefone | Tel | — |
| `budget` | Orçamento estimado | Select | — |
| `message` | Mensagem | Textarea | — |
| `targx_form` | *(oculto)* | Hidden | — |
| `source` | *(oculto)* | Hidden | — |
| `partner_id` | *(oculto)* | Hidden | — |

> **Campos ocultos obrigatórios:**
> - `targx_form` → valor `1` (identifica o formulário para o plugin)
> - `source` → valor `wordpress` (ou `website`, `landing`, etc.)
> - `partner_id` → UUID do partner (deixar vazio para usar o default do wp-config)

### Valores para o campo `project_type`

```
ecommerce, website, app_mobile, erp, crm, bi, consultoria, outro
```

### Valores para o campo `budget`

```
<5k, 5k-15k, 15k-30k, 30k-75k, 75k+
```

### Activar o plugin na aba Actions

Nas definições do formulário → **Actions After Submit**:
- Remover (ou manter) o action "Email"
- O plugin intercepta automaticamente via `elementor_pro/forms/new_record`
- **Não é necessário configurar Webhook** — o PHP faz o POST para a Edge Function

---

## Opção B — Shortcode (sem Elementor, ou como fallback)

Usa o `lead-widget.html` como iframe:

```
[targx_lead_form]
[targx_lead_form partner_id="uuid-do-partner"]
[targx_lead_form source="landing-page" lang="en"]
```

Parâmetros disponíveis:
- `partner_id` — UUID do partner (opcional)
- `source` — origem do lead (default: `website`)
- `lang` — idioma `pt` ou `en` (default: `pt`)

---

## Opção C — Webhook nativo do Elementor Pro (zero PHP)

Se preferires não usar o plugin PHP, o Elementor Pro tem uma Action **"Webhook"** built-in:

1. No formulário → **Actions After Submit** → adicionar **Webhook**
2. URL: `https://<project>.supabase.co/functions/v1/capture-website-lead`
3. Método: `POST`
4. Headers:
   - `Content-Type: application/json`
   - `apikey: eyJ...` (anon key)
   - `Authorization: Bearer eyJ...`
5. Body format: **JSON**
6. Mapear campos:
   ```json
   {
     "name":         "{{form:name}}",
     "email":        "{{form:email}}",
     "project_type": "{{form:project_type}}",
     "company":      "{{form:company}}",
     "phone":        "{{form:phone}}",
     "message":      "{{form:message}}",
     "source":       "wordpress"
   }
   ```

> **Nota:** esta opção não depende do plugin PHP. O plugin só é necessário para a Opção A (intercepção automática) ou B (shortcode).

---

## Verificar se está a funcionar

1. Submeter o formulário de teste
2. No TargX CRM → **Leads** → deve aparecer um novo lead com status "Nova" e source "wordpress"
3. O admin recebe notificação em tempo real (Bell)
4. O cliente recebe email de confirmação de `hello@targx.com`

---

## Estrutura da pasta do plugin

```
targx-crm-leads/
├── targx-crm-leads.php   — plugin principal (shortcode + Elementor hook)
├── lead-widget.html      — copiar de targx-crm/public/lead-widget/ (usado pelo shortcode)
└── README.md             — este ficheiro
```
