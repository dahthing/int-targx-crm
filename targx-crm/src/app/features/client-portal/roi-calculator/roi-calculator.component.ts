import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface RoiMetrics {
  paybackMonths: number;
  revenueIncreasePct: number | null;
  costReductionPct: number | null;
  benchmarkLabel: string;
  sampleSize: number;
}

@Component({
  selector: 'app-roi-calculator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div style="background:var(--tx-blue-950);border-radius:12px;padding:24px;color:white">
      <h3 style="font-size:0.875rem;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:var(--tx-teal-400);margin:0 0 20px">
        Retorno sobre Investimento
      </h3>

      <div style="display:flex;align-items:flex-end;gap:8px;margin-bottom:24px">
        <span style="font-size:3rem;font-weight:700;color:var(--tx-teal-300);line-height:1;font-family:'JetBrains Mono',monospace">
          {{ metrics().paybackMonths }}
        </span>
        <span style="font-size:1rem;color:var(--tx-gray-400);margin-bottom:6px">meses</span>
        <span style="font-size:0.8125rem;color:var(--tx-gray-500);margin-bottom:6px">payback médio</span>
      </div>

      @if (metrics().revenueIncreasePct || metrics().costReductionPct) {
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
          @if (metrics().revenueIncreasePct) {
            <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:12px;text-align:center">
              <div style="font-size:1.5rem;font-weight:700;color:var(--tx-teal-300);font-family:'JetBrains Mono',monospace">
                +{{ metrics().revenueIncreasePct }}%
              </div>
              <div style="font-size:0.75rem;color:var(--tx-gray-400);margin-top:4px">aumento de receita</div>
            </div>
          }
          @if (metrics().costReductionPct) {
            <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:12px;text-align:center">
              <div style="font-size:1.5rem;font-weight:700;color:var(--tx-gold);font-family:'JetBrains Mono',monospace">
                -{{ metrics().costReductionPct }}%
              </div>
              <div style="font-size:0.75rem;color:var(--tx-gray-400);margin-top:4px">redução de custos</div>
            </div>
          }
        </div>
      }

      <div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:16px">
        <p style="font-size:0.75rem;color:var(--tx-gray-500);margin:0">
          Baseado em {{ metrics().sampleSize }} projectos do tipo "{{ metrics().benchmarkLabel }}".
          Estes valores são estimativas baseadas em dados históricos e não constituem garantia de retorno.
        </p>
      </div>
    </div>
  `,
})
export class RoiCalculatorComponent {
  readonly metrics = input.required<RoiMetrics>();
}
