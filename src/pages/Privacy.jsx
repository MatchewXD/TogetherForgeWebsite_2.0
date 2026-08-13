import LegalDocument from '../components/legal/LegalDocument';
import { privacyMeta, privacySections } from '../content/legal/privacyContent';

export default function Privacy() {
  return <LegalDocument meta={privacyMeta} sections={privacySections} />;
}
