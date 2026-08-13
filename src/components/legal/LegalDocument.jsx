import { Link } from 'react-router-dom';

/**
 * Shared layout for Terms / Privacy / Guidelines.
 * @param {{
 *   meta: { title: string, lastUpdated?: string },
 *   sections: Array<{
 *     heading?: string,
 *     subheading?: string,
 *     body?: string[],
 *     list?: string[],
 *     bodyAfter?: string[],
 *   }>,
 * }} props
 */
export default function LegalDocument({ meta, sections = [] }) {
  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      <div className="border-b border-cyber-border bg-cyber-surface/80 py-12 md:py-16">
        <div className="container-custom max-w-3xl">
          <div className="section-header">Legal</div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white">
            {meta.title}
          </h1>
          {meta.lastUpdated ? (
            <p className="text-sm text-text-muted mt-3 font-mono tracking-wide">
              Last updated: {meta.lastUpdated}
            </p>
          ) : null}
        </div>
      </div>

      <article className="container-custom max-w-3xl py-10 md:py-14">
        <div className="space-y-10 text-[15px] sm:text-base leading-relaxed text-text-secondary">
          {sections.map((section, i) => (
            <section key={section.heading || section.subheading || `s-${i}`}>
              {section.heading ? (
                <h2 className="text-xl sm:text-2xl font-semibold text-white mb-3 tracking-tight">
                  {section.heading}
                </h2>
              ) : null}
              {section.subheading ? (
                <h3 className="text-base sm:text-lg font-semibold text-neon-cyan/90 mb-2 font-mono tracking-wide">
                  {section.subheading}
                </h3>
              ) : null}
              {(section.body || []).map((p, j) => (
                <p key={`b-${j}`} className="mb-3 last:mb-0">
                  {p}
                </p>
              ))}
              {section.list?.length ? (
                <ul className="list-disc pl-5 sm:pl-6 space-y-2 my-3 marker:text-neon-cyan/70">
                  {section.list.map((item, j) => (
                    <li key={`l-${j}`} className="pl-1">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
              {(section.bodyAfter || []).map((p, j) => (
                <p key={`a-${j}`} className="mb-3 last:mb-0 mt-3">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>

        <nav
          className="mt-14 pt-8 border-t border-cyber-border flex flex-wrap gap-x-5 gap-y-2 text-sm font-mono tracking-widest"
          aria-label="Related legal pages"
        >
          <Link to="/terms" className="text-neon-cyan hover:underline">
            TERMS
          </Link>
          <Link to="/privacy" className="text-neon-cyan hover:underline">
            PRIVACY
          </Link>
          <Link to="/guidelines" className="text-neon-cyan hover:underline">
            GUIDELINES
          </Link>
          <Link to="/contact" className="text-text-muted hover:text-neon-cyan">
            CONTACT
          </Link>
        </nav>
      </article>
    </div>
  );
}
