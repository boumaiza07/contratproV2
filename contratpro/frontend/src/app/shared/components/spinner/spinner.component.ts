import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-spinner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="spinner" [class.active]="active" [attr.aria-hidden]="true"></div>
  `,
  styleUrls: ['./spinner.component.css']
})
export class SpinnerComponent {
  @Input() active = false;
} 