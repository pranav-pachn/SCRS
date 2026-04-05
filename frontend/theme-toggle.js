// Shared theme toggle for pages that do not define their own topbar control.
(function () {
  const STORAGE_KEY = 'theme';
  const TOGGLE_ID = 'globalThemeToggle';
  const STYLE_ID = 'globalThemeToggleStyles';

  function getSavedTheme() {
    return localStorage.getItem(STORAGE_KEY) || 'light';
  }

  function applyTheme(theme) {
    const root = document.documentElement;
    const isDark = theme === 'dark';
    root.classList.toggle('dark', isDark);
    root.classList.toggle('light', !isDark);
    root.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);

    const icon = document.getElementById('themeToggleIcon');
    if (icon) {
      icon.textContent = isDark ? 'light_mode' : 'dark_mode';
    }

    const globalToggle = document.getElementById(TOGGLE_ID);
    if (globalToggle) {
      globalToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      globalToggle.innerHTML = `<span class="material-symbols-outlined">${isDark ? 'light_mode' : 'dark_mode'}</span>`;
    }
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .global-theme-toggle {
        position: fixed;
        right: 1.25rem;
        bottom: 1.25rem;
        z-index: 80;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 3.25rem;
        height: 3.25rem;
        border-radius: 999px;
        border: 1px solid rgba(216, 226, 239, 0.95);
        background: rgba(255, 255, 255, 0.96);
        color: #003b72;
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.14);
        backdrop-filter: blur(12px);
        transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, color 0.2s ease;
      }
      .global-theme-toggle:hover {
        transform: translateY(-1px);
        box-shadow: 0 22px 44px rgba(15, 23, 42, 0.18);
      }
      .dark .global-theme-toggle,
      [data-theme="dark"] .global-theme-toggle {
        border-color: rgba(71, 85, 105, 0.95);
        background: rgba(15, 23, 42, 0.94);
        color: #dbeafe;
      }
      @media (max-width: 640px) {
        .global-theme-toggle {
          right: 1rem;
          bottom: 5.5rem;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function hasInlineToggle() {
    return Boolean(document.getElementById('themeToggleBtn'));
  }

  function ensureFloatingToggle() {
    if (hasInlineToggle() || document.getElementById(TOGGLE_ID)) return;
    injectStyles();
    const button = document.createElement('button');
    button.id = TOGGLE_ID;
    button.type = 'button';
    button.className = 'global-theme-toggle';
    button.addEventListener('click', function () {
      applyTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark');
    });
    document.body.appendChild(button);
    applyTheme(getSavedTheme());
  }

  function wireInlineToggle() {
    const button = document.getElementById('themeToggleBtn');
    if (!button || button.dataset.themeBound === 'true') return;
    button.dataset.themeBound = 'true';
    button.addEventListener('click', function () {
      applyTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark');
    });
  }

  function init() {
    applyTheme(getSavedTheme());
    wireInlineToggle();
    ensureFloatingToggle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
