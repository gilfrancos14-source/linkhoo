import { test, type Page } from '@playwright/test';
import { makeConversation, makeMessage, mockApi } from '../fixtures';

async function signIn(page: Page, role: 'client' | 'gerant') {
  await page.addInitScript((value) => {
    window.localStorage.setItem('e2e:auth', JSON.stringify({ signedIn: true, role: value }));
  }, role);
}

async function measure(page: Page, url: string, sel: string, label: string) {
  await page.goto(url);
  await page.waitForSelector(sel, { timeout: 15000 }).catch(() => {});
  const vp = page.viewportSize();
  const box = await page.locator(sel).boundingBox();
  const topbar = await page.locator('.topbar, .site-header').first().boundingBox().catch(() => null);
  console.log(label, 'VP', JSON.stringify(vp), 'CHROME', JSON.stringify(topbar), 'BOX', JSON.stringify(box));
}

test('measure client messages', async ({ page }) => {
  await signIn(page, 'client');
  const conversation = makeConversation({
    id: 'conv-1',
    unread_count: 3,
    last_message: makeMessage({ id: 'msg-rec-1', conversation_id: 'conv-1', sender_role: 'gerant', body: 'Bonjour', read_at: null }),
  });
  await mockApi(page, {
    role: 'client',
    unreadCount: 3,
    conversations: [conversation],
    messages: [makeMessage({ id: 'msg-rec-1', conversation_id: 'conv-1', sender_role: 'gerant', body: 'Hello', read_at: null })],
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await measure(page, '/ci/messages', '.msg-workspace', 'CLIENT-MESSAGES');
  await measure(page, '/ci/compte', '.compte-shell', 'CLIENT-COMPTE');
});

test('measure gerant messages', async ({ page }) => {
  await signIn(page, 'gerant');
  await mockApi(page, { role: 'gerant', gerantUnreadCount: 5 });
  await page.setViewportSize({ width: 1440, height: 900 });
  await measure(page, '/ci/gerant/messages', '.msg-workspace', 'GERANT-MESSAGES');
});
