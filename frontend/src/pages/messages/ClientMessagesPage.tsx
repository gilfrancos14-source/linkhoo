import { useParams } from 'react-router-dom';
import { useHomePath } from '../../hooks/useHomePath';
import ConversationThread from './ConversationThread';
import MessagesInbox from './MessagesInbox';

/** Espace messages du client : boîte de réception, ou fil si un id est fourni. */
export default function ClientMessagesPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const homePath = useHomePath();
  const basePath = `${homePath}/messages`;

  return conversationId ? (
    <ConversationThread conversationId={conversationId} role="client" basePath={basePath} />
  ) : (
    <MessagesInbox side="client" basePath={basePath} />
  );
}
