import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AudioAlertService {
  private audioCtx: AudioContext | null = null;
  
  // Mute setting signal synced with localStorage
  soundEnabled = signal<boolean>(this.loadInitialSoundSetting());
  
  // Screen reader assertive announcement signal
  liveAnnouncement = signal<string>('');

  private loadInitialSoundSetting(): boolean {
    if (typeof localStorage === 'undefined') return true;
    const saved = localStorage.getItem('esprit_sound_enabled');
    return saved !== null ? saved === 'true' : true;
  }

  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled.set(enabled);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('esprit_sound_enabled', String(enabled));
    }
  }

  toggleSound(): void {
    this.setSoundEnabled(!this.soundEnabled());
  }

  private initAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Warning alert triggered at ~10 seconds remaining threshold
   */
  playWarningAlert(announcementMessage = 'Attention : il reste 10 secondes !'): void {
    if (announcementMessage) {
      this.triggerLiveAnnouncement(announcementMessage);
    }

    // Vibration pulse (mobile devices)
    this.triggerVibration([120, 80, 120]);

    if (!this.soundEnabled()) return;

    try {
      const ctx = this.initAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Chime tone 1: D5 (587.33 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.18, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.22);

      // Chime tone 2: A5 (880.00 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.00, now + 0.22);
      gain2.gain.setValueAtTime(0.22, now + 0.22);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.50);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.22);
      osc2.stop(now + 0.50);
    } catch {
      // Autoplay or audio context error silently ignored
    }
  }

  /**
   * Time's up alert triggered at 0 seconds remaining
   */
  playTimesUpAlert(announcementMessage = 'Temps écoulé !'): void {
    if (announcementMessage) {
      this.triggerLiveAnnouncement(announcementMessage);
    }

    // Long vibration pulse for time's up
    this.triggerVibration([300, 100, 300]);

    if (!this.soundEnabled()) return;

    try {
      const ctx = this.initAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const frequencies = [440.00, 349.23, 261.63]; // A4 -> F4 -> C4

      frequencies.forEach((freq, idx) => {
        const startTime = now + idx * 0.16;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.25, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.32);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.32);
      });
    } catch {
      // Audio error silently ignored
    }
  }

  /**
   * Vibration helper for supported mobile browsers
   */
  private triggerVibration(pattern: number[]): void {
    if (typeof window !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore vibration failure
      }
    }
  }

  /**
   * Triggers an assertive screen reader vocal announcement
   */
  triggerLiveAnnouncement(message: string): void {
    this.liveAnnouncement.set('');
    setTimeout(() => {
      this.liveAnnouncement.set(message);
    }, 50);
  }
}
