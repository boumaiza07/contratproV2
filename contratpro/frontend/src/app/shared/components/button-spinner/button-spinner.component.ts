import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SpinnerComponent } from '../spinner/spinner.component';

@Component({
  selector: 'app-button-spinner',
  standalone: true,
  imports: [CommonModule, SpinnerComponent],
  template: `
    <button 
      [type]="type" 
      [class]="buttonClass"
      [disabled]="disabled || isLoading"
      (click)="onClick.emit($event)"
      [attr.aria-busy]="isLoading"
    >
      <div class="button-content">
        <app-spinner [active]="isLoading"></app-spinner>
        <span class="button-text">
          <ng-content></ng-content>
        </span>
      </div>
    </button>
  `,
  styles: [`
    .button-content {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
    }
    
    .button-text {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  `]
})
export class ButtonSpinnerComponent {
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() buttonClass = 'btn btn-primary';
  @Input() disabled = false;
  @Input() isLoading = false;
  
  @Output() onClick = new EventEmitter<MouseEvent>();
} 