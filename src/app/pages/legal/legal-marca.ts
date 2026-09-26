import { FooterTheme } from '../../components/footer/footer.component';

export interface LegalMarcaInfo {
  logoSrc: string;
  logoAlt: string;
  // Route the "Voltar ao site" link and the logo itself point back to.
  homeRoute: string;
  // Brand accent shown as a thin bar under the header.
  accentColor: string;
}

// Per-brand header logo + home link for the /termos-de-uso and
// /politica-de-privacidade pages.
export const LEGAL_MARCA_INFO: Record<FooterTheme, LegalMarcaInfo> = {
  dulane: {
    logoSrc: 'images/logo-dulane.png',
    logoAlt: 'Dulane Gestão e Tecnologia',
    homeRoute: '/',
    accentColor: '#244feb',
  },
};
