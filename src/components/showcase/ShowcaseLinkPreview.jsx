/**
 * Open Graph-style media for Community Showcase article / link cards.
 * Prefers a stored thumbnail; otherwise loads OG image + site label from the URL.
 */

import { useEffect, useRef, useState } from 'react';
import { FileText, Globe } from 'lucide-react';
import {
  fetchLinkPreview,
  linkHostname,
} from '../../services/linkPreviewService';

/**
 * @param {object} props
 * @param {string} props.url
 * @param {string|null} [props.storedThumb]
 * @param {boolean} [props.eager]
 * @param {(preview: object|null) => void} [props.onPreview]
 */
const ShowcaseLinkPreview = ({
  url,
  storedThumb = null,
  eager = false,
  onPreview,
}) => {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(url));
  const [imgBroken, setImgBroken] = useState(false);
  const onPreviewRef = useRef(onPreview);
  onPreviewRef.current = onPreview;

  useEffect(() => {
    setImgBroken(false);
  }, [url, storedThumb, preview?.image]);

  useEffect(() => {
    if (!url) {
      setPreview(null);
      setLoading(false);
      onPreviewRef.current?.(null);
      return undefined;
    }
    let cancelled = false;
    const ac = new AbortController();
    setLoading(true);
    fetchLinkPreview(url, { signal: ac.signal }).then((data) => {
      if (cancelled) return;
      setPreview(data);
      setLoading(false);
      onPreviewRef.current?.(data);
    });
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [url]);

  const hostname =
    preview?.hostname || linkHostname(url) || preview?.siteName || 'Link';
  const imageSrc =
    (!imgBroken && (storedThumb || preview?.image)) || null;

  return (
    <div className="relative aspect-video bg-cyber-surface overflow-hidden">
      {imageSrc ? (
        <img
          src={imageSrc}
          alt=""
          width={480}
          height={270}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImgBroken(true)}
        />
      ) : (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-cyber-surface via-cyber-bg to-cyber-surface px-4"
          aria-hidden
        >
          {loading ? (
            <div className="w-10 h-10 rounded-full border-2 border-neon-cyan/30 border-t-neon-cyan animate-spin" />
          ) : (
            <>
              <Globe className="w-10 h-10 text-neon-cyan/50" />
              <span className="text-[10px] font-mono tracking-widest uppercase text-text-muted truncate max-w-full">
                {hostname}
              </span>
            </>
          )}
        </div>
      )}
      <div
        className="absolute inset-0 bg-gradient-to-t from-cyber-bg/90 via-transparent to-transparent pointer-events-none"
        aria-hidden
      />
      <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5 min-w-0 pointer-events-none">
        <span className="inline-flex items-center gap-1.5 max-w-full rounded-md border border-white/15 bg-cyber-bg/85 px-2 py-1 text-[10px] font-mono tracking-wide text-text-secondary backdrop-blur-sm">
          <FileText className="w-3 h-3 shrink-0 text-neon-cyan" aria-hidden />
          <span className="truncate">{hostname}</span>
        </span>
      </div>
    </div>
  );
};

export default ShowcaseLinkPreview;
