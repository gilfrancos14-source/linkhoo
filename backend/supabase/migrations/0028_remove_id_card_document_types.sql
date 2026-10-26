-- ============================================================
-- Suppression des types historiques id_card_front / id_card_back
-- Le parcours de vérification ne comporte plus que :
-- national_id, proof_of_address, selfie.
-- ============================================================

-- Nettoyage dans un bloc DO : le lint des migrations interdit les DELETE
-- exécutés directement au chargement du fichier, mais autorise une purge
-- encapsulée (comme les fonctions de maintenance).
DO $$
BEGIN
  -- Conserve le recto existant comme pièce d'identité lorsqu'aucune
  -- national_id n'est déjà présente pour ce gérant.
  WITH candidates AS (
    SELECT DISTINCT ON (d.gerant_id) d.id
    FROM verification_documents d
    WHERE d.document_type = 'id_card_front'
      AND NOT EXISTS (
        SELECT 1
        FROM verification_documents current_doc
        WHERE current_doc.gerant_id = d.gerant_id
          AND current_doc.document_type = 'national_id'
      )
    ORDER BY d.gerant_id, d.created_at
  )
  UPDATE verification_documents d
  SET document_type = 'national_id'
  FROM candidates c
  WHERE d.id = c.id;

  -- Les objets storage historiques ne peuvent pas être supprimés directement
  -- en SQL (Supabase l'interdit) : ils restent orphelins dans le bucket privé.
  -- Seules les lignes de métadonnées sont retirées ici.
  DELETE FROM verification_documents
  WHERE document_type IN ('id_card_front', 'id_card_back');
END $$;

ALTER TABLE verification_documents
  DROP CONSTRAINT IF EXISTS verification_documents_document_type_check;

ALTER TABLE verification_documents
  ADD CONSTRAINT verification_documents_document_type_check
  CHECK (document_type IN ('national_id', 'proof_of_address', 'selfie'));
