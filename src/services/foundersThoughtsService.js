/**
 * Founders Thoughts + likes (Supabase).
 * Pattern mirrors ideasService votes: insert/delete row, recount, denormalized likes.
 * Requires: supabase_founders_thoughts.sql
 */

import { supabase } from '../lib/supabase';

/** Local fallback if table missing / offline (likes stay 0, toggle disabled). */
export const LOCAL_THOUGHTS = [
  {
    id: null,
    slug: 'why-i-created-together-forge',
    title: 'Why I Created Together Forge',
    lead: '',
    theme: 'Origin',
    published_at: '2026-07-15',
    content: [
      'I built Together Forge because I got sick and tired of modern game companies screwing over gamers. Titles like The Last of Us Part II, Concord, aggressive loot boxes, and countless other examples show the same pattern. These companies care more about investors and loud ideologies than about the players who actually buy and play their games.',
      'Game companies have failed us. The rise of successful indie developers is proof of that. Bottom lines, bureaucracy, and forced ideologies have slowed real progress in gaming to a crawl. Genuine new content and innovation now live almost entirely in the indie space.',
      'It is time for us, the players, to stand up. We need to make our own games. Real games that push boundaries. Games that people actually care about and that bring us closer together.',
      'Stop buying mediocre games just because you need something to play. Support Together Forge instead. Every purchase gives you quality content and helps build a better system of game development, one that puts gamers first.',
      'Together Forge will be so successful that it renders the old models obsolete. Any company focused on investors or ideologies will not be able to compete with the speed, innovation, and community power of Together Forge.',
    ].join('\n\n'),
    likes: 0,
    localOnly: true,
  },
  {
    id: null,
    slug: 'founder-compensation',
    title: 'Founder Compensation',
    lead: '',
    theme: 'Compensation',
    published_at: '2026-07-15',
    content: [
      'As founder, I want Together Forge to be extremely successful. I want it to completely outcompete companies that put profits or ideologies over people. Because of this, I refuse to drain profits the way many CEOs do.',
      'Right now I work a normal 40-50 hour job while spending another 40+ hours building Together Forge. I will not use donations to cover my living expenses. I will only draw a living wage from Together Forge once the company is generating enough revenue to pay all employees (including myself) a wage that can comfortably support a family of five. Anything beyond that is unnecessary. I have no interest in the bloated executive compensation seen at places like Bungie.',
      'I created a separate option for people who want to support my personal runway directly. Donations to my living expenses go into a trust. Once there is enough to cover one full year, I will quit my day job and focus 100% on Together Forge. As more donations come in they will extend that runway. When Together Forge itself can pay living wages, I will switch to company pay and move any remaining trust funds into Together Forge as a direct donation.',
    ].join('\n\n'),
    likes: 0,
    localOnly: true,
  },
  {
    id: null,
    slug: 'why-transparency-matters',
    title: 'Why Transparency Matters',
    lead: '',
    theme: 'Transparency',
    published_at: '2026-07-15',
    content: [
      'Transparency is built into every part of this project because the community must be able to see whether the company is staying true to its principles. If money starts flowing to individuals or ideologies instead of games and players, people deserve to know immediately. Any future gaming company that avoids this level of openness will be signaling corruption. They prioritize lining pockets over making good games. Together Forge will never hide behind marketing copy. If we ever lose our way, the transparency systems will make it obvious.',
    ].join('\n\n'),
    likes: 0,
    localOnly: true,
  },
  {
    id: null,
    slug: 'long-term-vision',
    title: 'Long Term Vision',
    lead: '',
    theme: 'Vision',
    published_at: '2026-07-15',
    content: [
      'I want Together Forge to become the gold standard of game development. We will create systems that help aligned indie developers get support, brainstorm directly with the community, and rapidly test new mechanics and ideas with low risk. Together Forge will also create systems that teach people how to become indie developers and how to work in any specific field of game development.',
      'Together Forge will release revolutionary games that change the industry. Our success will force other companies, through market pressure, to adopt real transparency and put players first. We will build unifying cooperative experiences and MMOs where people form real connections and work together in shared worlds.',
    ].join('\n\n'),
    likes: 0,
    localOnly: true,
  },
];

function normalizeThought(row) {
  if (!row) return null;
  return {
    id: row.id ?? null,
    slug: row.slug || String(row.id),
    title: row.title || 'Untitled',
    lead: row.lead || '',
    theme: row.theme || 'Reflection',
    published_at: row.published_at || null,
    content: row.content || '',
    likes: Math.max(0, Number(row.likes) || 0),
    localOnly: false,
  };
}

function paragraphsFromContent(content) {
  if (!content) return [];
  return String(content)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export const foundersThoughtsService = {
  paragraphsFromContent,

  /**
   * Load all thoughts newest first. Falls back to LOCAL_THOUGHTS if table missing.
   * @returns {Promise<{ thoughts: object[], fromDb: boolean, error: string|null }>}
   */
  async listThoughts() {
    const { data, error } = await supabase
      .from('founders_thoughts')
      .select('id, slug, title, lead, theme, published_at, content, likes')
      .order('published_at', { ascending: false });

    if (error) {
      console.warn('[founders_thoughts] list failed', error);
      return {
        thoughts: LOCAL_THOUGHTS.map((t) => ({ ...t })),
        fromDb: false,
        error: error.message || 'Could not load thoughts',
      };
    }

    if (!data || data.length === 0) {
      return {
        thoughts: LOCAL_THOUGHTS.map((t) => ({ ...t })),
        fromDb: false,
        error: null,
      };
    }

    return {
      thoughts: data.map(normalizeThought).filter(Boolean),
      fromDb: true,
      error: null,
    };
  },

  async getLikeCount(thoughtId) {
    const id = Number(thoughtId);
    if (!Number.isFinite(id)) return 0;

    const { count, error } = await supabase
      .from('founders_thought_likes')
      .select('id', { count: 'exact', head: true })
      .eq('thought_id', id);

    if (error) {
      console.warn('[founders_thoughts] getLikeCount failed', error);
      const { data } = await supabase
        .from('founders_thoughts')
        .select('likes')
        .eq('id', id)
        .maybeSingle();
      return Math.max(0, Number(data?.likes) || 0);
    }
    return Math.max(0, typeof count === 'number' ? count : 0);
  },

  async userHasLiked(thoughtId, userId) {
    if (!userId) return false;
    const id = Number(thoughtId);
    if (!Number.isFinite(id)) return false;

    const { data, error } = await supabase
      .from('founders_thought_likes')
      .select('id')
      .eq('thought_id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST116') return false;
      console.warn('[founders_thoughts] userHasLiked failed', error);
      return false;
    }
    return !!data;
  },

  /**
   * Thought ids (number) this user has liked.
   */
  async getUserLikedThoughtIds(userId) {
    if (!userId) return [];
    const { data, error } = await supabase
      .from('founders_thought_likes')
      .select('thought_id')
      .eq('user_id', userId);

    if (error) {
      console.warn('[founders_thoughts] getUserLikedThoughtIds failed', error);
      return [];
    }
    return (data || [])
      .map((r) => Number(r.thought_id))
      .filter((n) => Number.isFinite(n));
  },

  /**
   * Toggle like for signed-in user.
   * @returns {Promise<{ liked: boolean, likes: number }>}
   */
  async toggleLike(thoughtId, userId) {
    if (!userId) throw new Error('You must be signed in to like.');
    const id = Number(thoughtId);
    if (!Number.isFinite(id)) throw new Error(`Invalid thought id: ${thoughtId}`);

    const { data: existing, error: findError } = await supabase
      .from('founders_thought_likes')
      .select('id')
      .eq('thought_id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (findError && findError.code !== 'PGRST116') {
      console.error('[founders_thoughts] find like failed', findError);
      throw findError;
    }

    if (existing) {
      const { error: delError } = await supabase
        .from('founders_thought_likes')
        .delete()
        .eq('thought_id', id)
        .eq('user_id', userId);
      if (delError) {
        console.error('[founders_thoughts] delete like failed', delError);
        throw delError;
      }
    } else {
      const { error: insError } = await supabase
        .from('founders_thought_likes')
        .insert([{ thought_id: id, user_id: userId }]);
      if (insError) {
        if (
          insError.code === '23505' ||
          /duplicate|unique/i.test(insError.message || '')
        ) {
          // already liked
        } else {
          console.error('[founders_thoughts] insert like failed', insError);
          throw insError;
        }
      }
    }

    const [liked, likes] = await Promise.all([
      this.userHasLiked(id, userId),
      this.getLikeCount(id),
    ]);

    // Best-effort denormalized column (trigger should also update)
    try {
      await supabase.from('founders_thoughts').update({ likes }).eq('id', id);
    } catch (e) {
      console.warn('[founders_thoughts] likes column update skipped', e);
    }

    return { liked: !!liked, likes: Math.max(0, likes || 0) };
  },
};

export default foundersThoughtsService;
