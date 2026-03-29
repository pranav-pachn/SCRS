// =====================
// THEME TOGGLE FUNCTIONALITY
// Purpose: Add light/dark mode toggle to all pages
// =====================

// Initialize theme on page load
document.addEventListener('DOMContentLoaded', () => {
  // Load saved theme or default to light
  const savedTheme = localStorage.getItem('theme') || 'light';
  setTheme(savedTheme);
  
  // Create and add theme toggle button
  createThemeToggle();
});

// Set theme and save to localStorage
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}

// Create theme toggle button
function createThemeToggle() {
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'theme-toggle';
  toggleBtn.setAttribute('aria-label', 'Toggle dark mode');
  toggleBtn.innerHTML = getThemeIcon();
  
  // Add click handler
  toggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    toggleBtn.innerHTML = getThemeIcon();
  });
  
  // Add to page
  document.body.appendChild(toggleBtn);
}

// Get appropriate icon for current theme
function getThemeIcon() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  return currentTheme === 'light' ? '🌙' : '☀️';
}

// Also update icon when theme changes programmatically
const observer = new MutationObserver(() => {
  const toggleBtn = document.querySelector('.theme-toggle');
  if (toggleBtn) {
    toggleBtn.innerHTML = getThemeIcon();
  }
});

observer.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['data-theme']
});
