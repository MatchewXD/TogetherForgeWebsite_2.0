/**
 * Compact collapsible FAQ list. Only the question is shown until expanded.
 */

import { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import Card from './Card';

/**
 * @param {{ items: Array<{ q: string, a: string }>, className?: string }} props
 */
const FaqAccordion = ({ items = [], className = '' }) => {
  const [openIndex, setOpenIndex] = useState(null);

  const toggle = (index) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {items.map((item, index) => {
        const open = openIndex === index;
        const panelId = `faq-panel-${index}`;
        const buttonId = `faq-button-${index}`;

        return (
          <Card key={item.q} className="bg-cyber-card/80 !p-0 overflow-hidden">
            <button
              type="button"
              id={buttonId}
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => toggle(index)}
              className="w-full flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-3.5 text-left hover:bg-cyber-surface/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neon-cyan"
            >
              <HelpCircle className="w-4 h-4 text-neon-cyan shrink-0" />
              <span className="flex-1 min-w-0 text-sm sm:text-base font-medium text-white leading-snug">
                {item.q}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-text-muted shrink-0 transition-transform duration-200 ${
                  open ? 'rotate-180 text-neon-cyan' : ''
                }`}
                aria-hidden="true"
              />
            </button>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!open}
              className={
                open
                  ? 'border-t border-cyber-border px-4 sm:px-5 pb-3.5 pt-2.5 pl-[2.75rem] sm:pl-[3rem]'
                  : undefined
              }
            >
              {open && (
                <p className="text-sm text-text-secondary leading-relaxed">
                  {item.a}
                </p>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default FaqAccordion;
