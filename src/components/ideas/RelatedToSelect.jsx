/**
 * Grouped "Related to" select: Phases + live Projects.
 */

import { resolveLinkDisplayName } from '../../utils/ideaStatus';

const RelatedToSelect = ({
  id = 'idea-related-to',
  value = '',
  onChange,
  phases = [],
  projects = [],
  className = '',
  disabled = false,
}) => {
  const current = value == null ? '' : String(value);
  // If value is missing from lists (race), still render it
  const known =
    phases.some((p) => p.id === current) ||
    projects.some((p) => p.id === current);
  const orphanLabel = !known && current ? resolveLinkDisplayName(current) || current : null;

  return (
    <select
      id={id}
      className={className}
      value={current}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
    >
      <optgroup label="Phases">
        {phases.map((p) => (
          <option key={p.id === '' ? '__community' : p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </optgroup>
      {projects.length > 0 && (
        <optgroup label="Projects">
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </optgroup>
      )}
      {orphanLabel && (
        <optgroup label="Current">
          <option value={current}>{orphanLabel}</option>
        </optgroup>
      )}
    </select>
  );
};

export default RelatedToSelect;
