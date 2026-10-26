import ConversationThread from './ConversationThread';
import MessagesInbox from './MessagesInbox';

interface MessagesWorkspaceProps {
  side: 'client' | 'gerant';
  /** Préfixe des routes de messagerie, ex. /ci/messages ou /ci/gerant/messages. */
  basePath: string;
  /** Conversation ouverte, affichée dans le panneau de droite. */
  conversationId?: string;
}

/**
 * Messagerie en plan de travail : liste des conversations à gauche, fil de
 * discussion à droite (ou invite tant qu'aucune n'est sélectionnée). Les deux
 * panneaux partagent la même page ; un clic dans la liste change la route et
 * remplit le panneau de droite sans quitter la vue.
 */
export default function MessagesWorkspace({
  side,
  basePath,
  conversationId,
}: MessagesWorkspaceProps) {
  return (
    <main
      className={`messages-page messages-page--workspace${conversationId ? ' is-thread-open' : ''}`}
    >
      <div className="container">
        <div className="msg-workspace">
          <MessagesInbox side={side} basePath={basePath} activeId={conversationId} />

          {conversationId ? (
            <ConversationThread
              conversationId={conversationId}
              role={side}
              basePath={basePath}
            />
          ) : (
            <div className="msg-panel msg-panel--placeholder">
              <span className="msg-panel__placeholder-icon" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              </span>
              <p className="msg-panel__placeholder-text">
                Sélectionnez une conversation à gauche pour afficher les échanges.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
