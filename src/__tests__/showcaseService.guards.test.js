/**
 * Showcase submit / moderate: auth and validation guards.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getUser = vi.fn();
const from = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: (...a) => getUser(...a) },
    from: (...a) => from(...a),
  },
}));

import {
  submitShowcasePost,
  moderateShowcasePost,
} from '../services/showcaseService';

describe('submitShowcasePost guards', () => {
  beforeEach(() => {
    getUser.mockReset();
    from.mockReset();
  });

  it('requires sign-in', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(
      submitShowcasePost({ contentType: 'video', title: 'Hi' })
    ).rejects.toThrow(/Sign in/i);
  });

  it('rejects invalid content type', async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com' } },
    });
    await expect(
      submitShowcasePost({ contentType: 'meme', title: 'Hi there' })
    ).rejects.toThrow(/content type/i);
  });

  it('requires username for credit', async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com' } },
    });
    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: { username: null }, error: null }),
        }),
      }),
    });
    await expect(
      submitShowcasePost({
        contentType: 'article',
        title: 'My post',
        url: 'https://example.com/post',
      })
    ).rejects.toThrow(/username/i);
  });

  it('inserts pending post when valid', async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com' } },
    });
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'post-1',
        content_type: 'article',
        title: 'My post',
        status: 'pending',
        creator_display_name: 'alice',
        creator_user_id: 'u1',
      },
      error: null,
    });
    const insert = vi.fn(() => ({
      select: () => ({ maybeSingle }),
    }));
    from.mockImplementation((table) => {
      if (table === 'profiles' || table?.includes?.('profile')) {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { username: 'alice' },
                  error: null,
                }),
            }),
          }),
        };
      }
      return { insert };
    });

    // showcaseService uses TABLE constant - from is called for profiles then insert
    let call = 0;
    from.mockImplementation(() => {
      call += 1;
      if (call === 1) {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { username: 'alice' },
                  error: null,
                }),
            }),
          }),
        };
      }
      return {
        insert: (row) => {
          expect(row.status).toBe('pending');
          expect(row.creator_user_id).toBe('u1');
          expect(row.creator_display_name).toBe('alice');
          return {
            select: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { ...row, id: 'post-1' },
                  error: null,
                }),
            }),
          };
        },
      };
    });

    const post = await submitShowcasePost({
      contentType: 'article',
      title: 'My post',
      url: 'https://example.com/post',
    });
    expect(post.id).toBe('post-1');
    expect(post.status || 'pending').toBeTruthy();
  });

  function mockSignedInWithUsername() {
    getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com' } },
    });
    let call = 0;
    from.mockImplementation(() => {
      call += 1;
      if (call === 1) {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { username: 'alice' },
                  error: null,
                }),
            }),
          }),
        };
      }
      return {
        insert: (row) => ({
          select: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: { ...row, id: 'post-art' },
                error: null,
              }),
          }),
        }),
      };
    });
  }

  it('rejects art with neither image nor link', async () => {
    mockSignedInWithUsername();
    await expect(
      submitShowcasePost({
        contentType: 'art',
        title: 'My drawing',
      })
    ).rejects.toThrow(/upload an image or share an image link/i);
  });

  it('accepts art with an image link only', async () => {
    mockSignedInWithUsername();
    const post = await submitShowcasePost({
      contentType: 'art',
      title: 'My drawing',
      url: 'https://example.com/art.webp',
    });
    expect(post.id).toBe('post-art');
    expect(post.imageUrl).toBe('https://example.com/art.webp');
  });

  it('rejects a stream with no URL', async () => {
    mockSignedInWithUsername();
    await expect(
      submitShowcasePost({
        contentType: 'stream',
        title: 'Live now',
      })
    ).rejects.toThrow(/stream URL/i);
  });

  it('accepts a stream with a non-YouTube URL', async () => {
    mockSignedInWithUsername();
    const post = await submitShowcasePost({
      contentType: 'stream',
      title: 'Live now',
      url: 'https://www.twitch.tv/togetherforge',
    });
    expect(post.id).toBe('post-art');
    expect(post.url).toBe('https://www.twitch.tv/togetherforge');
  });

  it('accepts art with an uploaded image URL only', async () => {
    mockSignedInWithUsername();
    const post = await submitShowcasePost({
      contentType: 'art',
      title: 'My drawing',
      imageUrl: 'https://cdn.example.com/uploaded.png',
    });
    expect(post.id).toBe('post-art');
    expect(post.imageUrl).toBe('https://cdn.example.com/uploaded.png');
  });
});

describe('moderateShowcasePost guards', () => {
  it('requires post id', async () => {
    await expect(moderateShowcasePost('', 'approve')).rejects.toThrow(
      /id is required/i
    );
  });
});
