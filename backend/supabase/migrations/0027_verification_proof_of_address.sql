-- ============================================================
-- Vérification : pièce d'identité + justificatif de domicile + selfie
-- ============================================================
ALTER TABLE verification_documents DROP CONSTRAINT IF EXISTS verification_documents_document_type_check;
ALTER TABLE verification_documents ADD CONSTRAINT verification_documents_document_type_check
  CHECK (document_type IN ('national_id', 'selfie', 'id_card_front', 'id_card_back', 'proof_of_address'));
