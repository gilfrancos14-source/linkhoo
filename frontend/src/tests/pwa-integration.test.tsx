import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import PWAControlPanel from '../components/PWAControlPanel';

// Les hooks PWA touchent aux API navigateur : on les remplace par des
// valeurs stables pour tester uniquement le rendu du panneau.
vi.mock('../hooks/usePushNotifications', () => ({
  usePushNotifications: () => ({
    permission: 'default',
    requestPermission: vi.fn().mockResolvedValue('granted'),
    showNotification: vi.fn(),
    supported: true,
  }),
}));

vi.mock('../hooks/useOfflineQueue', () => ({
  useOfflineQueue: () => ({
    status: {
      pendingRequests: [],
      failedRequests: [],
      isSyncing: false,
      totalSynced: 0,
      lastSynced: null,
    },
    syncAll: vi.fn(),
    retryFailed: vi.fn(),
    clearQueue: vi.fn(),
    addRequest: vi.fn(),
    removeRequest: vi.fn(),
  }),
}));

vi.mock('../hooks/useCacheManager', () => ({
  useCacheManager: () => ({
    stats: null,
    refreshStats: vi.fn(),
    optimizeCache: vi.fn(),
    clearAllCaches: vi.fn(),
    clearCache: vi.fn(),
  }),
}));

describe('PWA Control Panel', () => {
  afterEach(cleanup);

  it('affiche le bouton flottant puis ouvre le panneau', () => {
    render(<PWAControlPanel autoShow={false} />);

    const toggle = screen.getByRole('button', { name: 'Paramètres PWA' });
    expect(toggle).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(screen.getByText('Paramètres PWA')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Notifications/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hors-ligne/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cache/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Installer/ })).toBeInTheDocument();
  });

  it('affiche le déclencheur inline dans le footer', () => {
    render(<PWAControlPanel autoShow={false} variant="inline" />);

    const toggle = screen.getByRole('button', { name: 'Paramètres PWA' });
    expect(toggle).toHaveTextContent('Application');
    expect(toggle.closest('.pwa-control-panel-toggle--inline')).not.toBeNull();

    fireEvent.click(toggle);

    expect(screen.getByText('Paramètres PWA')).toBeInTheDocument();
  });
});
