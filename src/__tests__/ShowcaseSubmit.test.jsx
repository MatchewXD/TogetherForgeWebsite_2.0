/**
 * Submit content page: intro copy, art upload / image link, disabled submit.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: 'u1', email: 'a@b.com' } },
      })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { username: 'alice' },
            error: null,
          }),
        }),
      }),
    })),
  },
}));

vi.mock('../utils/relatedToOptions', () => ({
  loadRelatedProjectOptions: vi.fn(async () => [
    { id: 'tether', label: 'Tether' },
  ]),
}));

vi.mock('../utils/userNotices', () => ({
  pingUserNotices: vi.fn(),
}));

const submitShowcasePost = vi.fn();
const uploadShowcaseImage = vi.fn();

vi.mock('../services/showcaseService', async () => {
  const actual = await vi.importActual('../services/showcaseService');
  return {
    ...actual,
    submitShowcasePost: (...args) => submitShowcasePost(...args),
    uploadShowcaseImage: (...args) => uploadShowcaseImage(...args),
  };
});

import ShowcaseSubmit from '../pages/ShowcaseSubmit';

function renderPage() {
  return render(
    <MemoryRouter>
      <ShowcaseSubmit />
    </MemoryRouter>
  );
}

async function waitForForm() {
  await screen.findByLabelText(/content type/i);
}

describe('ShowcaseSubmit', () => {
  beforeEach(() => {
    submitShowcasePost.mockReset();
    uploadShowcaseImage.mockReset();
    submitShowcasePost.mockResolvedValue({ id: 'post-1', status: 'pending' });
    uploadShowcaseImage.mockResolvedValue(
      'https://cdn.example.com/showcase/art.png'
    );
    if (!URL.createObjectURL) {
      URL.createObjectURL = vi.fn(() => 'blob:preview');
    } else {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = vi.fn();
    }
  });

  it('uses the Community Showcase intro and omits queue copy from the header', async () => {
    renderPage();
    await waitForForm();
    expect(
      screen.getByText(
        /Community made videos, streams, clips, art and posts related to Together Forge/i
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/private queue/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/moderators approve before anything is public/i)
    ).not.toBeInTheDocument();
  });

  it('asks streams for a URL instead of a YouTube link', async () => {
    renderPage();
    await waitForForm();
    fireEvent.change(screen.getByLabelText(/content type/i), {
      target: { value: 'stream' },
    });
    expect(screen.getByLabelText(/^url/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/youtube url/i)).not.toBeInTheDocument();
  });

  it('shows image upload and Image link for art, and disables submit until one is used', async () => {
    renderPage();
    await waitForForm();

    fireEvent.change(screen.getByLabelText(/content type/i), {
      target: { value: 'art' },
    });

    expect(screen.getByText('Image link')).toBeInTheDocument();
    expect(
      screen.queryByText(/image or portfolio link/i)
    ).not.toBeInTheDocument();
    expect(screen.getByText(/choose image/i)).toBeInTheDocument();

    const disabledSubmit = screen.getByRole('button', {
      name: /submit for review/i,
    });
    expect(disabledSubmit).toBeDisabled();
    expect(
      screen.getByLabelText(/please upload an image or share a link/i)
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^image link$/i), {
      target: { value: 'https://example.com/art.webp' },
    });

    const enabledSubmit = screen.getByRole('button', {
      name: /submit for review/i,
    });
    expect(enabledSubmit).not.toBeDisabled();
  });

  it('enables submit after choosing an image file', async () => {
    renderPage();
    await waitForForm();
    fireEvent.change(screen.getByLabelText(/content type/i), {
      target: { value: 'art' },
    });

    const file = new File(['fake-image'], 'drawing.png', {
      type: 'image/png',
    });
    const input = document.getElementById('sc-art-file');
    expect(input).toBeTruthy();
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /submit for review/i })
      ).not.toBeDisabled();
    });
  });

  it('omits the pending-review status card after a successful submit', async () => {
    renderPage();
    await waitForForm();
    fireEvent.change(screen.getByLabelText(/content type/i), {
      target: { value: 'art' },
    });
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Forge sketch' },
    });
    fireEvent.change(screen.getByLabelText(/^image link$/i), {
      target: { value: 'https://example.com/art.webp' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /submit for review/i })
    );

    expect(
      await screen.findByText(/thanks for your submission/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/pending review/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/track pending \/ approved \/ rejected/i)
    ).not.toBeInTheDocument();
  });
});
