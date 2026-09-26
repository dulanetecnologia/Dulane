import { Component } from '@angular/core';

// Dulane's WhatsApp line.
const PHONE = '5585999261772';

@Component({
  selector: 'app-whatsapp-button',
  standalone: true,
  templateUrl: './whatsapp-button.component.html',
  styleUrl: './whatsapp-button.component.scss'
})
export class WhatsappButtonComponent {
  // Opens WhatsApp in a new tab with a pre-filled message.
  openWhatsApp(): void {
    const text = encodeURIComponent('Olá! Gostaria de tirar algumas dúvidas e saber mais sobre as soluções da Dulane.');
    const url = `https://api.whatsapp.com/send/?phone=${PHONE}&text=${text}`;
    window.open(url, '_blank');
  }
}
