import { Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../pages/dulane/shared/components/button/button.component';
import { TermsContentComponent } from '../../pages/legal/terms-of-use/terms-content.component';
import { TermsModalService } from './terms-modal.service';

@Component({
  selector: 'app-terms-modal',
  standalone: true,
  imports: [ButtonComponent, TermsContentComponent],
  templateUrl: './terms-modal.component.html',
  styleUrl: './terms-modal.component.scss',
})
export class TermsModalComponent {
  private readonly termsModalService = inject(TermsModalService);
  private readonly router = inject(Router);
  readonly isOpen = this.termsModalService.isOpen;

  // Locks page scroll while the modal is open.
  constructor() {
    effect(() => {
      document.body.style.overflow = this.isOpen() ? 'hidden' : '';
    });
  }

  // Closes the modal.
  fechar(): void {
    this.termsModalService.fechar();
  }

  // Closes the modal and navigates to the full Terms of Use page.
  abrirPaginaDedicada(): void {
    this.fechar();
    this.router.navigate(['/termos-de-uso']);
  }
}
