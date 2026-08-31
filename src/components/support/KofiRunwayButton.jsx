/**
 * Runway CTA. Links to the funding URL in constants/runway.js.
 * Label stays human; vendor name is not shown.
 */

import {
  KOFI_PAGE_URL,
  KOFI_WIDGET_COLOR,
  KOFI_WIDGET_LABEL,
} from '../../constants/runway';

const KofiRunwayButton = ({ className = '', label = KOFI_WIDGET_LABEL }) => (
  <a
    href={KOFI_PAGE_URL}
    target="_blank"
    rel="noopener noreferrer"
    className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white border border-white/10 hover:brightness-110 transition-colors ${className}`}
    style={{ backgroundColor: KOFI_WIDGET_COLOR }}
  >
    {label}
  </a>
);

export default KofiRunwayButton;
