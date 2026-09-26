import { CommonModule } from '@angular/common';
import { Component, HostListener, signal } from '@angular/core';

// Sticky header with a scroll-spy nav and a mobile menu.
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  isMenuOpen = signal<boolean>(false);
  isDropdownOpen = signal<boolean>(false);
  isScrolled = signal<boolean>(false);
  activeSection = signal<string>('inicio');

  // Tracks scroll position to toggle the header's scrolled state.
  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    this.isScrolled.set(window.scrollY > 20);
  }

  // Marks a section active and smooth-scrolls to it, offsetting for the fixed header.
  setActiveSection(sectionId: string, event?: Event): void {
    if (event) {
      event.preventDefault();
    }

    this.activeSection.set(sectionId);
    this.closeMenu();

    if (sectionId === 'inicio') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const targetElement = document.getElementById(sectionId);
    if (targetElement) {
      const headerOffset = 90;
      const elementPosition = targetElement.getBoundingClientRect().top;
      const offsetPosition =
        elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  }

  // Toggles the mobile menu open/closed.
  toggleMenu(): void {
    this.isMenuOpen.update((state) => !state);
    if (!this.isMenuOpen()) {
      this.isDropdownOpen.set(false);
    }
  }

  // Toggles the "useful links" dropdown.
  toggleDropdown(event: Event): void {
    event.stopPropagation();
    this.isDropdownOpen.update((state) => !state);
  }

  // Closes the mobile menu and dropdown.
  closeMenu(): void {
    this.isMenuOpen.set(false);
    this.isDropdownOpen.set(false);
  }

  // Closes the menu when an external link is clicked.
  onExternalLinkClick(): void {
    this.closeMenu();
  }

  // Closes the dropdown when clicking anywhere outside it.
  @HostListener('document:click', ['$event'])
  onDocumentClick(): void {
    this.isDropdownOpen.set(false);
  }
}
