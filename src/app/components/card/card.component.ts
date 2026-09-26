import { Component, input, output } from '@angular/core';
import { ButtonComponent } from '../../pages/dulane/shared/components/button/button.component';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [ButtonComponent],
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss',
})
export class CardComponent {
  icon = input<string>('');
  title = input<string>('');
  description = input<string>('');

  // When set, the card shows only this image (no icon/title/description).
  image = input<string>('');
  imageAlt = input<string>('');

  // Options to control the button
  showButton = input<boolean>(false);
  buttonText = input<string>('Saiba Mais');
  buttonVariant = input<'primary' | 'secondary' | 'outline'>('outline');

  // Event emitted when the inner button is clicked
  buttonClick = output<void>();

  // Emits the buttonClick output.
  onButtonClick(): void {
    this.buttonClick.emit();
  }
}
