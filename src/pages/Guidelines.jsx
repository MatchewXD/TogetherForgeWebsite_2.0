import LegalDocument from '../components/legal/LegalDocument';
import {
  guidelinesMeta,
  guidelinesSections,
} from '../content/legal/guidelinesContent';

export default function Guidelines() {
  return (
    <LegalDocument meta={guidelinesMeta} sections={guidelinesSections} />
  );
}
