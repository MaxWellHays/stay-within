import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FaviconService {
  private readonly query = window.matchMedia('(prefers-color-scheme: dark)');

  init(): void {
    this.apply(this.query.matches);
    this.query.addEventListener('change', (e) => this.apply(e.matches));
  }

  private apply(isDark: boolean): void {
    const v = isDark ? 'light' : 'dark';
    this.setIcon(`favicon-${v}.ico`, 'image/x-icon');
    this.setIcon(`favicon-${v}-32x32.png`, 'image/png', '32x32');
    this.setIcon(`favicon-${v}-16x16.png`, 'image/png', '16x16');
  }

  private setIcon(href: string, type: string, sizes?: string): void {
    const selector = sizes
      ? `link[rel="icon"][sizes="${sizes}"]`
      : `link[rel="icon"]:not([sizes])`;
    let link = document.querySelector<HTMLLinkElement>(selector);
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      link.type = type;
      if (sizes) link.setAttribute('sizes', sizes);
      document.head.appendChild(link);
    }
    link.href = href;
  }
}
