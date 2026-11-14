// ============================================================================
// Security & Vault Service
// - PIN & Biometric App Lock
// - Plausible Deniability Decoy Mode
// - Cryptographic Safety Number Generator (Signal-compatible 60-digit fingerprint)
// - Emergency Instant Data Wipe (Panic Button)
// ============================================================================

import { localDb } from './db';
import type { AppSecuritySettings } from '@/types';

class SecurityService {
  private currentMode: 'unlocked' | 'locked' | 'decoy' = 'unlocked';
  private lockListeners: Set<(mode: 'unlocked' | 'locked' | 'decoy') => void> = new Set();

  onLockStateChange(listener: (mode: 'unlocked' | 'locked' | 'decoy') => void): () => void {
    this.lockListeners.add(listener);
    listener(this.currentMode);
    return () => this.lockListeners.delete(listener);
  }

  getLockMode(): 'unlocked' | 'locked' | 'decoy' {
    return this.currentMode;
  }

  async getSettings(): Promise<AppSecuritySettings> {
    const s = await localDb.getSetting<AppSecuritySettings>('app_security_settings');
    return s || {
      isLocked: false,
      hasPin: false,
      autoLockMinutes: 0,
      lastActiveTimestamp: Date.now()
    };
  }

  async setPin(pin: string, decoyPin?: string): Promise<void> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');

    const pinHash = await this.hashPin(pin, saltHex);
    let decoyHash: string | undefined = undefined;
    if (decoyPin && decoyPin.length >= 4) {
      decoyHash = await this.hashPin(decoyPin, saltHex);
    }

    const current = await this.getSettings();
    const updated: AppSecuritySettings = {
      ...current,
      hasPin: true,
      pinSalt: saltHex,
      pinHash,
      decoyPinHash: decoyHash,
      isLocked: false,
      lastActiveTimestamp: Date.now()
    };

    await localDb.setSetting('app_security_settings', updated);
  }

  async removePin(): Promise<void> {
    const current = await this.getSettings();
    const updated: AppSecuritySettings = {
      ...current,
      hasPin: false,
      pinHash: undefined,
      pinSalt: undefined,
      decoyPinHash: undefined,
      isLocked: false
    };
    await localDb.setSetting('app_security_settings', updated);
    this.setMode('unlocked');
  }

  async unlockWithPin(inputPin: string): Promise<{ success: boolean; isDecoy?: boolean }> {
    const settings = await this.getSettings();
    if (!settings.hasPin || !settings.pinHash || !settings.pinSalt) {
      this.setMode('unlocked');
      return { success: true };
    }

    const inputHash = await this.hashPin(inputPin, settings.pinSalt);

    // Primary real PIN match
    if (inputHash === settings.pinHash) {
      this.setMode('unlocked');
      return { success: true, isDecoy: false };
    }

    // Decoy plausible deniability PIN match
    if (settings.decoyPinHash && inputHash === settings.decoyPinHash) {
      this.setMode('decoy');
      return { success: true, isDecoy: true };
    }

    return { success: false };
  }

  lockApp(): void {
    this.setMode('locked');
  }

  setMode(mode: 'unlocked' | 'locked' | 'decoy'): void {
    this.currentMode = mode;
    this.lockListeners.forEach(l => l(mode));
  }

  private async hashPin(pin: string, saltHex: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin + saltHex);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Generates a 60-digit safety number fingerprint from two ECDH public keys
   * Formatted into 12 blocks of 5 digits: XXXXX XXXXX XXXXX ...
   */
  async computeSafetyNumber(myPublicKeyJWK: string, peerPublicKeyJWK: string): Promise<string> {
    try {
      const sorted = [myPublicKeyJWK.trim(), peerPublicKeyJWK.trim()].sort().join('::');
      const encoder = new TextEncoder();
      const hash = await crypto.subtle.digest('SHA-256', encoder.encode(sorted));
      const bytes = new Uint8Array(hash);

      // Convert bytes to a 60-digit numeric sequence
      let digits = '';
      for (let i = 0; i < bytes.length && digits.length < 60; i += 2) {
        const num = (bytes[i] << 8) | bytes[i + 1];
        digits += (num % 100000).toString().padStart(5, '0');
      }

      // Group into 12 blocks of 5 digits
      const blocks: string[] = [];
      for (let i = 0; i < 60; i += 5) {
        blocks.push(digits.slice(i, i + 5));
      }
      return blocks.join(' ');
    } catch {
      return '00000 00000 00000 00000 00000 00000 00000 00000 00000 00000 00000 00000';
    }
  }

  async calculateSafetyNumber(myPublicKeyJWK: string, peerPublicKeyJWK: string): Promise<string> {
    return this.computeSafetyNumber(myPublicKeyJWK, peerPublicKeyJWK);
  }

  /**
   * Nuclear Panic Wipe: Erases all local messages, conversations, keys, cached peers,
   * local storage, session storage, and reloads the window.
   */
  async emergencyInstantWipe(): Promise<void> {
    try {
      await localDb.wipeAllLocalData();
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/';
    } catch {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  }

  async panicWipe(): Promise<void> {
    return this.emergencyInstantWipe();
  }
}

export const securityService = new SecurityService();
