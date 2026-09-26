import { Component, inject, signal } from '@angular/core';
import { PrivacyModalService } from '../privacy-modal/privacy-modal.service';

const STORAGE_KEY = 'dulane-cookie-consent';

// Bottom cookie-notice banner, shown once per browser until accepted.
@Component({
  selector: 'app-cookie-consent',
  standalone: true,
  templateUrl: './cookie-consent.component.html',
  styleUrl: './cookie-consent.component.scss',
})
export class CookieConsentComponent {
  private readonly privacyModalService = inject(PrivacyModalService);

  visible = signal(window.localStorage.getItem(STORAGE_KEY) !== 'accepted');

  // Records consent and hides the banner.
  aceitar(): void {
    window.localStorage.setItem(STORAGE_KEY, 'accepted');
    this.visible.set(false);
  }

  // Opens the Privacy Policy modal.
  abrirPrivacidade(event: Event): void {
    event.preventDefault();
    this.privacyModalService.abrir();
  }
}
