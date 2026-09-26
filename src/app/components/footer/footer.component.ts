import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TermsModalService } from '../terms-modal/terms-modal.service';
import { PrivacyModalService } from '../privacy-modal/privacy-modal.service';

export type FooterTheme = 'dulane';

// Tagline shown under the brand logo in the footer, per brand. Lines are
// separated by \n and rendered with `white-space: pre-line`.
const FOOTER_TAGLINES: Record<FooterTheme, string> = {
  dulane: 'Tecnologia e gestão para o setor público e privado',
};

export interface FooterTrustItem {
  text: string;
  note?: string;
}

// Trust/legal bullet points shown under the brand logo, per brand (none yet).
const FOOTER_TRUST_ITEMS: Partial<Record<FooterTheme, FooterTrustItem[]>> = {};

export interface FooterBadge {
  src: string;
  alt: string;
  small?: boolean;
}

// Certification seals shown next to the trust list, per brand (none yet).
const FOOTER_BADGES: Partial<Record<FooterTheme, FooterBadge[]>> = {};

// Per-brand logo shown in the footer. The footer background is always dark.
const FOOTER_LOGOS: Record<
  FooterTheme,
  { src: string; alt: string; invert: boolean }
> = {
  dulane: {
    src: 'images/logo-dulane.png',
    alt: 'Dulane Gestão e Tecnologia',
    invert: false,
  },
};

// Contact e-mail shown in the footer, per brand.
const FOOTER_EMAILS: Record<FooterTheme, string> = {
  dulane: 'contato@dulane.com.br',
};

// WhatsApp phone number shown in the footer, per brand.
const FOOTER_WHATSAPP_PHONES: Record<FooterTheme, string> = {
  dulane: '5585999261772',
};

// Human-readable version of the numbers above, shown as the link's label.
const FOOTER_WHATSAPP_DISPLAY: Record<FooterTheme, string> = {
  dulane: '(85) 9 9926-1772',
};

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  @Input() theme: FooterTheme = 'dulane';

  private readonly termsModalService = inject(TermsModalService);
  private readonly privacyModalService = inject(PrivacyModalService);

  get logo() {
    return FOOTER_LOGOS[this.theme];
  }

  get whatsappUrl(): string {
    const text = encodeURIComponent(
      'Olá! Gostaria de tirar algumas dúvidas sobre os serviços da Dulane Gestão e Tecnologia.',
    );
    return `https://api.whatsapp.com/send/?phone=${FOOTER_WHATSAPP_PHONES[this.theme]}&text=${text}`;
  }

  get whatsappDisplay(): string {
    return FOOTER_WHATSAPP_DISPLAY[this.theme];
  }

  get tagline(): string {
    return FOOTER_TAGLINES[this.theme];
  }

  get trustItems(): FooterTrustItem[] | null {
    return FOOTER_TRUST_ITEMS[this.theme] ?? null;
  }

  get badges(): FooterBadge[] | null {
    return FOOTER_BADGES[this.theme] ?? null;
  }

  get email(): string {
    return FOOTER_EMAILS[this.theme];
  }

  get currentYear(): number {
    return new Date().getFullYear();
  }

  abrirTermos(event: Event): void {
    event.preventDefault();
    this.termsModalService.abrir();
  }

  abrirPrivacidade(event: Event): void {
    event.preventDefault();
    this.privacyModalService.abrir();
  }
}
