import LegalDocument from '../components/legal/LegalDocument';
import {
  paymentsMeta,
  paymentsSections,
} from '../content/legal/paymentsContent';

export default function Payments() {
  return <LegalDocument meta={paymentsMeta} sections={paymentsSections} />;
}
