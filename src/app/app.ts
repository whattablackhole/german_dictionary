import { Component, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

const DARK_MODE_KEY = 'german-dictionary-dark-mode';

export interface NavItem {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly darkMode = signal<boolean>(
    (() => {
      try {
        return localStorage.getItem(DARK_MODE_KEY) === 'true';
      } catch {
        return false;
      }
    })()
  );

  readonly isMobile = signal(false);
  readonly sidenavOpened = signal(true);

  readonly navItems: NavItem[] = [
    { path: '/review', label: 'Review', icon: 'repeat' },
    { path: '/game', label: 'Gender Game', icon: 'sports_esports' },
    { path: '/exercise', label: 'Exercise', icon: 'edit_note' },
    { path: '/practice-word', label: 'Word Practice', icon: 'spellcheck' },
    { path: '/sentence-builder', label: 'Sentences', icon: 'account_tree' },
    { path: '/diary', label: 'Diary', icon: 'edit' },
    { path: '/captions', label: 'Captions', icon: 'subtitles' },
    { path: '/grammar-notes', label: 'Grammar', icon: 'menu_book' },
    { path: '/prepositions', label: 'Prepositions', icon: 'ads_click' },
    { path: '/declension', label: 'Declension', icon: 'diversity_3' },
    { path: '/stories', label: 'Stories', icon: 'auto_stories' },
    { path: '/manage', label: 'Manage', icon: 'dataset' },
    { path: '/import', label: 'Import', icon: 'file_download' },
    { path: '/settings', label: 'Settings', icon: 'tune' },
  ];


  constructor() {
    // Apply dark mode on init
    effect(() => {
      const isDark = this.darkMode();
      document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
      document.documentElement.classList.toggle('dark-theme', isDark);
      try {
        localStorage.setItem(DARK_MODE_KEY, String(isDark));
      } catch {
        // ignore
      }
    });

    // Responsive sidenav: over on mobile, side (always open) on desktop
    if (typeof window !== 'undefined') {
      const mq = window.matchMedia('(max-width: 768px)');
      this.isMobile.set(mq.matches);
      mq.addEventListener('change', (e) => {
        const mobile = e.matches;
        this.isMobile.set(mobile);
        if (!mobile) {
          this.sidenavOpened.set(true);
        }
      });
    }
  }

  toggleDarkMode(): void {
    this.darkMode.update((d) => !d);
  }

  toggleSidenav(): void {
    this.sidenavOpened.update((o) => !o);
  }

  closeSidenav(): void {
    if (this.isMobile()) {
      this.sidenavOpened.set(false);
    }
  }


  getNavColor(index: number): string {
    const colors = [
      '#58cc02', // green - review
      '#ff9600', // orange - game
      '#3b82f6', // blue - exercise
      '#06b6d4', // cyan - word practice
      '#8b5cf6', // purple - sentence builder
      '#ec4899', // pink - diary
      '#14b8a6', // teal - captions
      '#eab308', // yellow - grammar
      '#ef4444', // red - prepositions
      '#a855f7', // violet - declension
      '#6366f1', // indigo - stories
      '#6b7280', // gray - manage
      '#2563eb', // blue - import
      '#78716c', // stone - settings
    ];
    return colors[index % colors.length];
  }
}