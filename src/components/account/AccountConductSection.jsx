/**
 * The signed-in user can see their own notices, strike count, restrictions, and case IDs.
 * Not reporter identity. Not staff notes.
 */

import { useEffect, useState } from 'react';
import { CONDUCT_EMAIL } from '../../constants/conduct';
import { getMyConductFile, markNoticeRead } from '../../services/conductService';
import Card from '../ui/Card';

function formatWhen(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function AccountConductSection() {
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    getMyConductFile()
      .then((data) => {
        if (mounted) setFile(data);
      })
      .catch((e) => {
        if (mounted) setError(e?.message || 'Could not load notices.');
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (error) {
    return <p className="text-sm text-red-200">{error}</p>;
  }
  if (!file || file.missing) {
    return null;
  }

  const notices = Array.isArray(file.notices) ? file.notices : [];
  const caseIds = Array.isArray(file.caseIds) ? file.caseIds : [];
  const restrictions = [];
  if (file.restrictClaimsPermanent || file.restrictClaimsUntil) {
    restrictions.push(
      file.restrictClaimsPermanent
        ? 'New task claims blocked until staff lift it'
        : `New task claims blocked until ${formatWhen(file.restrictClaimsUntil)}`
    );
  }
  if (file.restrictIdeasPermanent || file.restrictIdeasUntil) {
    restrictions.push(
      file.restrictIdeasPermanent
        ? 'Idea submissions blocked until staff lift it'
        : `Idea submissions blocked until ${formatWhen(file.restrictIdeasUntil)}`
    );
  }
  if (file.restrictCommentsPermanent || file.restrictCommentsUntil) {
    restrictions.push(
      file.restrictCommentsPermanent
        ? 'Comments blocked until staff lift it'
        : `Comments blocked until ${formatWhen(file.restrictCommentsUntil)}`
    );
  }
  if (file.restrictShowcasePermanent || file.restrictShowcaseUntil) {
    restrictions.push(
      file.restrictShowcasePermanent
        ? 'Showcase uploads blocked until staff lift it'
        : `Showcase uploads blocked until ${formatWhen(file.restrictShowcaseUntil)}`
    );
  }

  if (
    !notices.length &&
    !caseIds.length &&
    !(file.strikeCount > 0) &&
    !restrictions.length &&
    !file.banned &&
    !file.suspendedUntil
  ) {
    return (
      <Card className="bg-cyber-card/80">
        <h3 className="text-sm font-semibold text-white">Notices</h3>
        <p className="text-sm text-text-muted mt-1">
          No conduct notices on this account.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-cyber-card/80 space-y-2">
        <h3 className="text-sm font-semibold text-white">Account notices</h3>
        <p className="text-sm text-text-secondary">
          Strike count: {Number(file.strikeCount) || 0}
        </p>
        {file.suspendedUntil ? (
          <p className="text-sm text-text-secondary">
            Sign-in is paused until {formatWhen(file.suspendedUntil)}.
          </p>
        ) : null}
        {restrictions.map((line) => (
          <p key={line} className="text-sm text-text-secondary">
            {line}
          </p>
        ))}
        {caseIds.length ? (
          <p className="text-xs font-mono text-text-muted">
            Case IDs: {caseIds.filter(Boolean).join(', ')}
          </p>
        ) : null}
        <p className="text-xs text-text-muted">
          To dispute a decision, email {CONDUCT_EMAIL} and include the case ID.
        </p>
      </Card>
      {notices.map((n) => (
        <Card
          key={n.id}
          className={`bg-cyber-card/80 ${n.readAt ? 'opacity-80' : ''}`}
        >
          <p className="text-[11px] font-mono text-text-muted">
            {n.caseCode || 'Case'} · {formatWhen(n.createdAt)}
          </p>
          <p className="text-sm text-text-secondary mt-2 leading-relaxed whitespace-pre-wrap">
            {n.body}
          </p>
          {!n.readAt ? (
            <button
              type="button"
              className="mt-2 text-xs font-mono text-neon-cyan hover:underline"
              onClick={() => void markNoticeRead(n.id)}
            >
              Mark read
            </button>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
