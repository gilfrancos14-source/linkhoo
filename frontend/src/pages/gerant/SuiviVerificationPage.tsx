import { useHomePath } from '../../hooks/useHomePath';
import '../../styles/39-gerant-verification.css';
import SuiviVerificationSection from './verification/SuiviVerificationSection';

export default function SuiviVerificationPage() {
  const homePath = useHomePath();
  const gerantPath = `${homePath}/gerant`;

  return <SuiviVerificationSection gerantPath={gerantPath} />;
}
