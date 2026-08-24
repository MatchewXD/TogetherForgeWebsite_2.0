/**
 * Full-bleed page/hero photo. Serves a 960w WebP when present so phones
 * do not decode the 1536px master.
 */

export function compactBannerSrc(src) {
  if (!src || typeof src !== 'string') return null;
  if (!src.toLowerCase().endsWith('.webp')) return null;
  if (src.includes('-960.webp')) return src;
  return src.replace(/\.webp$/i, '-960.webp');
}

const BannerImage = ({
  src,
  alt = '',
  className = 'absolute inset-0 w-full h-full object-cover object-center',
  fetchPriority,
  sizes = '100vw',
  loading,
}) => {
  const compact = compactBannerSrc(src);
  return (
    <img
      src={src}
      srcSet={compact ? `${compact} 960w, ${src} 1536w` : undefined}
      sizes={compact ? sizes : undefined}
      alt={alt}
      className={className}
      decoding="async"
      fetchPriority={fetchPriority}
      loading={loading}
    />
  );
};

export default BannerImage;
