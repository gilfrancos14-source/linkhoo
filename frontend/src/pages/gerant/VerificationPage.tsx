import { useHomePath } from '../../hooks/useHomePath';
import VerificationStaticSection from './verification/VerificationStaticSection';

export default function VerificationPage() {
  const homePath = useHomePath();
  const gerantPath = `${homePath}/gerant`;

  return <VerificationStaticSection gerantPath={gerantPath} />;
}
