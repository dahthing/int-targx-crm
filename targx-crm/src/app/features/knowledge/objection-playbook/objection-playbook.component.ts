import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-objection-playbook',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="p-6"><h1 class="text-h2">Objecções</h1></div>`,
})
export class ObjectionPlaybookComponent {}
