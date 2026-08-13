import LegalDocument from '../components/legal/LegalDocument';
import { termsMeta, termsSections } from '../content/legal/termsContent';

export default function Terms() {
  return <LegalDocument meta={termsMeta} sections={termsSections} />;
}
