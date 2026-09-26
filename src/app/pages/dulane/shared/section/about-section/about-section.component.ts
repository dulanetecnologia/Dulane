import {
  afterNextRender,
  Component,
  ElementRef,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'app-about-section',
  imports: [],
  templateUrl: './about-section.component.html',
  styleUrl: './about-section.component.scss',
})
// "Quem somos" section: company story, benefit cards and image.
export class AboutSectionComponent {
  private readonly featuresGrid =
    viewChild<ElementRef<HTMLElement>>('featuresGrid');

  constructor() {
    // Reveals the benefit cards with a staggered animation once the grid
    // scrolls into view, instead of animating them on every page load.
    afterNextRender(() => {
      const grid = this.featuresGrid()?.nativeElement;
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
}
