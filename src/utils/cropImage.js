/**
 * Load an image URL (object URL or http) for canvas drawing.
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = src;
  });
}

const OUTPUT_SIZE = 512;

/**
 * Crop a source image to a square JPEG File using react-easy-crop pixel area.
 * @param {string} imageSrc
 * @param {{ x: number, y: number, width: number, height: number }} pixelCrop
 * @param {string} [fileName]
 * @returns {Promise<File>}
 */
export async function getCroppedImageFile(
  imageSrc,
  pixelCrop,
  fileName = 'avatar.jpg'
) {
  if (!imageSrc || !pixelCrop?.width || !pixelCrop?.height) {
    throw new Error('Nothing to crop');
  }

  const image = await loadImage(imageSrc);
  const sx = Math.max(0, Number(pixelCrop.x) || 0);
  const sy = Math.max(0, Number(pixelCrop.y) || 0);
  const sw = Math.min(image.naturalWidth - sx, Number(pixelCrop.width) || 0);
  const sh = Math.min(image.naturalHeight - sy, Number(pixelCrop.height) || 0);
  if (sw < 1 || sh < 1) {
    throw new Error('Could not crop image');
  }

  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not crop image');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not create image'))),
      'image/jpeg',
      0.9
    );
  });

  const base = String(fileName || 'avatar').replace(/\.[^.]+$/, '') || 'avatar';
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
}
