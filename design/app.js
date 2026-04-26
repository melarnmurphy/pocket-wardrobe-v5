// Minimal JS for modal, drawer, and tab switching across design mockups.

(function () {
  // Open/close elements declared via data-open-modal="#id" / data-close-modal
  document.addEventListener('click', function (e) {
    const openEl = e.target.closest('[data-open-modal]');
    if (openEl) {
      e.preventDefault();
      const sel = openEl.getAttribute('data-open-modal');
      const target = document.querySelector(sel);
      if (target) target.classList.add('open');
      return;
    }
    const closeEl = e.target.closest('[data-close-modal]');
    if (closeEl) {
      e.preventDefault();
      const parent = closeEl.closest('.overlay, .drawer');
      if (parent) parent.classList.remove('open');
      return;
    }
    const openDrawer = e.target.closest('[data-open-drawer]');
    if (openDrawer) {
      e.preventDefault();
      const sel = openDrawer.getAttribute('data-open-drawer');
      const target = document.querySelector(sel);
      if (target) target.classList.add('open');
      return;
    }
    // Click outside modal content = close
    if (e.target.classList && e.target.classList.contains('overlay')) {
      e.target.classList.remove('open');
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.overlay.open, .drawer.open').forEach(n => n.classList.remove('open'));
    }
  });

  // Tab groups: [data-tabgroup="name"] toggles [data-tab="name"] active state.
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-tabgroup]');
    if (!btn) return;
    const group = btn.getAttribute('data-tabgroup');
    document.querySelectorAll(`[data-tabgroup="${group}"]`).forEach(n => n.classList.remove('active'));
    btn.classList.add('active');
    const value = btn.getAttribute('data-tabvalue');
    if (value) {
      document.querySelectorAll(`[data-tabpanel="${group}"]`).forEach(n => {
        n.style.display = n.getAttribute('data-tabvalue') === value ? '' : 'none';
      });
    }
  });

  // Toggle classes on elements (e.g., chip selection, favourite heart)
  document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-toggle-class]');
    if (!el) return;
    e.preventDefault();
    const cls = el.getAttribute('data-toggle-class');
    el.classList.toggle(cls);
  });

  // Simple lightweight "day select" for planner
  document.addEventListener('click', function (e) {
    const day = e.target.closest('.week-strip .day');
    if (!day) return;
    day.parentElement.querySelectorAll('.day.selected').forEach(n => n.classList.remove('selected'));
    day.classList.add('selected');
  });
})();
