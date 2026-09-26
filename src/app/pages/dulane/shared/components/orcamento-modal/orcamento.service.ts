import { Injectable, signal } from '@angular/core';

export type MarcaOrcamento = 'dulane';

// Shared open/close state for the quote request modal.
@Injectable({ providedIn: 'root' })
export class OrcamentoService {
  readonly isOpen = signal(false);
  readonly marca = signal<MarcaOrcamento>('dulane');

  // Opens the modal.
  abrir(marca: MarcaOrcamento = 'dulane'): void {
    this.marca.set(marca);
    this.isOpen.set(true);
  }

  // Closes the modal.
  fechar(): void {
    this.isOpen.set(false);
  }
}
