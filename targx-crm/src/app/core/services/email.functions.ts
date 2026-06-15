export interface EmailPayload {
  to: string[];
  subject: string;
  html: string;
  event_key: string;
}

// ── Monthly Digest ─────────────────────────────────────────────────────────────

export function buildMonthlyDigestPayload(data: {
  partnerEmail: string;
  partnerName: string;
  month: string;
  year: number;
  volume: number;
  commission: number;
  tierRate: number;
  nextTierThreshold: number | null;
}): EmailPayload {
  const volumeFormatted = data.volume.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
  const commissionFormatted = data.commission.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
  const tierPct = (data.tierRate * 100).toFixed(1);
  const nextTierLine = data.nextTierThreshold
    ? `<p>Próximo patamar: ${data.nextTierThreshold.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</p>`
    : `<p>Atingiste o patamar máximo!</p>`;

  return {
    to: [data.partnerEmail],
    subject: `Resumo ${data.month}/${data.year} — TargX CRM`,
    html: `<h2>Resumo de ${data.month}/${data.year}</h2>
<p>Olá ${data.partnerName},</p>
<p>Volume: <strong>${volumeFormatted}</strong></p>
<p>Comissão: <strong>${commissionFormatted}</strong></p>
<p>Taxa de patamar actual: <strong>${tierPct}%</strong></p>
${nextTierLine}`,
    event_key: `monthly-digest:${data.partnerEmail}:${data.year}-${data.month}`,
  };
}

// ── Bonus Near ────────────────────────────────────────────────────────────────

export function buildBonusNearPayload(data: {
  partnerEmail: string;
  partnerName: string;
  adminEmail: string;
  threshold: number;
  bonusAmount: number;
  volumeRemaining: number;
}): EmailPayload[] {
  const thresholdFmt = data.threshold.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
  const bonusFmt = data.bonusAmount.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
  const remainingFmt = data.volumeRemaining.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
  const eventKey = `bonus-near:${data.partnerEmail}:${data.threshold}`;

  const partnerPayload: EmailPayload = {
    to: [data.partnerEmail],
    subject: `Estás perto de atingir o bónus de ${thresholdFmt}!`,
    html: `<h2>Bónus ao alcance!</h2>
<p>Olá ${data.partnerName},</p>
<p>Faltam apenas <strong>${remainingFmt}</strong> para atingires o limiar de ${thresholdFmt} e ganhares um bónus de <strong>${bonusFmt}</strong>.</p>`,
    event_key: eventKey,
  };

  const adminPayload: EmailPayload = {
    to: [data.adminEmail],
    subject: `[Admin] Parceiro ${data.partnerName} perto do bónus de ${thresholdFmt}`,
    html: `<h2>Alerta de bónus</h2>
<p>O parceiro ${data.partnerName} (${data.partnerEmail}) está a ${remainingFmt} do limiar de ${thresholdFmt} (bónus: ${bonusFmt}).</p>`,
    event_key: `${eventKey}:admin`,
  };

  return [partnerPayload, adminPayload];
}

// ── Bonus Reached ─────────────────────────────────────────────────────────────

export function buildBonusReachedPayload(data: {
  partnerEmail: string;
  partnerName: string;
  adminEmail: string;
  threshold: number;
  bonusAmount: number;
}): EmailPayload[] {
  const thresholdFmt = data.threshold.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
  const bonusFmt = data.bonusAmount.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
  const eventKey = `bonus-reached:${data.partnerEmail}:${data.threshold}`;

  const partnerPayload: EmailPayload = {
    to: [data.partnerEmail],
    subject: `Parabéns! Atingiste o bónus de ${thresholdFmt}!`,
    html: `<h2>Bónus atingido!</h2>
<p>Olá ${data.partnerName},</p>
<p>Parabéns! Atingiste o limiar de <strong>${thresholdFmt}</strong> e ganhaste um bónus de <strong>${bonusFmt}</strong>.</p>`,
    event_key: eventKey,
  };

  const adminPayload: EmailPayload = {
    to: [data.adminEmail],
    subject: `[Admin] Parceiro ${data.partnerName} atingiu bónus de ${thresholdFmt}`,
    html: `<h2>Bónus atingido</h2>
<p>O parceiro ${data.partnerName} (${data.partnerEmail}) atingiu o limiar de ${thresholdFmt}. Bónus a pagar: ${bonusFmt}.</p>`,
    event_key: `${eventKey}:admin`,
  };

  return [partnerPayload, adminPayload];
}

// ── Quote to Client ────────────────────────────────────────────────────────────

export function buildQuoteToClientPayload(data: {
  clientEmail: string;
  clientName: string;
  quoteTitle: string;
  pdfUrl: string;
  portalUrl: string;
  validUntil: string;
}): EmailPayload {
  return {
    to: [data.clientEmail],
    subject: `A sua proposta: ${data.quoteTitle}`,
    html: `<h2>Proposta Comercial</h2>
<p>Caro/a ${data.clientName},</p>
<p>Segue em anexo a proposta <strong>${data.quoteTitle}</strong>, válida até ${data.validUntil}.</p>
<p><a href="${data.pdfUrl}">Descarregar PDF</a></p>
<p><a href="${data.portalUrl}">Ver no portal</a></p>`,
    event_key: `quote-to-client:${data.clientEmail}:${data.quoteTitle}`,
  };
}

// ── Quote Expiring ─────────────────────────────────────────────────────────────

export function buildQuoteExpiringPayload(data: {
  adminEmail: string;
  quoteTitle: string;
  clientName: string;
  validUntil: string;
  quoteId: string;
}): EmailPayload {
  return {
    to: [data.adminEmail],
    subject: `[Alerta] Proposta "${data.quoteTitle}" expira em 3 dias`,
    html: `<h2>Proposta a expirar</h2>
<p>A proposta <strong>${data.quoteTitle}</strong> do cliente ${data.clientName} expira em <strong>${data.validUntil}</strong> (dentro de 3 dias).</p>
<p>ID: ${data.quoteId}</p>`,
    event_key: `quote-expiring:${data.quoteId}`,
  };
}

// ── Portal Opened ─────────────────────────────────────────────────────────────

export function buildPortalOpenedPayload(data: {
  partnerEmail: string;
  adminEmail: string;
  quoteTitle: string;
  clientName: string;
}): EmailPayload[] {
  const eventKey = `portal-opened:${data.quoteTitle}:${data.clientName}`;

  const partnerPayload: EmailPayload = {
    to: [data.partnerEmail],
    subject: `O cliente ${data.clientName} abriu a proposta`,
    html: `<h2>Portal aberto</h2>
<p>O cliente <strong>${data.clientName}</strong> abriu o portal da proposta <strong>${data.quoteTitle}</strong> pela primeira vez.</p>`,
    event_key: eventKey,
  };

  const adminPayload: EmailPayload = {
    to: [data.adminEmail],
    subject: `[Admin] Portal aberto — ${data.quoteTitle} / ${data.clientName}`,
    html: `<h2>Portal aberto</h2>
<p>O cliente ${data.clientName} abriu o portal da proposta ${data.quoteTitle}.</p>`,
    event_key: `${eventKey}:admin`,
  };

  return [partnerPayload, adminPayload];
}

// ── Lead Silence ──────────────────────────────────────────────────────────────

export function buildLeadSilencePayload(data: {
  partnerEmail: string;
  adminEmail: string;
  leadTitle: string;
  daysSince: number;
  leadId: string;
  month: string;
}): EmailPayload[] {
  const eventKey = `lead-silence:${data.leadId}:${data.month}`;

  const partnerPayload: EmailPayload = {
    to: [data.partnerEmail],
    subject: `Lead "${data.leadTitle}" sem actividade há ${data.daysSince} dias`,
    html: `<h2>Lead inactiva</h2>
<p>A lead <strong>${data.leadTitle}</strong> não tem actividade há <strong>${data.daysSince} dias</strong>.</p>
<p>ID: ${data.leadId}</p>`,
    event_key: eventKey,
  };

  const adminPayload: EmailPayload = {
    to: [data.adminEmail],
    subject: `[Admin] Lead silenciosa — ${data.leadTitle} (${data.daysSince}d)`,
    html: `<h2>Alerta de silêncio</h2>
<p>A lead ${data.leadTitle} está sem actividade há ${data.daysSince} dias.</p>`,
    event_key: `${eventKey}:admin`,
  };

  return [partnerPayload, adminPayload];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Idempotency check: returns true if this event_key was already sent.
 */
export function isAlreadySent(
  emailLogs: Array<{ event_key: string }>,
  eventKey: string
): boolean {
  return emailLogs.some((log) => log.event_key === eventKey);
}

/**
 * Returns a safe error log record — never throws.
 */
export function recordEmailError(error: unknown): { error: string; sent_at: string } {
  let message: string;
  try {
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    } else {
      message = JSON.stringify(error);
    }
  } catch {
    message = 'Unknown error';
  }
  return {
    error: message,
    sent_at: new Date().toISOString(),
  };
}
