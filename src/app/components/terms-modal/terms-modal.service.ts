import { Injectable, signal } from '@angular/core';

// Shared open/close state for the Terms of Use modal, usable from anywhere
// on the site.
@Injectable({ providedIn: 'root' })
export class TermsModalService {
  readonly isOpen = signal(false);

  // Opens the modal.
  abrir(): void {
    this.isOpen.set(true);
  }

  // Closes the modal.
  fechar(): void {
    this.isOpen.set(false);
  }
}
