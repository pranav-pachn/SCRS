// =====================
// MODERN NOTIFICATION SYSTEM
// Purpose: Replace alerts with beautiful, animated notifications
// =====================

class NotificationSystem {
  constructor() {
    this.container = null;
    this.init();
  }

  init() {
    // Create notification container
    this.container = document.createElement('div');
    this.container.id = 'notification-container';
    this.container.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: 420px;
    `;
    document.body.appendChild(this.container);
  }

  show(message, type = 'info', duration = 5000) {
    const notification = this.createNotification(message, type);
    this.container.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
      notification.style.opacity = '1';
    }, 100);

    // Auto remove
    setTimeout(() => {
      this.remove(notification);
    }, duration);

    return notification;
  }

  createNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    // Get icon based on type
    const icons = {
      success: 'check_circle',
      error: 'error',
      warning: 'warning',
      info: 'info',
      loading: 'hourglass_top'
    };

    // Get colors based on theme and type
    const colors = this.getColors(type);

    notification.style.cssText = `
      background: ${colors.bg};
      color: ${colors.text};
      border: 1px solid ${colors.border};
      border-left: 3px solid ${colors.accent};
      padding: 14px 16px;
      border-radius: 14px;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.18);
      backdrop-filter: blur(12px);
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 14px;
      font-weight: 600;
      transform: translateX(100%);
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
      min-width: 280px;
      max-width: 420px;
    `;

    // Add icon
    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined';
    icon.textContent = icons[type] || icons.info;
    icon.style.cssText = `
      font-size: 20px;
      flex-shrink: 0;
      color: ${colors.accent};
      animation: ${type === 'loading' ? 'spin 1s linear infinite' : 'none'};
    `;

    // Add message
    const messageEl = document.createElement('div');
    messageEl.textContent = message;
    messageEl.style.cssText = `
      flex: 1;
      line-height: 1.4;
      letter-spacing: 0.1px;
    `;

    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: inherit;
      font-size: 20px;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      opacity: 0.75;
      transition: opacity 0.2s ease;
    `;

    closeBtn.addEventListener('click', () => {
      this.remove(notification);
    });

    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.opacity = '1';
    });

    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.opacity = '0.7';
    });

    notification.appendChild(icon);
    notification.appendChild(messageEl);
    notification.appendChild(closeBtn);

    return notification;
  }

  getColors(type) {
    const root = document.documentElement;
    const isDark = root.getAttribute('data-theme') === 'dark' || root.classList.contains('dark');
    
    const themes = {
      light: {
        success: { bg: '#f0fdf4', text: '#14532d', border: '#86efac', accent: '#16a34a' },
        error: { bg: '#fef2f2', text: '#7f1d1d', border: '#fecaca', accent: '#dc2626' },
        warning: { bg: '#fffbeb', text: '#78350f', border: '#fde68a', accent: '#d97706' },
        info: { bg: '#eff6ff', text: '#1e3a8a', border: '#bfdbfe', accent: '#1d5fa8' },
        loading: { bg: '#f8fafc', text: '#334155', border: '#cbd5e1', accent: '#64748b' }
      },
      dark: {
        success: { bg: '#052e16', text: '#bbf7d0', border: '#166534', accent: '#4ade80' },
        error: { bg: '#450a0a', text: '#fecaca', border: '#7f1d1d', accent: '#f87171' },
        warning: { bg: '#451a03', text: '#fde68a', border: '#78350f', accent: '#f59e0b' },
        info: { bg: '#172554', text: '#bfdbfe', border: '#1e3a8a', accent: '#93c5fd' },
        loading: { bg: '#0f172a', text: '#cbd5e1', border: '#334155', accent: '#94a3b8' }
      }
    };

    return themes[isDark ? 'dark' : 'light'][type] || themes.light.info;
  }

  remove(notification) {
    notification.style.transform = 'translateX(100%)';
    notification.style.opacity = '0';
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }

  // Convenience methods
  success(message, duration = 5000) {
    return this.show(message, 'success', duration);
  }

  error(message, duration = 7000) {
    return this.show(message, 'error', duration);
  }

  warning(message, duration = 6000) {
    return this.show(message, 'warning', duration);
  }

  info(message, duration = 5000) {
    return this.show(message, 'info', duration);
  }

  loading(message = 'Loading...') {
    return this.show(message, 'loading', 0); // No auto-dismiss for loading
  }

  // Clear all notifications
  clear() {
    const notifications = this.container.children;
    Array.from(notifications).forEach(notification => {
      this.remove(notification);
    });
  }
}

// Add CSS animation for loading spinner
const style = document.createElement('style');
style.textContent = `
  .material-symbols-outlined {
    font-variation-settings: 'FILL' 0, 'wght' 450, 'GRAD' 0, 'opsz' 24;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

// Create global instance
window.notifications = new NotificationSystem();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NotificationSystem;
}
