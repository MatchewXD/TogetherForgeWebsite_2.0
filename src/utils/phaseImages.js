/**
 * Studio phase hero images (public/images/phase_images).
 * Maps Early / Mid / Late to WebP assets.
 */

const PHASE_IMAGES = {
  early: '/images/phase_images/Early_Phase_Illistration.webp',
  mid: '/images/phase_images/Mid_Phse_Illistration.webp',
  late: '/images/phase_images/Late_Phase_Illistration.webp',
};

/**
 * @param {string|null|undefined} phase - e.g. "Early", "Mid", "Late"
 * @returns {string|null} public URL or null if unknown
 */
export function phaseImageSrc(phase) {
  if (phase == null) return null;
  const key = String(phase).trim().toLowerCase();
  if (key.startsWith('early')) return PHASE_IMAGES.early;
  if (key.startsWith('mid')) return PHASE_IMAGES.mid;
  if (key.startsWith('late')) return PHASE_IMAGES.late;
  return null;
}

/**
 * Short alt text for phase art
 * @param {string|null|undefined} phase
 * @param {string} [projectTitle]
 */
export function phaseImageAlt(phase, projectTitle = '') {
  const p = phase ? String(phase) : 'Studio';
  if (projectTitle) return `${projectTitle} — ${p} phase illustration`;
  return `${p} phase studio illustration`;
}

export default PHASE_IMAGES;
