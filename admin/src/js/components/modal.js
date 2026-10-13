/**
 * Modal Manager for Sara AI Admin
 */
class ModalManager {
  constructor() {
    this.activeModal = null;
    this.setupListeners();
  }

  setupListeners() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activeModal) {
        this.close();
      }
    });
  }

  open(modalId) {
    const modalEl = document.getElementById(modalId);
    if (!modalEl) return;

    if (this.activeModal && this.activeModal !== modalEl) {
      this.activeModal.classList.remove('open');
    }

    modalEl.classList.add('open');
    this.activeModal = modalEl;

    // Focus first input if available
    setTimeout(() => {
      const firstInput = modalEl.querySelector('input, select, textarea');
      if (firstInput) firstInput.focus();
    }, 100);
  }

  close(modalId) {
    const modalEl = modalId ? document.getElementById(modalId) : this.activeModal;
    if (modalEl) {
      modalEl.classList.remove('open');
      if (this.activeModal === modalEl) this.activeModal = null;
    }
  }
}

window.Modal = new ModalManager();
