function getStoredAuth() {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  if (!token || !userStr) {
    return { token: null, user: null };
  }

  try {
    const user = JSON.parse(userStr);
    return { token, user };
  } catch (error) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return { token: null, user: null };
  }
}

function setStoredAuth(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

// Backward-compatible alias for existing code
const storeAuth = setStoredAuth;

function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

function getAuthHeaders(extraHeaders) {
  const headers = Object.assign({}, extraHeaders || {});
  const auth = getStoredAuth();
  if (auth.token) {
    headers.Authorization = 'Bearer ' + auth.token;
  }
  return headers;
}

function requireAuth(allowedRoles) {
  const auth = getStoredAuth();
  if (!auth.token || !auth.user) {
    window.location.href = 'login.html';
    return null;
  }

  const normalizedAllowedRoles =
    typeof allowedRoles === 'string'
      ? [allowedRoles]
      : Array.isArray(allowedRoles)
        ? allowedRoles
        : [];

  if (normalizedAllowedRoles.length > 0) {
    const userRole = String(auth.user.role || '').toLowerCase();
    const allowed = normalizedAllowedRoles.map((role) => String(role).toLowerCase());
    if (!allowed.includes(userRole)) {
      window.location.href = 'index.html';
      return null;
    }
  }

  return auth;
}

// =======================
// ROLE-BASED DASHBOARD ROUTING
// =======================
// Redirects users to their role-specific dashboard
// This creates proper architectural separation between user types
function redirectToDashboard(user) {
  if (!user || !user.role) {
    window.location.href = 'index.html';
    return;
  }

  const dashboardRoutes = {
    'citizen': 'dashboard-citizen.html',
    'admin': 'dashboard-admin.html',
    'authority': 'dashboard-authority.html'
  };

  const targetPage = dashboardRoutes[user.role.toLowerCase()] || 'index.html';
  window.location.href = targetPage;
}

// Get dashboard URL for current user (useful for navigation)
function getDashboardUrl() {
  const auth = getStoredAuth();
  if (!auth.user || !auth.user.role) {
    return 'index.html';
  }

  const dashboardRoutes = {
    'citizen': 'dashboard-citizen.html',
    'admin': 'dashboard-admin.html',
    'authority': 'dashboard-authority.html'
  };

  return dashboardRoutes[auth.user.role.toLowerCase()] || 'index.html';
}

const HELP_MODAL_ID = 'helpModal';
let helpModalInitialized = false;
let lastHelpTrigger = null;
let savedBodyOverflow = '';

function getHelpModal() {
  if (typeof document === 'undefined') {
    return null;
  }
  return document.getElementById(HELP_MODAL_ID);
}

function getHelpFocusableElements(modal) {
  if (!modal) {
    return [];
  }
  const selector = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(modal.querySelectorAll(selector)).filter(el => el.offsetParent !== null || el === document.activeElement);
}

function openHelpModal(trigger) {
  const modal = getHelpModal();
  if (!modal) {
    return;
  }
  lastHelpTrigger = trigger || document.activeElement;
  savedBodyOverflow = document.body.style.overflow;
  modal.classList.add('help-modal--visible');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  const panel = modal.querySelector('.help-modal__panel');
  if (panel) {
    panel.focus({ preventScroll: true });
  }
}

function closeHelpModal() {
  const modal = getHelpModal();
  if (!modal) {
    return;
  }
  modal.classList.remove('help-modal--visible');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = savedBodyOverflow;
  if (lastHelpTrigger && typeof lastHelpTrigger.focus === 'function') {
    lastHelpTrigger.focus({ preventScroll: true });
  }
  lastHelpTrigger = null;
}

function handleHelpModalKeydown(event) {
  const modal = getHelpModal();
  if (!modal || !modal.classList.contains('help-modal--visible')) {
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    closeHelpModal();
    return;
  }
  if (event.key === 'Tab') {
    const focusable = getHelpFocusableElements(modal);
    if (!focusable.length) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  }
}

function initHelpModal() {
  if (helpModalInitialized) {
    return;
  }
  const modal = getHelpModal();
  if (!modal) {
    return;
  }
  helpModalInitialized = true;
  const triggers = document.querySelectorAll('[data-help-trigger]');
  triggers.forEach(trigger => {
    trigger.addEventListener('click', event => {
      event.preventDefault();
      openHelpModal(trigger);
    });
  });
  modal.addEventListener('click', event => {
    if (event.target === modal) {
      closeHelpModal();
    }
  });
  modal.querySelectorAll('[data-help-dismiss]').forEach(el => {
    el.addEventListener('click', closeHelpModal);
  });
  document.addEventListener('keydown', handleHelpModalKeydown);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHelpModal);
  } else {
    initHelpModal();
  }
}
