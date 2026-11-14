/**
 * One-time Payments and refunds checkbox for the first on-site payment.
 * variant: studio (AI Tokens) | runway | agree (Donate page)
 *
 * Styled to stand out while unchecked (gold), calm once checked (cyan) and
 * red when someone tries to pay without it.
 */
import { Link } from 'react-router-dom';
import { LEGAL_PATHS, PAYMENTS_POLICY_REQUIRED_MESSAGE } from '../../constants/legal';

export const PAYMENTS_POLICY_ANCHOR_ID = 'payments-policy-agreement';

/**
 * @param {object} props
 * @param {'studio'|'runway'|'agree'} [props.variant]
 * @param {boolean} props.checked
 * @param {(next: boolean) => void} props.onChange
 * @param {boolean} [props.error]
 * @param {string} [props.className]
 */
export default function PaymentsPolicyCheckbox({
  variant = 'studio',
  checked,
  onChange,
  error = false,
  className = '',
}) {
  const extra =
    variant === 'runway'
      ? 'This supports me personally. It does not go to the studio.'
      : variant === 'studio'
        ? 'Studio support stays with Together Forge. I do not take it as wages.'
        : '';

  const tone = error
    ? 'border-red-400/80 bg-red-500/15 shadow-[0_0_18px_rgba(248,113,113,0.25)]'
    : checked
      ? 'border-neon-cyan/50 bg-neon-cyan/5'
      : 'border-forge-gold/70 bg-forge-gold/10 shadow-[0_0_18px_rgba(245,197,66,0.15)]';

  return (
    <div
      id={PAYMENTS_POLICY_ANCHOR_ID}
      className={`rounded-xl border-2 px-4 py-3.5 transition-colors scroll-mt-28 ${tone} ${className}`}
    >
      {!checked && (
        <p
          className={`text-[10px] font-mono tracking-widest uppercase mb-2 ${
            error ? 'text-red-300' : 'text-forge-gold'
          }`}
        >
          Required before your first payment
        </p>
      )}
      <label
        className={`flex items-start gap-3 cursor-pointer text-sm sm:text-base leading-relaxed ${
          error ? 'text-red-100' : 'text-white'
        }`}
      >
        <input
          type="checkbox"
          className={`mt-1 h-5 w-5 shrink-0 cursor-pointer ${
            error ? 'accent-red-400' : checked ? 'accent-neon-cyan' : 'accent-forge-gold'
          }`}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'payments-policy-error' : undefined}
        />
        <span>
          By paying, I agree to the{' '}
          <Link
            to={LEGAL_PATHS.payments}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neon-cyan underline underline-offset-2 hover:text-white"
          >
            Payments and refunds policy
          </Link>
          {extra ? `. ${extra}` : '.'}
        </span>
      </label>
      {error ? (
        <p
          id="payments-policy-error"
          className="text-xs text-red-300 mt-2 leading-relaxed"
          role="alert"
        >
          {PAYMENTS_POLICY_REQUIRED_MESSAGE}
        </p>
      ) : null}
    </div>
  );
}
