import { useParams } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { useHomePath } from '../../hooks/useHomePath';
import { useClientUnread } from '../../hooks/useClientUnread';
import ClientMessagesMaq from './ClientMessagesMaq';

/**
 * Espace messages du client — conversion de la maquette
 * habici-mes-messages.html : liste des conversations + fil sélectionné,
 * la page porte sa propre sidebar et son propre topbar.
 */
export default function ClientMessagesPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const homePath = useHomePath();
  const basePath = `${homePath}/messages`;
  const unreadMessages = useClientUnread();
  const { user } = useUser();

  return (
    <ClientMessagesMaq
      basePath={basePath}
      conversationId={conversationId}
      homePath={homePath}
      displayName={user?.firstName || 'Client'}
      profileFirstName={user?.firstName || ''}
      profileLastName={user?.lastName || ''}
      avatarUrl={user?.imageUrl}
      unreadMessages={unreadMessages}
    />
  );
}
