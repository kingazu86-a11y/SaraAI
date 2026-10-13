/**
 * Toast Notification System for Sara AI Admin
 * Uses clean SVG icons with zero emojis
 */
class ToastManager {
  constructor() {
    this.container = document.getElementById('toastContainer');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toastContainer';
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  }

  show(content, type = 'info', duration = 3500) {
    let message = content;
    let toastType = type;
    let title = '';

    if (typeof content === 'object' && content !== null) {
      message = content.message || content.text || '';
      toastType = content.type || type;
      title = content.title || '';
      if (content.duration) duration = content.duration;
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${toastType}`;

    let iconSvg = '';
    if (window.Icons) {
      if (toastType === 'success') iconSvg = window.Icons.get('check', 16);
      else if (toastType === 'error') iconSvg = window.Icons.get('close', 16);
      else if (toastType === 'warning') iconSvg = window.Icons.get('alert', 16);
      else iconSvg = window.Icons.get('info', 16);
    }

    toast.innerHTML = `
      <span style="display: flex; align-items: center; flex-shrink: 0; margin-top: ${title ? '2px' : '0'};">${iconSvg}</span>
      <div style="flex: 1; word-break: break-word;">
        ${title ? `<div style="font-weight: 600; font-size: 13px; margin-bottom: 2px;">${title}</div>` : ''}
        <div style="font-size: 12.5px;">${message}</div>
      </div>
    `;

    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(40px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  success(msg, duration) { this.show(msg, 'success', duration); }
  error(msg, duration) { this.show(msg, 'error', duration); }
  warning(msg, duration) { this.show(msg, 'warning', duration); }
  info(msg, duration) { this.show(msg, 'info', duration); }
}

window.Toast = new ToastManager();
