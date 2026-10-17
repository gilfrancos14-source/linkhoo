import { useParams } from 'react-router-dom';
import { useHomePath } from '../../hooks/useHomePath';
import ConversationThread from './ConversationThread';
import MessagesInbox from './MessagesInbox';

/** Espace messages du gérant : boîte de réception, ou fil si un id est fourni. */
export default function GerantMessagesPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const homePath = useHomePath();
  const basePath = `${homePath}/gerant/messages`;

  return conversationId ? (
    <ConversationThread conversationId={conversationId} role="gerant" basePath={basePath} />
  ) : (
    <MessagesInbox side="gerant" basePath={basePath} />
  );
}
