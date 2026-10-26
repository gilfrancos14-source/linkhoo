import { useParams } from 'react-router-dom';
import { useHomePath } from '../../hooks/useHomePath';
import ClientAccountLayout from '../../components/ClientAccountLayout';
import MessagesWorkspace from './MessagesWorkspace';

/** Espace messages du client : liste des conversations + fil sélectionné. */
export default function ClientMessagesPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const homePath = useHomePath();
  const basePath = `${homePath}/messages`;

  return (
    <ClientAccountLayout active="messages">
      <div className="admin-content">
        <MessagesWorkspace side="client" basePath={basePath} conversationId={conversationId} />
      </div>
    </ClientAccountLayout>
  );
}
