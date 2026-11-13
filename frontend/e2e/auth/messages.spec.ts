import { expect, test, type Page } from '@playwright/test';
import { makeConversation, makeMessage, mockApi } from '../fixtures';

/**
 * Parcours messagerie avec une session simulée (Clerk aliasé vers une doublure,
 * API interceptées). Couvre le badge de non-lus du rail « Mon espace » de bout
 * en bout : compteur → boîte de réception → fil → envoi, puis la pastille gérant.
 */
async function signIn(page: Page, role: 'client' | 'gerant'): Promise<void> {
  await page.addInitScript((value) => {
    window.localStorage.setItem('e2e:auth', JSON.stringify({ signedIn: true, role: value }));
  }, role);
}

test.describe('messagerie — client connecté', () => {
  test('badge de non-lus, boîte de réception et envoi de message', async ({ page }) => {
    await signIn(page, 'client');

    const conversation = makeConversation({
      id: 'conv-1',
      unread_count: 3,
      last_message: makeMessage({
        id: 'msg-rec-1',
        conversation_id: 'conv-1',
        sender_role: 'gerant',
        body: 'Bonjour, la chambre est-elle libre ?',
        read_at: null,
      }),
    });
    const received = makeMessage({
      id: 'msg-rec-1',
      conversation_id: 'conv-1',
      sender_role: 'gerant',
      body: 'Bonjour, la chambre est-elle libre ?',
      read_at: null,
    });

    await mockApi(page, {
      role: 'client',
      unreadCount: 3,
      conversations: [conversation],
      messages: [received],
    });

    // L'accès Messages vit dans le rail de l'espace client.
    await page.goto('/ci/compte');

    const messagesLink = page.getByRole('link', { name: /Messages/ });
    await expect(messagesLink).toBeVisible();
    // La pastille de non-lus vit dans la sidebar unifiée (`.bd`).
    await expect(messagesLink.locator('.bd')).toHaveText('3');

    await messagesLink.click();
    await expect(page).toHaveURL(/\/ci\/messages$/);

    // La liste des conversations (`.cv`) : titre de la chambre et compteur.
    const conversationLink = page.locator('a.cv').first();
    await expect(conversationLink.locator('h4')).toContainText('Studio Cocody Riviera');
    await expect(page.getByLabel('3 non lus').first()).toBeVisible();

    await conversationLink.click();
    await expect(page).toHaveURL(/\/ci\/messages\/conv-1$/);
    await expect(page.locator('.bm.ot p')).toContainText('la chambre est-elle libre');

    await page.getByLabel('Votre message').fill('Oui, elle est disponible en octobre.');
    await page.getByRole('button', { name: 'Envoyer' }).click();
    await expect(page.locator('.bm.me p')).toContainText('disponible en octobre');
  });
});

test.describe('messagerie — gérant connecté', () => {
  test('pastille de non-lus sur l’onglet Messages', async ({ page }) => {
    await signIn(page, 'gerant');
    await mockApi(page, { role: 'gerant', gerantUnreadCount: 5 });

    await page.goto('/ci/gerant/messages/boite-reception');

    await expect(
      page.locator('a[href$="/gerant/messages/boite-reception"] .sidebar__pill'),
    ).toHaveText('5');
    await expect(
      page.getByRole('heading', { name: 'Boîte de réception', level: 1 }),
    ).toBeVisible();
  });
});
