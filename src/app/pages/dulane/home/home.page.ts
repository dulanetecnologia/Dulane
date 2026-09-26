import { Component } from '@angular/core';
import { AboutSectionComponent } from '../shared/section/about-section/about-section.component';
import { HeroSectionComponent } from '../shared/section/hero-section/hero-section.component';
import { ProdutosSectionComponent } from '../shared/section/produtos-section/produtos-section.component';
import { MoreProductsSectionComponent } from '../shared/section/more-products-section/more-products-section.component';
import { HeaderComponent } from '../shared/components/header/header.component';
import { FooterComponent } from '../../../components/footer/footer.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    HeaderComponent,
    HeroSectionComponent,
    AboutSectionComponent,
    ProdutosSectionComponent,
    MoreProductsSectionComponent,
    FooterComponent,
  ],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
// Dulane home page: assembles the shared sections into the root LP.
export class HomePage {}
