import { Injectable } from '@angular/core';
import type { CommissionWithContext } from './commission.service';
import type { Lead } from '../models/lead.model';

export interface CommissionRow {
  parceiro: string;
  projecto: string;
  cliente: string;
  tranche: string;
  valor: number;
  taxa: number;
  comissao: number;
  data: string;
}

export interface LeadRow {
  lead: string;
  cliente: string;
  parceiro: string;
  estado: string;
  valor_estimado: number | null;
  ultima_actividade: string | null;
}

@Injectable({ providedIn: 'root' })
export class ExcelExportService {
  exportCommissions(rows: CommissionWithContext[], filename: string): void {
    const mapped: CommissionRow[] = rows.map(r => ({
      parceiro: r.partner_name ?? r.partner_id,
      projecto: r.project_title ?? r.project_id,
      cliente: r.client_name ?? '',
      tranche: r.tranche_id,
      valor: r.tranche_amount,
      taxa: r.rate_percent,
      comissao: r.commission_amount,
      data: r.created_at,
    }));

    const headers = ['Parceiro', 'Projecto', 'Cliente', 'Tranche', 'Valor', 'Taxa (%)', 'Comissão', 'Data'];
    const csvRows = mapped.map(r => [
      this.#escape(r.parceiro),
      this.#escape(r.projecto),
      this.#escape(r.cliente),
      this.#escape(r.tranche),
      r.valor.toFixed(2),
      r.taxa.toFixed(2),
      r.comissao.toFixed(2),
      this.#escape(r.data ? new Date(r.data).toLocaleDateString('pt-PT') : ''),
    ]);

    this.#downloadCsv(this.#buildCsv(headers, csvRows), filename);
  }

  exportLeads(rows: Lead[], filename: string): void {
    const headers = ['Lead', 'Parceiro', 'Estado', 'Valor Estimado', 'Última Actividade'];
    const csvRows = rows.map(r => [
      this.#escape(r.title),
      this.#escape(r.partner_id),
      this.#escape(r.status),
      r.estimated_value !== null ? r.estimated_value.toFixed(2) : '',
      this.#escape(r.last_activity_at ? new Date(r.last_activity_at).toLocaleDateString('pt-PT') : ''),
    ]);

    this.#downloadCsv(this.#buildCsv(headers, csvRows), filename);
  }

  #buildCsv(headers: string[], rows: string[][]): string {
    const allRows = [headers, ...rows];
    return allRows.map(row => row.join(';')).join('\n');
  }

  #escape(value: string): string {
    if (value.includes(';') || value.includes('"') || value.includes('\n')) {
      return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
  }

  #downloadCsv(content: string, filename: string): void {
    // BOM for UTF-8 Excel compatibility
    const bom = '﻿';
    const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename.endsWith('.csv') ? filename : filename + '.csv';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }
}
