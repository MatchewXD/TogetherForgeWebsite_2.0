/**
 * Place a Community Award on a Showcase post or idea.
 * Two-step: pick tier (and optional message) → confirm spend.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Buttons';
import { supabase } from '../../lib/supabase';
import {
  FORGE_AWARD_TIERS,
  FORGE_AWARD_MESSAGE_MAX,
  formatForgeMarks,
  giverAlreadyPlacedTier,
} from '../../utils/forgeMarks';
import {
  fetchMyForgeMarks,
  placeForgeAward,
} from '../../services/forgeMarksService';
import { AwardTierIcon } from './awardIcons';
import ForgeMarksHoverHint from './ForgeMarksHoverHint';

export default function PlaceCommunityAward({
  targetType,
  targetId,
  targetTitle = 'this post',
  receiverId = null,
  viewerId = null,
  awards = [],
  disabled = false,
  onPlaced,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState('pick');
  const [tierId, setTierId] = useState(null);
  const [message, setMessage] = useState('');
  const [balance, setBalance] = useState(null);
  const [loadingBal, setLoadingBal] = useState(false);
  const [giverProfile, setGiverProfile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const canAward =
    Boolean(viewerId) &&
    Boolean(receiverId) &&
    String(viewerId) !== String(receiverId) &&
    Boolean(targetId) &&
    !disabled;

  const selected = useMemo(
    () => FORGE_AWARD_TIERS.find((t) => t.id === tierId) || null,
    [tierId]
  );

  useEffect(() => {
    if (!open) return undefined;
    let mounted = true;
    setLoadingBal(true);
    fetchMyForgeMarks()
      .then((st) => {
        if (!mounted) return;
        setBalance(st);
        setLoadingBal(false);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.message || 'Could not load your Marks.');
        setLoadingBal(false);
      });
    if (viewerId) {
      supabase
        .from('profiles')
        .select('username, avatar_url, pinned_badge_key')
        .eq('id', viewerId)
        .maybeSingle()
        .then(({ data }) => {
          if (!mounted || !data) return;
          setGiverProfile({
            username: data.username || null,
            avatarUrl: data.avatar_url || null,
            pinnedBadgeKey: data.pinned_badge_key || null,
          });
        })
        .catch(() => {});
    }
    return () => {
      mounted = false;
    };
  }, [open, viewerId]);

  const reset = () => {
    setStep('pick');
    setTierId(null);
    setMessage('');
    setError('');
    setBusy(false);
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const goConfirm = () => {
    if (!selected) return;
    if (giverAlreadyPlacedTier(awards, viewerId, selected.id)) {
      setError(`You already placed a ${selected.name} on this post.`);
      return;
    }
    if ((balance?.balance ?? 0) < selected.marksCost) {
      setError(
        `Not enough Marks. ${selected.name} costs ${formatForgeMarks(selected.marksCost)}.`
      );
      return;
    }
    setError('');
    setStep('confirm');
  };

  const confirmPlace = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setError('');
    try {
      const msg = selected.allowsMessage ? message.trim() : '';
      const placed = await placeForgeAward({
        tierId: selected.id,
        targetType,
        targetId,
        message: msg || null,
      });
      const nextBal = await fetchMyForgeMarks().catch(() => null);
      if (nextBal) setBalance(nextBal);
      onPlaced?.({
        ...placed,
        giverId: viewerId,
        giverUsername: giverProfile?.username || null,
        giverAvatarUrl: giverProfile?.avatarUrl || null,
        giverPinnedBadgeKey: giverProfile?.pinnedBadgeKey || null,
        awardTier: selected.id,
        awardName: selected.name,
      });
      close();
    } catch (e) {
      setError(e?.message || 'Could not place award.');
      setBusy(false);
    }
  };

  if (!receiverId || disabled) return null;

  return (
    <div className={`inline-flex shrink-0 ${className}`}>
      {canAward ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="gap-1.5"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
        >
          <Award className="w-3.5 h-3.5" aria-hidden />
          Award
        </Button>
      ) : !viewerId ? (
        <Link
          to="/account"
          className="inline-flex items-center gap-1.5 text-xs font-mono tracking-widest uppercase text-text-muted hover:text-neon-cyan"
          onClick={(e) => e.stopPropagation()}
        >
          <Award className="w-3.5 h-3.5" aria-hidden />
          Sign in to award
        </Link>
      ) : null}

      <Modal
        isOpen={open}
        onClose={close}
        title="Place a Community Award"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary leading-relaxed">
            Spend Forge Marks to permanently award{' '}
            <span className="text-white font-medium">{targetTitle}</span>.
            Awards cannot be removed later.
          </p>

          <p className="text-xs font-mono tracking-widest uppercase text-text-muted inline-flex items-center gap-1.5 flex-wrap">
            <span>Your balance:</span>
            <ForgeMarksHoverHint align="start">
              <span className="text-forge-gold">
                {loadingBal ? '…' : formatForgeMarks(balance?.balance ?? 0)}{' '}
                Marks
              </span>
            </ForgeMarksHoverHint>
          </p>

          {error && (
            <p className="text-sm text-red-200" role="alert">
              {error}{' '}
              {/not enough/i.test(error) && (
                <Link to="/account/forge-marks" className="text-neon-cyan">
                  View Marks
                </Link>
              )}
            </p>
          )}

          {step === 'pick' && (
            <>
              <ul className="space-y-2 list-none p-0 m-0">
                {FORGE_AWARD_TIERS.map((tier) => {
                  const already = giverAlreadyPlacedTier(
                    awards,
                    viewerId,
                    tier.id
                  );
                  const tooPoor =
                    !loadingBal &&
                    balance != null &&
                    (balance.balance ?? 0) < tier.marksCost;
                  const selectedHere = tierId === tier.id;
                  return (
                    <li key={tier.id}>
                      <button
                        type="button"
                        disabled={already}
                        onClick={() => {
                          setTierId(tier.id);
                          setError('');
                        }}
                        className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                          selectedHere
                            ? 'border-forge-gold/60 bg-forge-gold/10'
                            : 'border-cyber-border bg-cyber-surface/50 hover:border-forge-gold/35'
                        } ${already ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="inline-flex items-center gap-2 text-white font-semibold">
                            <AwardTierIcon
                              tierId={tier.id}
                              className="w-7 h-7"
                              alt=""
                            />
                            {tier.name}
                          </span>
                          <span className="text-sm font-mono tabular-nums text-forge-gold">
                            {formatForgeMarks(tier.marksCost)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-text-muted">
                          {already
                            ? 'You already placed this award here.'
                            : tooPoor
                              ? 'Not enough Marks.'
                              : tier.description}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {selected?.allowsMessage && (
                <div>
                  <label
                    htmlFor="award-msg"
                    className="block text-xs font-mono tracking-widest uppercase text-neon-cyan mb-2"
                  >
                    Optional message
                  </label>
                  <textarea
                    id="award-msg"
                    value={message}
                    onChange={(e) =>
                      setMessage(e.target.value.slice(0, FORGE_AWARD_MESSAGE_MAX))
                    }
                    maxLength={FORGE_AWARD_MESSAGE_MAX}
                    rows={3}
                    className="w-full bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none"
                    placeholder="A short note on why this stands out"
                  />
                  <p className="mt-1 text-[11px] font-mono text-text-muted">
                    {message.length}/{FORGE_AWARD_MESSAGE_MAX}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={close}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={
                    !selected ||
                    loadingBal ||
                    (balance != null &&
                      (balance.balance ?? 0) < selected.marksCost)
                  }
                  onClick={goConfirm}
                >
                  Continue
                </Button>
              </div>
            </>
          )}

          {step === 'confirm' && selected && (
            <>
              <div className="rounded-lg border border-forge-gold/35 bg-forge-gold/5 px-4 py-3 space-y-1.5">
                <p className="text-sm text-white">
                  Place <span className="font-semibold">{selected.name}</span>{' '}
                  on {targetTitle}?
                </p>
                <p className="text-sm text-text-secondary">
                  This spends{' '}
                  <span className="text-forge-gold font-mono">
                    {formatForgeMarks(selected.marksCost)} Marks
                  </span>
                  . Remaining balance:{' '}
                  {formatForgeMarks(
                    Math.max(0, (balance?.balance ?? 0) - selected.marksCost)
                  )}
                  . Permanent: you cannot take it back.
                </p>
                {selected.allowsMessage && message.trim() && (
                  <p className="text-xs text-text-muted italic">
                    “{message.trim()}”
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep('pick')}
                  disabled={busy}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={confirmPlace}
                  disabled={busy}
                  className="gap-2"
                >
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                  Spend {formatForgeMarks(selected.marksCost)} Marks
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
