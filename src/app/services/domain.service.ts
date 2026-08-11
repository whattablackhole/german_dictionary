import { Injectable, signal } from '@angular/core';

const CUSTOM_DOMAINS_KEY = 'german-dictionary-custom-domains';

const DEFAULT_DOMAINS: string[] = [
  'At the airport',
  'At home',
  'At the cinema',
  'In math class',
  'At the supermarket',
  'At the restaurant',
  'At the doctor',
  'At the pharmacy',
  'At the bank',
  'At the post office',
  'At the hotel',
  'At the train station',
  'At the bus stop',
  'At the park',
  'At the beach',
  'At the gym',
  'At the office',
  'At the school',
  'At the university',
  'At the library',
  'At the museum',
  'At the zoo',
  'At the farm',
  'At the church',
  'At the hospital',
  'At the police station',
  'At the fire station',
  'At the gas station',
  'At the car repair shop',
  'At the bakery',
  'At the butcher shop',
  'At the flower shop',
  'At the bookstore',
  'At the toy store',
  'At the clothing store',
  'At the shoe store',
  'At the jewelry store',
  'At the electronics store',
  'At the hardware store',
  'At the furniture store',
  'At the sports shop',
  'At the music store',
  'At the art gallery',
  'At the theater',
  'At the concert hall',
  'At the amusement park',
  'At the swimming pool',
  'At the playground',
  'At the garden',
  'At the kitchen',
  'At the bedroom',
  'At the bathroom',
  'At the living room',
  'At the dining room',
  'At the garage',
  'At the basement',
  'At the balcony',
  'On the street',
  'In the city center',
  'In the village',
  'In the forest',
  'In the mountains',
  'By the river',
  'By the lake',
  'On the farm',
  'At the wedding',
  'At the birthday party',
  'At the funeral',
  'At the job interview',
  'At the business meeting',
  'At the conference',
  'At the press conference',
  'At the airport security',
  'On the airplane',
  'On the train',
  'On the bus',
  'In the taxi',
  'On the ship',
  'At the customs',
  'At the embassy',
  'At the travel agency',
  'At the real estate agency',
  'At the hair salon',
  'At the spa',
  'At the dentist',
  'At the veterinarian',
  'At the kindergarten',
  'At the nursing home',
];

@Injectable({ providedIn: 'root' })
export class DomainService {
  readonly customDomains = signal<string[]>(this.loadCustomDomains());

  getAllDomains(): string[] {
    return [...DEFAULT_DOMAINS, ...this.customDomains()];
  }

  searchDomains(query: string): string[] {
    if (!query.trim()) {
      return this.getAllDomains();
    }
    const lower = query.toLowerCase();
    return this.getAllDomains().filter((d) => d.toLowerCase().includes(lower));
  }

  addCustomDomain(domain: string): void {
    const trimmed = domain.trim();
    if (!trimmed) {
      return;
    }
    const all = this.getAllDomains();
    if (all.some((d) => d.toLowerCase() === trimmed.toLowerCase())) {
      return; // already exists
    }
    this.customDomains.update((domains) => [...domains, trimmed]);
    this.saveCustomDomains();
  }

  private loadCustomDomains(): string[] {
    const stored = localStorage.getItem(CUSTOM_DOMAINS_KEY);
    if (stored) {
      try {
        return JSON.parse(stored) as string[];
      } catch {
        return [];
      }
    }
    return [];
  }

  private saveCustomDomains(): void {
    localStorage.setItem(
      CUSTOM_DOMAINS_KEY,
      JSON.stringify(this.customDomains())
    );
  }
}