import { Component, input } from '@angular/core';

@Component({
  selector: 'app-dulane-button',
  standalone: true,
  templateUrl: './button.component.html',
  styleUrl: './button.component.scss'
})
// Reusable pill-shaped button with primary/secondary/outline variants.
export class ButtonComponent {
  variant = input<'primary' | 'secondary' | 'outline'>('primary');
  type = input<'button' | 'submit'>('button');
}