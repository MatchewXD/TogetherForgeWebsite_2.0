/**
 * Circular zoom + crop dialog for profile pictures.
 */

import { useCallback, useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';
import Modal from '../ui/Modal';
import Button from '../ui/Buttons';
import { getCroppedImageFile } from '../../utils/cropImage';

export default function AvatarCropModal({
  imageSrc,
  fileName = 'avatar.jpg',
  onCancel,
  onApply,
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setPixels(null);
    setBusy(false);
    setError('');
  }, [imageSrc]);

  const onCropComplete = useCallback((_area, croppedPixels) => {
    setPixels(croppedPixels);
  }, []);

  const apply = async () => {
    if (!imageSrc || !pixels) return;
    setBusy(true);
    setError('');
    try {
      const file = await getCroppedImageFile(imageSrc, pixels, fileName);
      onApply?.(file);
    } catch (e) {
      setError(e?.message || 'Could not crop photo.');
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(imageSrc)}
      onClose={() => {
        if (!busy) onCancel?.();
      }}
      title="Adjust photo"
      size="lg"
      framed={false}
    >
      <p className="text-sm text-text-secondary mb-4">
        Drag to move. Use the slider or pinch to zoom. The circle is what
        others will see as your profile picture.
      </p>

      <div className="relative h-72 sm:h-80 rounded-xl overflow-hidden bg-black border border-cyber-border">
        {imageSrc && (
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            objectFit="contain"
            style={{
              cropAreaStyle: {
                border: '2px solid rgba(0, 249, 255, 0.95)',
              },
            }}
          />
        )}
      </div>

      <div className="mt-5">
        <label
          htmlFor="avatar-crop-zoom"
          className="block text-[10px] font-mono tracking-widest uppercase text-text-muted mb-2"
        >
          Zoom
        </label>
        <input
          id="avatar-crop-zoom"
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full accent-neon-cyan"
          disabled={busy}
        />
      </div>

      {error && (
        <p className="text-sm text-red-300 mt-3" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-6">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => void apply()}
          disabled={busy || !pixels}
        >
          {busy ? 'Applying…' : 'Use photo'}
        </Button>
      </div>
    </Modal>
  );
}
