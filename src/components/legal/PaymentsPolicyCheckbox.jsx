/**
 * One-time Payments and refunds checkbox for the first on-site payment.
 * variant: studio (AI Tokens) | runway | agree (Donate page)
 */
import { Link } from 'react-router-dom';
import { LEGAL_PATHS, PAYMENTS_POLICY_REQUIRED_MESSAGE } from '../../constants/legal';

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

  return (
    <div
      className={`rounded-xl border px-3 py-3 transition-colors ${
        error
          ? 'border-red-400/80 bg-red-500/15'
          : 'border-white/15 bg-cyber-surface/40'
      } ${className}`}
    >
      <label
        className={`flex items-start gap-3 cursor-pointer text-sm leading-relaxed ${
          error ? 'text-red-200' : 'text-text-secondary'
        }`}
      >
        <input
          type="checkbox"
          className={`mt-1 shrink-0 ${error ? 'accent-red-400' : 'accent-neon-cyan'}`}
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
            className="text-neon-cyan hover:underline"
          >
            Payments and refunds policy
          </Link>
          {extra ? `. ${extra}` : '.'}
        </span>
      </label>
      {error ? (
        <p
          id="payments-policy-error"
          className="text-xs text-red-400 mt-2 leading-relaxed"
          role="alert"
        >
          {PAYMENTS_POLICY_REQUIRED_MESSAGE}
        </p>
      ) : null}
    </div>
  );
}
