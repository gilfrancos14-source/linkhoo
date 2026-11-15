import { useState, useCallback } from 'react';

/**
 * État partagé pour le menu latéral mobile des pages gérant (blank pages).
 * Chaque page appelle ce hook et passe `mobileOpen` / `onClose` à
 * `GerantSidebar` + backdrop.
 */
export function useMobileSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const open = useCallback(() => setMobileOpen(true), []);
  const close = useCallback(() => setMobileOpen(false), []);
  const toggle = useCallback(() => setMobileOpen((v) => !v), []);
  return { mobileOpen, open, close, toggle };
}
