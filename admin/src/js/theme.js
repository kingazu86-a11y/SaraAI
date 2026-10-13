/**
 * Theme Engine for Sara AI Admin
 * Matches Sara AI Mobile theme tokens
 */
class ThemeManager {
  constructor() {
    this.currentTheme = localStorage.getItem('sara_admin_theme') || 'dark';
    this.applyTheme(this.currentTheme);
  }

  applyTheme(theme) {
    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('sara_admin_theme', theme);

    // Update toggle buttons in UI
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn && window.Icons) {
      const icon = theme === 'dark' ? window.Icons.get('sun', 14) : window.Icons.get('moon', 14);
      themeBtn.innerHTML = `${icon} Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`;
    }
  }

  toggleTheme() {
    const next = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme(next);
    if (window.Toast) {
      window.Toast.info(`Switched to ${next === 'dark' ? 'Sara Dark' : 'Sara Light'} theme.`);
    }
  }
}

window.Theme = new ThemeManager();
