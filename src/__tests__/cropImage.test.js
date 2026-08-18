import { describe, it, expect } from 'vitest';
import { getCroppedImageFile } from '../utils/cropImage';

describe('getCroppedImageFile', () => {
  it('rejects when crop data is missing', async () => {
    await expect(getCroppedImageFile('', null)).rejects.toThrow('Nothing to crop');
    await expect(
      getCroppedImageFile('blob:x', { x: 0, y: 0, width: 0, height: 0 })
    ).rejects.toThrow('Nothing to crop');
  });
});
