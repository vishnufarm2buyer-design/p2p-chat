// ============================================================================
// Web Notification Service
// Provides privacy-preserving background notifications when tab is unfocused.
// ============================================================================

class NotificationService {
  private permission: NotificationPermission = 'default';

  constructor() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      this.permission = Notification.permission;
    }
  }

  async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    try {
      this.permission = await Notification.requestPermission();
      return this.permission === 'granted';
    } catch {
      return false;
    }
  }

  isGranted(): boolean {
    return this.permission === 'granted';
  }

  notifyIncomingMessage(senderName: string, textPreview: string, conversationId: string): void {
    // Only show if page is hidden or user is in another conversation
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (this.permission !== 'granted') return;
    if (document.visibilityState === 'visible' && document.hasFocus()) return;

    try {
      const notif = new Notification(`New message from ${senderName}`, {
        body: textPreview.slice(0, 120),
        icon: '/favicon.ico',
        tag: `msg_${conversationId}`,
        silent: true // Web Audio chime handles acoustic feedback cleanly
      });

      notif.onclick = () => {
        window.focus();
        notif.close();
      };

      setTimeout(() => notif.close(), 6000);
    } catch (_) {}
  }

  notifyIncomingCall(callerName: string, callType: 'voice' | 'video'): void {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (this.permission !== 'granted') return;

    try {
      const notif = new Notification(`Incoming ${callType} call`, {
        body: `${callerName} is calling you on Shield P2P...`,
        icon: '/favicon.ico',
        tag: 'incoming_call',
        requireInteraction: true
      });

      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    } catch (_) {}
  }
}

export const notificationService = new NotificationService();
