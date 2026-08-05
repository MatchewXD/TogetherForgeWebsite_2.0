import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ImagePlus, X, Move } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { publicProfilePath } from '../utils/profileLinks';
import {
  parseBannerPosition,
  formatBannerPosition,
  bannerObjectPosition,
  DEFAULT_BANNER_POSITION,
} from '../utils/bannerPosition';

const BANNER_MAX_BYTES = 5 * 1024 * 1024; // 5MB
const BANNER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const BANNER_BUCKET = 'avatars';

/** Ideal display area is wide and short (~3:1). */
const BANNER_SIZE_TIPS =
  'Recommended size: 1500 × 500 px (3:1 landscape). Larger images are fine — drag the preview to choose which part shows. JPEG, PNG, or WebP · max 5MB.';

const EditProfile = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState('');
  const [favoriteGames, setFavoriteGames] = useState('');
  const [favoriteTypes, setFavoriteTypes] = useState('');
  const [discord, setDiscord] = useState('');
  const [youtube, setYoutube] = useState('');
  const [twitch, setTwitch] = useState('');
  const [xHandle, setXHandle] = useState('');
  const [signature, setSignature] = useState('');

  const [bannerUrl, setBannerUrl] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);
  const [removeBanner, setRemoveBanner] = useState(false);
  const [bannerPos, setBannerPos] = useState(DEFAULT_BANNER_POSITION);
  const [draggingBanner, setDraggingBanner] = useState(false);
  const bannerFrameRef = useRef(null);
  const dragRef = useRef(null);

  // Tag input helpers (comma-separated strings <-> chips)
  const TagInput = ({ label, value, onChange }) => {
    const [draft, setDraft] = useState('');
    const tags = value
      ? value
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const addTag = () => {
      const t = draft.trim();
      if (!t) return;
      if (tags.includes(t)) {
        setDraft('');
        return;
      }
      const next = [...tags, t].join(', ');
      onChange(next);
      setDraft('');
    };
    const removeTag = (tag) => {
      const next = tags.filter((t) => t !== tag).join(', ');
      onChange(next);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addTag();
      }
    };

    return (
      <div className="mb-4">
        <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">
          {label}
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.length === 0 && (
            <span className="text-xs text-text-muted">No tags yet</span>
          )}
          {tags.map((tag, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 bg-cyber-surface border border-white/20 px-3 py-1 rounded text-sm"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="text-neon-cyan hover:text-white"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-cyber-surface border border-white/20 p-3 text-white outline-none rounded"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={addTag}
            placeholder="Type and press Enter"
          />
          <button type="button" onClick={addTag} className="btn-neon px-4">
            Add
          </button>
        </div>
      </div>
    );
  };

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate('/profile');
        return;
      }
      setUser(session.user);

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();
      if (data) {
        setProfile(data);
        setBio(data.bio || data.about || '');
        setInterests(data.interests || '');
        setFavoriteGames(data.favorite_games || '');
        setFavoriteTypes(data.favorite_game_types || '');
        setDiscord(data.discord || '');
        setYoutube(data.youtube || '');
        setTwitch(data.twitch || '');
        setXHandle(data.x_handle || '');
        setSignature(data.signature || '');
        setBannerUrl(data.banner_url || null);
        setBannerPos(parseBannerPosition(data.banner_position));
      }
    };
    init();
  }, [navigate]);

  useEffect(() => {
    return () => {
      if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    };
  }, [bannerPreview]);

  const onBannerPick = useCallback((e) => {
    const file = e.target.files?.[0] || null;
    e.target.value = '';
    if (!file) return;
    if (!BANNER_TYPES.includes(file.type)) {
      setMessage('Banner must be JPEG, PNG, or WebP.');
      return;
    }
    if (file.size > BANNER_MAX_BYTES) {
      setMessage('Banner must be under 5MB.');
      return;
    }
    setMessage('');
    setRemoveBanner(false);
    setBannerFile(file);
    // New image: start centered; user can drag to reframe
    setBannerPos({ ...DEFAULT_BANNER_POSITION });
    setBannerPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }, []);

  const clearBanner = useCallback(() => {
    setBannerFile(null);
    setBannerPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setBannerPos({ ...DEFAULT_BANNER_POSITION });
    if (bannerUrl) setRemoveBanner(true);
  }, [bannerUrl]);

  const onBannerPointerDown = useCallback(
    (e) => {
      const hasImage =
        Boolean(bannerPreview) ||
        (Boolean(bannerUrl) && !removeBanner);
      if (!hasImage) return;
      e.preventDefault();
      const frame = bannerFrameRef.current;
      if (!frame) return;
      const rect = frame.getBoundingClientRect();
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originX: bannerPos.x,
        originY: bannerPos.y,
        width: rect.width || 1,
        height: rect.height || 1,
      };
      setDraggingBanner(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* optional */
      }
    },
    [bannerPos.x, bannerPos.y, bannerPreview, bannerUrl, removeBanner]
  );

  const onBannerPointerMove = useCallback((e) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    // Drag image with the pointer (inverse of moving the crop window)
    const nextX = Math.min(
      100,
      Math.max(0, d.originX - (dx / d.width) * 100)
    );
    const nextY = Math.min(
      100,
      Math.max(0, d.originY - (dy / d.height) * 100)
    );
    setBannerPos({ x: nextX, y: nextY });
  }, []);

  const onBannerPointerUp = useCallback((e) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDraggingBanner(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* optional */
    }
  }, []);

  const uploadBannerFile = async (file, userId) => {
    const ext =
      (file.name && file.name.split('.').pop()?.toLowerCase()) ||
      (file.type === 'image/png' ? 'png' : 'jpg');
    const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
    const path = `${userId}/banner.${safeExt}`;

    const { error: upErr } = await supabase.storage
      .from(BANNER_BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type,
      });

    if (upErr) {
      if (/bucket|not found|does not exist/i.test(upErr.message || '')) {
        throw new Error(
          'Image storage is not set up. Create a public "avatars" bucket or run supabase/sql/supabase_profiles_banner.sql.'
        );
      }
      throw upErr;
    }

    const { data } = supabase.storage.from(BANNER_BUCKET).getPublicUrl(path);
    return `${data?.publicUrl || ''}?v=${Date.now()}`;
  };

  const save = async () => {
    if (!user) return;
    setLoading(true);
    setMessage('');

    let nextBannerUrl = bannerUrl;
    try {
      if (bannerFile) {
        nextBannerUrl = await uploadBannerFile(bannerFile, user.id);
      } else if (removeBanner) {
        nextBannerUrl = null;
      }
    } catch (imgErr) {
      setMessage(imgErr?.message || 'Banner upload failed.');
      setLoading(false);
      return;
    }

    const patch = {
      bio: bio || null,
      interests: interests || null,
      favorite_games: favoriteGames || null,
      favorite_game_types: favoriteTypes || null,
      discord: discord || null,
      youtube: youtube || null,
      twitch: twitch || null,
      x_handle: xHandle || null,
      signature: signature || null,
      banner_url: nextBannerUrl,
      banner_position: nextBannerUrl
        ? formatBannerPosition(bannerPos)
        : null,
    };

    let { error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', user.id)
      .select()
      .single();

    // Strip optional missing columns and retry
    if (error) {
      let body = { ...patch };
      const optional = ['banner_position', 'banner_url'];
      for (const col of optional) {
        if (
          error &&
          body[col] !== undefined &&
          (error.message || '').toLowerCase().includes(col) &&
          /column|schema cache|could not find/i.test(error.message || '')
        ) {
          delete body[col];
          ({ error } = await supabase
            .from('profiles')
            .update(body)
            .eq('id', user.id)
            .select()
            .single());
        }
      }
      if (
        !error &&
        (patch.banner_url || patch.banner_position) &&
        !body.banner_url &&
        !body.banner_position
      ) {
        setMessage(
          'Profile saved, but banner fields could not be stored. Run supabase/sql/supabase_profiles_banner.sql in Supabase, then try the banner again.'
        );
        setLoading(false);
        return;
      }
    }

    if (error) {
      console.error('Save failed:', error.message);
      setMessage(error.message || 'Save failed.');
      setLoading(false);
      return;
    }

    navigate('/profile');
  };

  const displayBanner =
    bannerPreview || (!removeBanner && bannerUrl ? bannerUrl : null);

  return (
    <div className="pt-20 min-h-screen">
      <div className="border-b border-white/10 bg-cyber-surface py-16">
        <div className="container-custom">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <div className="section-header">EDIT PROFILE</div>
              <h1 className="text-4xl font-bold tracking-tight text-white">
                Edit your profile
              </h1>
            </div>
            {publicProfilePath(profile?.username) && (
              <Link
                to={publicProfilePath(profile.username)}
                className="text-xs px-4 py-2 rounded-full border border-neon-cyan/40 hover:border-neon-cyan text-neon-cyan bg-neon-cyan/5 font-mono tracking-widest uppercase self-start sm:self-auto"
              >
                View Public Profile
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="container-custom py-16 max-w-2xl">
        <div className="cyber-card p-8">
          {message && (
            <div
              role="alert"
              className="mb-6 rounded-lg border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-100"
            >
              {message}
            </div>
          )}

          {/* Profile banner */}
          <div className="mb-8">
            <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">
              Profile banner
            </label>
            <p className="text-xs text-text-muted mb-3 leading-relaxed">
              {BANNER_SIZE_TIPS}
            </p>

            <div
              ref={bannerFrameRef}
              className={`relative h-32 sm:h-40 w-full rounded-xl overflow-hidden border border-cyber-border bg-cyber-surface mb-2 select-none touch-none ${
                displayBanner
                  ? draggingBanner
                    ? 'cursor-grabbing ring-1 ring-neon-cyan/50'
                    : 'cursor-grab'
                  : ''
              }`}
              onPointerDown={displayBanner ? onBannerPointerDown : undefined}
              onPointerMove={displayBanner ? onBannerPointerMove : undefined}
              onPointerUp={displayBanner ? onBannerPointerUp : undefined}
              onPointerCancel={displayBanner ? onBannerPointerUp : undefined}
              role={displayBanner ? 'img' : undefined}
              aria-label={
                displayBanner
                  ? 'Banner preview. Drag to reframe which part of the image is shown.'
                  : undefined
              }
            >
              {displayBanner ? (
                <img
                  src={displayBanner}
                  alt="Banner preview"
                  className="w-full h-full object-cover pointer-events-none"
                  style={{
                    objectPosition: bannerObjectPosition(bannerPos),
                  }}
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[radial-gradient(circle_at_center,rgba(0,249,255,0.08)_0%,transparent_70%)]">
                  <span className="text-xs font-mono tracking-widest uppercase text-text-muted">
                    No banner yet
                  </span>
                </div>
              )}
              {displayBanner && (
                <>
                  <div className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-cyber-bg/85 px-2 py-1 text-[10px] font-mono tracking-wide text-text-secondary pointer-events-none">
                    <Move className="w-3 h-3 text-neon-cyan" aria-hidden />
                    Drag to reframe
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearBanner();
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-lg border border-cyber-border bg-cyber-bg/90 px-2 py-1 text-xs text-text-secondary hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                    Remove
                  </button>
                </>
              )}
            </div>

            {displayBanner && (
              <div className="mb-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-text-muted">
                    Vertical and horizontal framing (same as drag).
                  </p>
                  <button
                    type="button"
                    className="text-[11px] font-mono tracking-widest uppercase text-neon-cyan hover:text-white"
                    onClick={() =>
                      setBannerPos({ ...DEFAULT_BANNER_POSITION })
                    }
                  >
                    Reset center
                  </button>
                </div>
                <div>
                  <label
                    className="block text-[10px] font-mono tracking-widest uppercase text-text-muted mb-1"
                    htmlFor="banner-pos-y"
                  >
                    Vertical {Math.round(bannerPos.y)}%
                  </label>
                  <input
                    id="banner-pos-y"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={bannerPos.y}
                    onChange={(e) =>
                      setBannerPos((p) => ({
                        ...p,
                        y: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-neon-cyan"
                  />
                </div>
                <div>
                  <label
                    className="block text-[10px] font-mono tracking-widest uppercase text-text-muted mb-1"
                    htmlFor="banner-pos-x"
                  >
                    Horizontal {Math.round(bannerPos.x)}%
                  </label>
                  <input
                    id="banner-pos-x"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={bannerPos.x}
                    onChange={(e) =>
                      setBannerPos((p) => ({
                        ...p,
                        x: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-neon-cyan"
                  />
                </div>
              </div>
            )}

            {removeBanner && !bannerFile && (
              <p className="text-xs text-text-muted mb-2">
                Banner will be removed when you save.
              </p>
            )}

            <label
              htmlFor="profile-banner"
              className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-cyber-border bg-cyber-surface px-4 py-2.5 text-sm font-semibold text-text-secondary hover:border-neon-cyan hover:text-neon-cyan transition-colors"
            >
              <ImagePlus className="w-4 h-4" aria-hidden />
              {displayBanner ? 'Replace banner' : 'Choose banner image'}
              <input
                id="profile-banner"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={onBannerPick}
              />
            </label>
            {bannerFile && (
              <span className="ml-3 text-xs text-neon-cyan align-middle">
                {bannerFile.name}
              </span>
            )}
          </div>

          <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">
            Bio (Markdown supported)
          </label>
          <textarea
            className="w-full bg-cyber-surface border border-white/20 p-3 text-white outline-none mb-4 min-h-[120px]"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={1000}
          />

          <TagInput
            label="Interests"
            value={interests}
            onChange={setInterests}
          />
          <TagInput
            label="Favorite Games"
            value={favoriteGames}
            onChange={setFavoriteGames}
          />
          <TagInput
            label="Favorite Game Types"
            value={favoriteTypes}
            onChange={setFavoriteTypes}
          />

          <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">
            Discord
          </label>
          <input
            className="w-full bg-cyber-surface border border-white/20 p-3 text-white outline-none mb-4"
            value={discord}
            onChange={(e) => setDiscord(e.target.value)}
          />

          <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">
            YouTube
          </label>
          <input
            className="w-full bg-cyber-surface border border-white/20 p-3 text-white outline-none mb-4"
            value={youtube}
            onChange={(e) => setYoutube(e.target.value)}
          />

          <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">
            Twitch
          </label>
          <input
            className="w-full bg-cyber-surface border border-white/20 p-3 text-white outline-none mb-4"
            value={twitch}
            onChange={(e) => setTwitch(e.target.value)}
          />

          <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">
            X (Twitter)
          </label>
          <input
            className="w-full bg-cyber-surface border border-white/20 p-3 text-white outline-none mb-4"
            value={xHandle}
            onChange={(e) => setXHandle(e.target.value)}
          />

          <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">
            Signature
          </label>
          <input
            className="w-full bg-cyber-surface border border-white/20 p-3 text-white outline-none mb-6"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            maxLength={200}
          />

          <div className="flex gap-3">
            <button
              onClick={save}
              className="btn-primary btn-neon px-4 py-2"
              disabled={loading}
            >
              {loading ? 'SAVING...' : 'SAVE'}
            </button>
            <Link to="/profile" className="btn-neon px-4 py-2">
              CANCEL
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditProfile;
