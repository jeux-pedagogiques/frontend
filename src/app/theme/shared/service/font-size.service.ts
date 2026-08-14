import { Injectable, signal, computed } from '@angular/core';

/**
 * FontSizeService — singleton service managing root font-size scaling.
 *
 * Steps: 87.5 %  →  100 %  →  112.5 %  →  125 %  →  137.5 %
 * Index:   0         1          2           3          4
 *
 * Persists the selected index to localStorage under "fontSizeLevel".
 * Applies the scale by setting `--base-font-size` on `document.documentElement`.
 */
@Injectable({ providedIn: 'root' })
export class FontSizeService {
  /** Ordered scale steps (percentages mapped to px equivalents of 16 px base). */
  readonly steps: readonly number[] = [87.5, 100, 112.5, 125, 137.5] as const;

  private static readonly STORAGE_KEY = 'fontSizeLevel';
  private static readonly DEFAULT_INDEX = 1; // 100 %

  /** Reactive signal holding the current step index. */
  readonly levelIndex = signal<number>(this.loadPersistedIndex());

  /** Derived: current percentage value (e.g. 100). */
  readonly currentPercent = computed(() => this.steps[this.levelIndex()]);

  /** Derived: whether we are at the minimum step. */
  readonly isMin = computed(() => this.levelIndex() === 0);

  /** Derived: whether we are at the maximum step. */
  readonly isMax = computed(() => this.levelIndex() === this.steps.length - 1);

  constructor() {
    // Apply persisted level immediately so there is no flash of default size.
    this.applyToDocument(this.levelIndex());
  }

  /** Increase font size by one step (no-op at max). */
  increase(): void {
    const idx = this.levelIndex();
    if (idx < this.steps.length - 1) {
      this.setLevel(idx + 1);
    }
  }

  /** Decrease font size by one step (no-op at min). */
  decrease(): void {
    const idx = this.levelIndex();
    if (idx > 0) {
      this.setLevel(idx - 1);
    }
  }

  /** Reset to 100 % (default). */
  reset(): void {
    this.setLevel(FontSizeService.DEFAULT_INDEX);
  }

  // ── internal helpers ──────────────────────────────────────────

  private setLevel(index: number): void {
    this.levelIndex.set(index);
    this.persist(index);
    this.applyToDocument(index);
  }

  /** Write the CSS custom property that html { font-size } references. */
  private applyToDocument(index: number): void {
    const pxValue = 16 * (this.steps[index] / 100);
    document.documentElement.style.setProperty(
      '--base-font-size',
      `${pxValue}px`
    );
  }

  private persist(index: number): void {
    try {
      localStorage.setItem(FontSizeService.STORAGE_KEY, String(index));
    } catch {
      // localStorage may be unavailable (private browsing, quota, etc.)
    }
  }

  private loadPersistedIndex(): number {
    try {
      const raw = localStorage.getItem(FontSizeService.STORAGE_KEY);
      if (raw !== null) {
        const parsed = Number(raw);
        if (Number.isInteger(parsed) && parsed >= 0 && parsed < this.steps.length) {
          return parsed;
        }
      }
    } catch {
      // localStorage unavailable
    }
    return FontSizeService.DEFAULT_INDEX;
  }
}
