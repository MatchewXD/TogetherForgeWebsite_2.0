import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ImagePlus, X, Move } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { publicProfilePath } from '../../utils/profileLinks';
import {
  ensureUserProfile,
  validatePublicUsername,
  USERNAME_CHANGE_COOLDOWN_DAYS,
  getUsernameChangeCooldown,
  fetchLastUsernameChangeAt,
  recordUsernameChange,
} from '../../utils/ensureUserProfile';
import {
  parseBannerPosition,
  formatBannerPosition,
  bannerObjectPosition,
  DEFAULT_BANNER_POSITION,
} from '../../utils/bannerPosition';
import Modal from '../ui/Modal';
import Button from '../ui/Buttons';
import UserAvatar from '../ui/UserAvatar';
import { emitProfileUpdated } from '../../utils/profileEvents';

function snapshotFields({
  username,
  bio,
  interests,
  favoriteGames,
  favoriteTypes,
  discord,
  github,
  youtube,
  twitch,
  xHandle,
  showDonationTotal,
  avatarUrl,
  bannerUrl,
  bannerPos,
}) {
  return JSON.stringify({
    username: String(username || ''),
    bio: String(bio || ''),
    interests: String(interests || ''),
    favoriteGames: String(favoriteGames || ''),
    favoriteTypes: String(favoriteTypes || ''),
    discord: String(discord || ''),
    github: String(github || ''),
    youtube: String(youtube || ''),
    twitch: String(twitch || ''),
    xHandle: String(xHandle || ''),
    showDonationTotal: Boolean(showDonationTotal),
    avatarUrl: avatarUrl || null,
    bannerUrl: bannerUrl || null,
    bannerPos: {
      x: Number(bannerPos?.x) || 50,
      y: Number(bannerPos?.y) || 50,
    },
  });
}

const BANNER_MAX_BYTES = 5 * 1024 * 1024; // 5MB
const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2MB
const BANNER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const BANNER_BUCKET = 'avatars';

/** Ideal display area is wide and short (~3:1). */
const BANNER_SIZE_TIPS =
  'Recommended size: 1500 x 500 px (3:1 landscape). Larger images are fine; drag the preview to choose which part shows. JPEG, PNG, or WebP · max 5MB.';

const AVATAR_SIZE_TIPS =
  'Square works best (e.g. 400×400). JPEG, PNG, or WebP · max 2MB. Shown next to your name across the site.';

/** Tag chips (comma-separated string) — must live outside parent to keep hooks stable */
function TagInput({ label, value, onChange }) {
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
    onChange([...tags, t].join(', '));
    setDraft('');
  };
  const removeTag = (tag) => {
    onChange(tags.filter((x) => x !== tag).join(', '));
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
            key={`${tag}-${idx}`}
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
}

/**
 * Account → Profile section form (fields shown on the profile page).
 * @param {{ user: object, onUserChange?: (u: object) => void, onSaved?: () => void }} props
 */
export default function ProfileSettingsForm({
  user: userProp,
  onUserChange,
  onSaved,
}) {
  const [user, setUser] = useState(userProp || null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  /** When false, username field is locked; user must click Change username */
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameChangeModalOpen, setUsernameChangeModalOpen] = useState(false);
  /** ISO timestamp of last username change (for 30-day cooldown) */
  const [lastUsernameChangeAt, setLastUsernameChangeAt] = useState(null);
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState('');
  const [favoriteGames, setFavoriteGames] = useState('');
  const [favoriteTypes, setFavoriteTypes] = useState('');
  const [discord, setDiscord] = useState('');
  const [github, setGithub] = useState('');
  const [youtube, setYoutube] = useState('');
  const [twitch, setTwitch] = useState('');
  const [xHandle, setXHandle] = useState('');
  const [showDonationTotal, setShowDonationTotal] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [bannerUrl, setBannerUrl] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);
  const [removeBanner, setRemoveBanner] = useState(false);
  const [bannerPos, setBannerPos] = useState(DEFAULT_BANNER_POSITION);
  const [draggingBanner, setDraggingBanner] = useState(false);
  const [baseline, setBaseline] = useState(null);
  const bannerFrameRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    setUser(userProp || null);
  }, [userProp]);

  useEffect(() => {
    const init = async () => {
      const uid = userProp?.id;
      if (!uid) return;

      // Legacy accounts (SSO / pre-username) may have no profiles row yet
      let data = await ensureUserProfile(uid, {
        email: userProp?.email || null,
      });
      if (!data) {
        const { data: row } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', uid)
          .maybeSingle();
        data = row;
      }
      if (data) {
        const nextUsername = data.username || '';
        const nextBio = data.bio || data.about || '';
        const nextInterests = data.interests || '';
        const nextGames = data.favorite_games || '';
        const nextTypes = data.favorite_game_types || '';
        const nextDiscord = data.discord || '';
        const nextGithub = data.github || '';
        const nextYoutube = data.youtube || '';
        const nextTwitch = data.twitch || '';
        const nextX = data.x_handle || '';
        const nextShowTotal = Boolean(data.show_donation_total);
        const nextAvatar = data.avatar_url || null;
        const nextBanner = data.banner_url || null;
        const nextPos = parseBannerPosition(data.banner_position);

        setProfile(data);
        setUsername(nextUsername);
        setUsernameError('');
        // Require an explicit “Change username” click when one is already set
        setEditingUsername(!nextUsername);
        setUsernameChangeModalOpen(false);
        // Cooldown from username_history
        const lastChange = await fetchLastUsernameChangeAt(uid);
        setLastUsernameChangeAt(lastChange);
        setBio(nextBio);
        setInterests(nextInterests);
        setFavoriteGames(nextGames);
        setFavoriteTypes(nextTypes);
        setDiscord(nextDiscord);
        setGithub(nextGithub);
        setYoutube(nextYoutube);
        setTwitch(nextTwitch);
        setXHandle(nextX);
        setShowDonationTotal(nextShowTotal);
        setAvatarUrl(nextAvatar);
        setAvatarFile(null);
        setRemoveAvatar(false);
        setAvatarPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        setBannerUrl(nextBanner);
        setBannerPos(nextPos);
        setBannerFile(null);
        setRemoveBanner(false);
        setBannerPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        setBaseline(
          snapshotFields({
            username: nextUsername,
            bio: nextBio,
            interests: nextInterests,
            favoriteGames: nextGames,
            favoriteTypes: nextTypes,
            discord: nextDiscord,
            github: nextGithub,
            youtube: nextYoutube,
            twitch: nextTwitch,
            xHandle: nextX,
            showDonationTotal: nextShowTotal,
            avatarUrl: nextAvatar,
            bannerUrl: nextBanner,
            bannerPos: nextPos,
          })
        );
        if (!nextUsername) {
          setMessage(
            'Choose a username below and save. Without one, your profile page (/u/…) cannot be opened.'
          );
        }
      }
    };
    init();
  }, [userProp?.id, userProp?.email]);

  const isDirty = useMemo(() => {
    if (bannerFile || removeBanner || avatarFile || removeAvatar) return true;
    if (baseline == null) return false;
    return (
      snapshotFields({
        username,
        bio,
        interests,
        favoriteGames,
        favoriteTypes,
        discord,
        github,
        youtube,
        twitch,
        xHandle,
        showDonationTotal,
        avatarUrl,
        bannerUrl,
        bannerPos,
      }) !== baseline
    );
  }, [
    baseline,
    username,
    bio,
    interests,
    favoriteGames,
    favoriteTypes,
    discord,
    github,
    youtube,
    twitch,
    xHandle,
    showDonationTotal,
    avatarUrl,
    bannerUrl,
    bannerPos,
    bannerFile,
    removeBanner,
    avatarFile,
    removeAvatar,
  ]);

  useEffect(() => {
    return () => {
      if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    };
  }, [bannerPreview]);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  const displayAvatar = avatarPreview || (!removeAvatar && avatarUrl ? avatarUrl : null);

  const onAvatarPick = useCallback((e) => {
    const file = e.target.files?.[0] || null;
    e.target.value = '';
    if (!file) return;
    if (!BANNER_TYPES.includes(file.type)) {
      setMessage('Profile picture must be JPEG, PNG, or WebP.');
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setMessage('Profile picture must be under 2MB.');
      return;
    }
    setMessage('');
    setRemoveAvatar(false);
    setAvatarFile(file);
    setAvatarPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }, []);

  const clearAvatar = useCallback(() => {
    setAvatarFile(null);
    setAvatarPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (avatarUrl) setRemoveAvatar(true);
  }, [avatarUrl]);

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

  const uploadProfileImage = async (file, userId, kind) => {
    const ext =
      (file.name && file.name.split('.').pop()?.toLowerCase()) ||
      (file.type === 'image/png' ? 'png' : 'jpg');
    const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
    // banner.{ext} or avatar.{ext} under the user's folder
    const path = `${userId}/${kind}.${safeExt}`;

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

  const uploadBannerFile = async (file, userId) =>
    uploadProfileImage(file, userId, 'banner');

  const uploadAvatarFile = async (file, userId) =>
    uploadProfileImage(file, userId, 'avatar');

  const save = async () => {
    if (!user) return;
    setLoading(true);
    setMessage('');
    setUsernameError('');

    const previousUsername = String(profile?.username || '').trim();
    const unameCheck = validatePublicUsername(username);
    if (!unameCheck.ok) {
      setUsernameError(unameCheck.message || 'Invalid username');
      setLoading(false);
      return;
    }
    const nextUsername = unameCheck.value;
    const usernameActuallyChanging =
      previousUsername &&
      previousUsername.toLowerCase() !== nextUsername.toLowerCase();

    // Enforce 30-day cooldown when renaming an existing username
    if (usernameActuallyChanging) {
      const cd = getUsernameChangeCooldown(lastUsernameChangeAt);
      if (cd.locked) {
        setUsernameError(
          `You can change your username again in ${cd.daysLeft} day${
            cd.daysLeft === 1 ? '' : 's'
          }.`
        );
        setEditingUsername(false);
        setUsername(previousUsername);
        setLoading(false);
        return;
      }
    }

    // Uniqueness (case-insensitive), allow keeping own name
    const { data: taken } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', nextUsername)
      .maybeSingle();
    if (taken && String(taken.id) !== String(user.id)) {
      setUsernameError('Username already taken');
      setLoading(false);
      return;
    }

    let nextAvatarUrl = avatarUrl;
    let nextBannerUrl = bannerUrl;
    try {
      if (avatarFile) {
        nextAvatarUrl = await uploadAvatarFile(avatarFile, user.id);
      } else if (removeAvatar) {
        nextAvatarUrl = null;
      }
      if (bannerFile) {
        nextBannerUrl = await uploadBannerFile(bannerFile, user.id);
      } else if (removeBanner) {
        nextBannerUrl = null;
      }
    } catch (imgErr) {
      setMessage(imgErr?.message || 'Image upload failed.');
      setLoading(false);
      return;
    }

    // Prefer core fields first so username always persists on legacy DBs
    const corePatch = {
      id: user.id,
      username: nextUsername,
      bio: bio || null,
      interests: interests || null,
      favorite_games: favoriteGames || null,
      favorite_game_types: favoriteTypes || null,
      discord: discord || null,
      youtube: youtube || null,
      twitch: twitch || null,
      x_handle: xHandle || null,
    };

    let { data: savedRow, error } = await supabase
      .from('profiles')
      .upsert(corePatch, { onConflict: 'id' })
      .select('id, username')
      .maybeSingle();

    // Strip optional missing columns and retry core if needed
    if (error) {
      let body = { ...corePatch };
      const optional = [
        'favorite_game_types',
        'favorite_games',
        'interests',
        'discord',
        'youtube',
        'twitch',
        'x_handle',
      ];
      for (const col of optional) {
        if (
          error &&
          body[col] !== undefined &&
          (error.message || '').toLowerCase().includes(col) &&
          /column|schema cache|could not find/i.test(error.message || '')
        ) {
          delete body[col];
          ({ data: savedRow, error } = await supabase
            .from('profiles')
            .upsert(body, { onConflict: 'id' })
            .select('id, username')
            .maybeSingle());
        }
      }
    }

    if (error) {
      console.error('Save failed:', error.message);
      const msg = error.message || 'Save failed.';
      if (/unique|duplicate|username/i.test(msg)) {
        setUsernameError('Username already taken');
      }
      setMessage(msg);
      setLoading(false);
      return;
    }

    // Extended fields (avatar, banner, github, privacy) best-effort after username is safe
    {
      const extended = {
        email: user.email || null,
        github: github || null,
        show_donation_total: showDonationTotal,
        avatar_url: nextAvatarUrl,
        banner_url: nextBannerUrl,
        banner_position: nextBannerUrl
          ? formatBannerPosition(bannerPos)
          : null,
      };
      let extBody = { ...extended };
      let { error: extErr } = await supabase
        .from('profiles')
        .update(extBody)
        .eq('id', user.id);
      if (extErr) {
        const optional = [
          'banner_position',
          'banner_url',
          'avatar_url',
          'github',
          'show_donation_total',
          'email',
        ];
        for (const col of optional) {
          if (
            extErr &&
            extBody[col] !== undefined &&
            (extErr.message || '').toLowerCase().includes(col) &&
            /column|schema cache|could not find/i.test(extErr.message || '')
          ) {
            delete extBody[col];
            ({ error: extErr } = await supabase
              .from('profiles')
              .update(extBody)
              .eq('id', user.id));
          }
        }
        if (extErr) {
          console.warn('[ProfileSettingsForm] extended save', extErr.message);
        }
      }
    }

    // Verify username is readable publicly (same path as /u/:username)
    const { data: verify } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('id', user.id)
      .maybeSingle();
    const storedName = (verify?.username || savedRow?.username || nextUsername || '').trim();
    if (!storedName) {
      setMessage(
        'Save may have failed: username is still empty in the database. Check that you are signed in and profiles RLS allows insert/update on your row.'
      );
      setLoading(false);
      return;
    }
    if (storedName.toLowerCase() !== nextUsername.toLowerCase()) {
      setMessage(
        `Saved, but database username is “${storedName}” (not “${nextUsername}”). Try again or contact staff.`
      );
      setUsername(storedName);
      setLoading(false);
      onSaved?.();
      return;
    }

    // Record rename for 30-day cooldown (not first-time set)
    if (
      previousUsername &&
      previousUsername.toLowerCase() !== storedName.toLowerCase()
    ) {
      await recordUsernameChange(user.id, previousUsername);
      const nowIso = new Date().toISOString();
      setLastUsernameChangeAt(nowIso);
    }

    setAvatarUrl(nextAvatarUrl);
    setBannerUrl(nextBannerUrl);
    setUsername(storedName);
    setProfile((prev) => ({
      ...(prev || {}),
      ...(savedRow || {}),
      ...(verify || {}),
      username: storedName,
      avatar_url: nextAvatarUrl,
      banner_url: nextBannerUrl,
    }));
    setAvatarFile(null);
    setRemoveAvatar(false);
    setAvatarPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setBannerFile(null);
    setRemoveBanner(false);
    setBannerPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setBaseline(
      snapshotFields({
        username: storedName,
        bio: bio || '',
        interests: interests || '',
        favoriteGames: favoriteGames || '',
        favoriteTypes: favoriteTypes || '',
        discord: discord || '',
        github: github || '',
        youtube: youtube || '',
        twitch: twitch || '',
        xHandle: xHandle || '',
        showDonationTotal,
        avatarUrl: nextAvatarUrl,
        bannerUrl: nextBannerUrl,
        bannerPos,
      })
    );
    setMessage(
      previousUsername &&
        previousUsername.toLowerCase() !== storedName.toLowerCase()
        ? `Username updated to ${storedName}. You can change it again in ${USERNAME_CHANGE_COOLDOWN_DAYS} days.`
        : `Profile saved. Open your public page: /u/${encodeURIComponent(storedName)}`
    );
    setEditingUsername(false);
    setUsernameChangeModalOpen(false);
    setLoading(false);
    // Navbar avatar / username — does not rely on Realtime
    emitProfileUpdated({
      userId: user.id,
      avatarUrl: nextAvatarUrl,
      username: storedName,
    });
    onSaved?.();
  };

  const usernameCooldown = useMemo(
    () => getUsernameChangeCooldown(lastUsernameChangeAt),
    [lastUsernameChangeAt]
  );

  const openChangeUsernameFlow = () => {
    setUsernameError('');
    // First-time set: no modal / cooldown
    if (!profile?.username) {
      setEditingUsername(true);
      return;
    }
    if (usernameCooldown.locked) return;
    setUsernameChangeModalOpen(true);
  };

  const confirmChangeUsername = () => {
    setUsernameChangeModalOpen(false);
    setEditingUsername(true);
    setUsernameError('');
  };

  const displayBanner =
    bannerPreview || (!removeBanner && bannerUrl ? bannerUrl : null);

  if (!user) {
    return (
      <p className="text-sm text-text-muted">Sign in to edit your profile.</p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Edit Profile</h2>
        </div>
        {publicProfilePath(profile?.username) && (
          <Link
            to={publicProfilePath(profile.username)}
            className="text-xs px-4 py-2 rounded-full border border-neon-cyan/40 hover:border-neon-cyan text-neon-cyan bg-neon-cyan/5 font-mono tracking-widest uppercase"
          >
            View profile
          </Link>
        )}
      </div>

      <div className="cyber-card p-6 sm:p-8 border border-cyber-border">
          {message && (
            <div
              role="alert"
              className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
                /username|cannot be opened|failed|error|must/i.test(message) &&
                !/saved/i.test(message)
                  ? 'border-semantic-warning/40 bg-semantic-warning/10 text-semantic-warning'
                  : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
              }`}
            >
              {message}
            </div>
          )}

          {/* Username — locked by default; change via explicit button */}
          <div className="mb-6">
            <label
              className="block text-sm font-mono tracking-widest text-neon-cyan mb-2"
              htmlFor={editingUsername ? 'profile-username' : undefined}
            >
              Username *
            </label>

            {!editingUsername ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-white font-medium text-base">
                    {username || (
                      <span className="text-text-muted">Not set</span>
                    )}
                  </p>
                  {username ? (
                    <span className="text-xs font-mono text-neon-cyan">
                      /u/{username}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={Boolean(profile?.username) && usernameCooldown.locked}
                  className={`inline-flex items-center rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                    profile?.username && usernameCooldown.locked
                      ? 'border-cyber-border bg-cyber-surface/60 text-text-muted cursor-not-allowed opacity-60'
                      : 'border-semantic-warning/40 bg-semantic-warning/10 text-semantic-warning hover:bg-semantic-warning/20 hover:border-semantic-warning/60'
                  }`}
                  onClick={openChangeUsernameFlow}
                  title={
                    profile?.username && usernameCooldown.locked
                      ? `You can change your username again in ${usernameCooldown.daysLeft} day${
                          usernameCooldown.daysLeft === 1 ? '' : 's'
                        }`
                      : 'Changing your username can have unintended side effects'
                  }
                >
                  {profile?.username && usernameCooldown.locked
                    ? `Change available in ${usernameCooldown.daysLeft} day${
                        usernameCooldown.daysLeft === 1 ? '' : 's'
                      }`
                    : profile?.username
                      ? 'Change username'
                      : 'Set username'}
                </button>
                {profile?.username && usernameCooldown.locked ? (
                  <p className="text-xs text-text-muted leading-relaxed max-w-md">
                    Username changes are limited to once every{' '}
                    {USERNAME_CHANGE_COOLDOWN_DAYS} days. Next change:{' '}
                    <span className="text-text-secondary">
                      {usernameCooldown.nextChangeAt
                        ? usernameCooldown.nextChangeAt.toLocaleDateString(
                            undefined,
                            {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            }
                          )
                        : `in ${usernameCooldown.daysLeft} day${
                            usernameCooldown.daysLeft === 1 ? '' : 's'
                          }`}
                    </span>
                    .
                  </p>
                ) : (
                  <p className="text-xs text-text-muted leading-relaxed max-w-md">
                    Changing your username can have unintended side effects. You
                    may only change it once every{' '}
                    {USERNAME_CHANGE_COOLDOWN_DAYS} days. Credits stay on your
                    account; public links like{' '}
                    <span className="font-mono text-text-secondary">/u/…</span>{' '}
                    will update.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  id="profile-username"
                  type="text"
                  autoComplete="username"
                  maxLength={24}
                  className="w-full bg-cyber-surface border border-white/20 p-3 text-white outline-none rounded focus:border-neon-cyan"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setUsernameError('');
                  }}
                  placeholder="your_handle"
                  autoFocus
                />
                {usernameError ? (
                  <p className="text-xs text-red-400">{usernameError}</p>
                ) : (
                  <p className="text-xs text-semantic-warning/90 leading-relaxed">
                    Changing your username can have unintended side effects. You
                    can only change it once every{' '}
                    {USERNAME_CHANGE_COOLDOWN_DAYS} days. Public URL will be{' '}
                    <span className="font-mono text-neon-cyan">
                      /u/{username.trim() || 'your_handle'}
                    </span>
                    .
                  </p>
                )}
                {profile?.username ? (
                  <button
                    type="button"
                    className="text-xs text-text-muted hover:text-white"
                    onClick={() => {
                      setUsername(profile.username || '');
                      setUsernameError('');
                      setEditingUsername(false);
                    }}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            )}
          </div>

          <Modal
            isOpen={usernameChangeModalOpen}
            onClose={() => setUsernameChangeModalOpen(false)}
            title="Change username?"
            size="sm"
          >
            <div className="space-y-4">
              <p className="text-sm text-text-secondary leading-relaxed">
                You can only change your username{' '}
                <span className="text-white font-medium">
                  once every {USERNAME_CHANGE_COOLDOWN_DAYS} days
                </span>
                . Changing it can have unintended side effects: public links
                like{' '}
                <span className="font-mono text-neon-cyan">
                  /u/{profile?.username || 'you'}
                </span>{' '}
                will move to the new name. Credits and history stay on your
                account.
              </p>
              <div className="flex flex-wrap gap-2 justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setUsernameChangeModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={confirmChangeUsername}
                >
                  I understand, continue
                </Button>
              </div>
            </div>
          </Modal>

          {/* Profile picture */}
          <div className="mb-8">
            <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">
              Profile picture
            </label>
            <p className="text-xs text-text-muted mb-3 leading-relaxed">
              {AVATAR_SIZE_TIPS}
            </p>
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              <div className="relative shrink-0">
                <UserAvatar
                  src={displayAvatar}
                  name={username || user?.email || 'You'}
                  username={username}
                  linkProfile={false}
                  size="xl"
                  className="!w-24 !h-24 sm:!w-28 sm:!h-28 ring-2 ring-neon-cyan/30"
                />
                {displayAvatar && (
                  <button
                    type="button"
                    onClick={clearAvatar}
                    className="absolute -top-1 -right-1 inline-flex h-7 w-7 items-center justify-center rounded-full border border-cyber-border bg-cyber-bg text-text-secondary hover:text-white shadow"
                    aria-label="Remove profile picture"
                    title="Remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <label
                  htmlFor="profile-avatar"
                  className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-cyber-border bg-cyber-surface px-4 py-2.5 text-sm font-semibold text-text-secondary hover:border-neon-cyan hover:text-neon-cyan transition-colors"
                >
                  <ImagePlus className="w-4 h-4" aria-hidden />
                  {displayAvatar ? 'Replace photo' : 'Choose photo'}
                  <input
                    id="profile-avatar"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={onAvatarPick}
                  />
                </label>
                {avatarFile && (
                  <p className="text-xs text-neon-cyan truncate max-w-xs">
                    {avatarFile.name}
                  </p>
                )}
                {removeAvatar && !avatarFile && (
                  <p className="text-xs text-text-muted">
                    Photo will be removed when you save.
                  </p>
                )}
              </div>
            </div>
          </div>

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

          <div className="mb-6 rounded-xl border border-cyber-border bg-cyber-surface/40 p-4 space-y-4">
            <p className="text-xs font-mono tracking-widest text-neon-purple uppercase">
              Public social links
            </p>

            <div>
              <label className="block text-sm font-mono tracking-widest text-[#5865F2] mb-2">
                Discord username
              </label>
              <input
                className="w-full bg-cyber-surface border border-white/20 p-3 text-white outline-none rounded"
                value={discord}
                onChange={(e) => setDiscord(e.target.value)}
                placeholder="YourDiscordName"
              />
            </div>

            <div>
              <label className="block text-sm font-mono tracking-widest text-white mb-2">
                GitHub
              </label>
              <input
                className="w-full bg-cyber-surface border border-white/20 p-3 text-white outline-none rounded"
                value={github}
                onChange={(e) => setGithub(e.target.value)}
                placeholder="username or https://github.com/…"
              />
            </div>

            <div>
              <label className="block text-sm font-mono tracking-widest text-[#FF0000] mb-2">
                YouTube
              </label>
              <input
                className="w-full bg-cyber-surface border border-white/20 p-3 text-white outline-none rounded"
                value={youtube}
                onChange={(e) => setYoutube(e.target.value)}
                placeholder="@channel or full URL"
              />
            </div>

            <div>
              <label className="block text-sm font-mono tracking-widest text-[#9146FF] mb-2">
                Twitch
              </label>
              <input
                className="w-full bg-cyber-surface border border-white/20 p-3 text-white outline-none rounded"
                value={twitch}
                onChange={(e) => setTwitch(e.target.value)}
                placeholder="channel name"
              />
            </div>

            <div>
              <label className="block text-sm font-mono tracking-widest text-white mb-2">
                X (Twitter)
              </label>
              <input
                className="w-full bg-cyber-surface border border-white/20 p-3 text-white outline-none rounded"
                value={xHandle}
                onChange={(e) => setXHandle(e.target.value)}
                placeholder="@handle"
              />
            </div>
          </div>

          <div className="mb-6 rounded-xl border border-semantic-achievement/30 bg-semantic-achievement/5 p-4">
            <p className="text-xs font-mono tracking-widest text-semantic-achievement uppercase mb-2">
              Support visibility
            </p>
            <label className="flex items-start gap-3 cursor-pointer text-sm text-text-secondary">
              <input
                type="checkbox"
                className="mt-1 accent-semantic-achievement"
                checked={showDonationTotal}
                onChange={(e) => setShowDonationTotal(e.target.checked)}
              />
              <span>
                <span className="text-white font-medium">
                  Show my total donations on my profile
                </span>
                <span className="block text-xs text-text-muted mt-1 leading-relaxed">
                  When off, supporters still get recognition and the project
                  list, with no dollar amount. Anonymous donations won&apos;t
                  count towards the total donations.
                </span>
              </span>
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={save}
              className="btn-primary btn-neon px-4 py-2 disabled:opacity-40 disabled:pointer-events-none disabled:shadow-none"
              disabled={loading || !isDirty}
              title={
                !isDirty && !loading
                  ? 'No changes to save'
                  : undefined
              }
            >
              {loading ? 'SAVING…' : 'Save profile'}
            </button>
          </div>
        </div>
    </div>
  );
}
