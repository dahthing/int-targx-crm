import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-portal-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="p-6"><h1 class="text-h2">Portal do Cliente</h1></div>`,
})
export class PortalShellComponent {}
