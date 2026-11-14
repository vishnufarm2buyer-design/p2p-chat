// ============================================================================
// Web Audio Sound Engine (Zero external audio asset dependencies)
// Synthesizes elegant, crystal-clear acoustic feedback using Web Audio API.
// ============================================================================

class SoundEngine {
  private ctx: AudioContext | null = null;
  private ringbackInterval: any = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.ctx && AudioCtx) {
        this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  /**
   * Subtle crystalline ping for incoming messages.
   */
  playMessageIncomingChime(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now); // A5
      osc1.frequency.exponentialRampToValueAtTime(1760, now + 0.12);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1320, now); // E6
      osc2.frequency.exponentialRampToValueAtTime(2640, now + 0.15);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.35);
      osc2.stop(now + 0.35);
    } catch (_) {}
  }

  /**
   * Starts classic international telephone ringback tone for caller
   * Dual frequency: 440 Hz + 480 Hz
   */
  startOutgoingRingbackTone(): void {
    this.stopOutgoingRingbackTone();
    const ctx = this.getContext();
    if (!ctx) return;

    const playCadence = () => {
      const c = this.getContext();
      if (!c) return;
      try {
        const now = c.currentTime;
        const osc1 = c.createOscillator();
        const osc2 = c.createOscillator();
        const gain = c.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(440, now);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(480, now);

        gain.gain.setValueAtTime(0.03, now);
        gain.gain.setValueAtTime(0.03, now + 1.2);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(c.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.3);
        osc2.stop(now + 1.3);
      } catch (_) {}
    };

    playCadence();
    this.ringbackInterval = setInterval(playCadence, 3000);
  }

  stopOutgoingRingbackTone(): void {
    if (this.ringbackInterval) {
      clearInterval(this.ringbackInterval);
      this.ringbackInterval = null;
    }
  }

  /**
   * Sound effect when starting audio recording.
   */
  playRecordStart(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.08); // G5

      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch (_) {}
  }

  /**
   * Sound effect when stopping audio recording.
   */
  playRecordStop(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(783.99, now); // G5
      osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.08); // C5

      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch (_) {}
  }

  /**
   * Cheerful chord on successful P2P call connection.
   */
  playCallConnected(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);

        gain.gain.setValueAtTime(0.03, now + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.05 + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.3);
      });
    } catch (_) {}
  }
}

export const soundEngine = new SoundEngine();
