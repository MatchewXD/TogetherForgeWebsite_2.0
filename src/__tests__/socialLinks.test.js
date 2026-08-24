import { describe, it, expect } from 'vitest';
import {
  formatYoutubeLabel,
  formatTwitchLabel,
} from '../utils/socialLinks';

describe('social link labels', () => {
  it('shows the YouTube handle the user entered, not Channel', () => {
    expect(formatYoutubeLabel('CoolForge')).toBe('CoolForge');
    expect(formatYoutubeLabel('@CoolForge')).toBe('@CoolForge');
    expect(formatYoutubeLabel('https://www.youtube.com/@CoolForge')).toBe(
      '@CoolForge'
    );
    expect(formatYoutubeLabel('https://youtube.com/c/CoolForge')).toBe(
      'CoolForge'
    );
  });

  it('shows the Twitch login the user entered, not Channel', () => {
    expect(formatTwitchLabel('coolforge')).toBe('coolforge');
    expect(formatTwitchLabel('@coolforge')).toBe('coolforge');
    expect(formatTwitchLabel('https://www.twitch.tv/coolforge')).toBe(
      'coolforge'
    );
  });
});
