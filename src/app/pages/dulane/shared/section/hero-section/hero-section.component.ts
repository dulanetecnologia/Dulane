import {
  afterNextRender,
  Component,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { CardComponent } from '../../../../../components/card/card.component';
import { ButtonComponent } from '../../components/button/button.component';
import { OrcamentoService } from '../../components/orcamento-modal/orcamento.service';

@Component({
  selector: 'app-hero-section',
  standalone: true,
  imports: [ButtonComponent, CardComponent],
  templateUrl: './hero-section.component.html',
  styleUrl: './hero-section.component.scss',
})
export class HeroSectionComponent {
  private readonly orcamentoService = inject(OrcamentoService);
  private readonly featuresCard =
    viewChild<ElementRef<HTMLElement>>('featuresCard');

  constructor() {
    // Reveals the differentiator cards with a staggered animation once they
    // scroll into view, same behavior as the "Nossos Serviços" cards.
    afterNextRender(() => {
      const grid = this.featuresCard()?.nativeElement;
      if (!grid) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            grid.classList.add('in-view');
            observer.disconnect();
          }
        },
        { threshold: 0.2 },
      );
      observer.observe(grid);
    });
  }

  // Opens the quote request modal.
  abrirOrcamento(): void {
    this.orcamentoService.abrir();
  }
}
