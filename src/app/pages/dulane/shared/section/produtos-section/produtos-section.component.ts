import { CommonModule } from '@angular/common';
import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  QueryList,
  ViewChildren,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ButtonComponent } from '../../components/button/button.component';

interface Slide {
  id: string;
  button: string;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  icon: string;
  image: string;
  logo: string;
  // Real destination once this product ships. Empty + clickable: false means
  // the CTA is inert (this is placeholder content).
  route: string;
  clickable: boolean;
  // Set to false to keep a slide's data ready (button, copy, assets) without
  // showing it yet — e.g. a product that's still being finalized.
  visible: boolean;
}

// Products carousel. Real products (e.g. Dalleen) get their real copy/logo
// here; slots still marked "Em breve" are fictional placeholders standing in
// for products not defined yet — replace their copy (and set clickable:
// true + a real route) as each one actually ships.
@Component({
  selector: 'app-produtos-section',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './produtos-section.component.html',
  styleUrl: './produtos-section.component.scss',
})
export class ProdutosSectionComponent {
  @ViewChildren('tabBtn') private tabButtons!: QueryList<ElementRef<HTMLButtonElement>>;

  private static readonly AUTOPLAY_INTERVAL_MS = 15000;
  private autoplayId: ReturnType<typeof setInterval> | null = null;
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      this.restartAutoplay();
      this.destroyRef.onDestroy(() => this.stopAutoplay());
    });

    effect(() => {
      const index = this.activeSlideIndex();
      const tab = this.tabButtons?.get(index)?.nativeElement;
      const strip = tab?.closest<HTMLElement>('.carousel-tabs-wrapper');
      if (!tab || !strip) return;

      const stripBox = strip.getBoundingClientRect();
      const tabBox = tab.getBoundingClientRect();
      const centered =
        strip.scrollLeft + (tabBox.left - stripBox.left) - (stripBox.width - tabBox.width) / 2;
      strip.scrollTo({ left: centered, behavior: 'smooth' });
    });
  }

  slides: Slide[] = [
    {
      id: 'dalleen',
      button: 'Dalleen',
      title: 'Dalleen for Business',
      subtitle: 'Gestão empresarial',
      description:
        'Plataforma completa de gestão para o empreendedor: cadastros, vendas, estoque e vitrine virtual em um só lugar, com dados e tendências do seu negócio à vista e suporte de uma equipe especializada. Disponível na Web, Google Play e App Store.',
      badge: 'Produto Dulane',
      icon: 'business_center',
      image: 'images/dallen.png',
      logo: 'images/logo-dalleen.png',
      route: '',
      clickable: false,
      visible: true,
    },
    {
      id: 'produto-2',
      button: 'Produto 2',
      title: 'Nova solução, em breve',
      subtitle: 'Em desenvolvimento',
      description:
        'Mais uma solução a caminho, pensada para tornar sua gestão mais prática e eficiente.',
      badge: 'Em breve',
      icon: 'insights',
      image: 'images/logo-dulane.png',
      logo: 'images/logo-dulane.png',
      route: '',
      clickable: false,
      // Hidden for now — real copy/logo for this second product will be
      // added later, at which point flip this to true.
      visible: false,
    },
  ];

  // Only the slides currently ready to show — everything else (tabs,
  // showcase, dots, cycling) reads from this instead of the raw `slides`.
  get visibleSlides(): Slide[] {
    return this.slides.filter((slide) => slide.visible);
  }

  activeSlideIndex = signal<number>(0);

  private touchStartX = 0;
  private touchEndX = 0;

  setActiveSlide(index: number): void {
    this.activeSlideIndex.set(index);
    this.restartAutoplay();
  }

  nextSlide(): void {
    this.activeSlideIndex.update((idx) => (idx + 1) % this.visibleSlides.length);
    this.restartAutoplay();
  }

  prevSlide(): void {
    this.activeSlideIndex.update(
      (idx) => (idx - 1 + this.visibleSlides.length) % this.visibleSlides.length,
    );
    this.restartAutoplay();
  }

  private restartAutoplay(): void {
    this.stopAutoplay();
    // A single visible slide has nothing to cycle to — autoplay would just
    // re-select index 0 every tick for no visible effect.
    if (this.visibleSlides.length <= 1) return;

    this.autoplayId = setInterval(() => {
      this.activeSlideIndex.update((idx) => (idx + 1) % this.visibleSlides.length);
    }, ProdutosSectionComponent.AUTOPLAY_INTERVAL_MS);
  }

  private stopAutoplay(): void {
    if (this.autoplayId !== null) {
      clearInterval(this.autoplayId);
      this.autoplayId = null;
    }
  }

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0].screenX;
  }

  onTouchEnd(event: TouchEvent): void {
    this.touchEndX = event.changedTouches[0].screenX;
    this.handleSwipe();
  }

  private handleSwipe(): void {
    const swipeThreshold = 50;
    const diff = this.touchStartX - this.touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        this.nextSlide();
      } else {
        this.prevSlide();
      }
    }
  }

  // Placeholder slides have clickable: false, so this never navigates yet.
  openSystemPage(slide: Slide): void {
    if (!slide.clickable) return;

    if (slide.route.startsWith('http')) {
      window.open(slide.route, '_blank', 'noopener,noreferrer');
      return;
    }
  }
}
