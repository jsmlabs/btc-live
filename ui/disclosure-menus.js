// Native details retain their keyboard behavior; only dismissal and exclusivity are added.
export function bindDisclosureMenus(root = document) {
  const menus = [...root.querySelectorAll('.chart-menu, .presentation-menu')];
  const onToggle = event => {
    if (!event.target.open) return;
    for (const menu of menus) if (menu !== event.target) menu.open = false;
  };
  const onPointer = event => {
    for (const menu of menus) if (menu.open && !menu.contains(event.target)) menu.open = false;
  };
  const onKey = event => {
    if (event.key !== 'Escape') return;
    const menu = menus.find(item => item.open && item.contains(root.activeElement));
    if (!menu) return;
    event.preventDefault();
    menu.open = false;
    menu.querySelector('summary').focus();
  };
  for (const menu of menus) menu.addEventListener('toggle', onToggle);
  root.addEventListener('pointerdown', onPointer);
  root.addEventListener('keydown', onKey);
  return { dispose() {
    for (const menu of menus) menu.removeEventListener('toggle', onToggle);
    root.removeEventListener('pointerdown', onPointer);
    root.removeEventListener('keydown', onKey);
  } };
}
