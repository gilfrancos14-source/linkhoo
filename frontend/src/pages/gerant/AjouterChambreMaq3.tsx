import { useCallback, useState } from 'react';
import { useHomePath } from '../../hooks/useHomePath';
import { emptyForm, type PreviewSnapshot } from './ajouter-chambre/form';
import ChambreFormPage from './ChambreFormPage';
import ChambreFormMaq3 from './ChambreFormMaq3';

export default function AjouterChambreMaq3() {
  const homePath = useHomePath();
  const chambresPath = `${homePath}/gerant/chambres`;

  const [preview, setPreview] = useState<PreviewSnapshot>({
    form: { ...emptyForm },
    photos: [],
    mainPhotoIndex: 0,
    categoryTitle: '',
  });
  const handlePreviewChange = useCallback(
    (snapshot: PreviewSnapshot) => setPreview(snapshot),
    [],
  );

  return (
    <ChambreFormPage
      heading="Ajouter une chambre"
      intro="Suivez les étapes pour publier votre chambre rapidement."
      backPath={chambresPath}
      preview={preview}
    >
      <ChambreFormMaq3 onPreviewChange={handlePreviewChange} />
    </ChambreFormPage>
  );
}
