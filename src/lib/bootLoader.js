/**
 * Pre-React boot loader control (#tf-boot-loader in index.html).
 * First paint is dark CSS-only; call dismissBootLoader when React is ready.
 */

let bootDismissed = false;

export function dismissBootLoader() {
  if (bootDismissed) return;
  bootDismissed = true;

  const el = document.getElementById('tf-boot-loader');
  if (!el) return;

  const remove = () => {
    if (el.parentNode) el.parentNode.removeChild(el);
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.classList.add('tf-boot-hide');
      el.setAttribute('aria-busy', 'false');
      window.setTimeout(remove, 300);
    });
  });
}
