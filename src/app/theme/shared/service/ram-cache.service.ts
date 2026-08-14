import { Injectable } from '@angular/core';

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

@Injectable({
  providedIn: 'root'
})
export class RamCacheService {
  private cache = new Map<string, CacheEntry>();
  private defaultTtl = 10 * 60 * 1000; // 10 minutes

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number = this.defaultTtl): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    });
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clears all cached data in RAM.
   * Called automatically when user logs out.
   */
  clear(): void {
    this.cache.clear();
  }
}
