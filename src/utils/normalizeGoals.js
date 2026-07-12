/**
 * Normalizes raw Goals markdown content for consistent rendering.
 * Handles:
 * - Literal backslash-n sequences → real newlines
 * - <small> tags → markdown italics (_text_)
 * - Strips other HTML tags
 * - Ensures every line starts with a list marker or is a heading/italic line
 */
export function normalizeGoals(raw) {
    let goalsText = raw || `**Early Game (Proof of Concept)**

* Test and prove our community-driven development model works.
* Build and refine core cooperation and teamwork mechanics.
* Create a genuinely fun experience that brings players together.
* Establish transparent systems for volunteering, task tracking, and crediting contributors.
* Gather real community feedback to improve future projects.

<small>Success metric: Strong community engagement during development + positive feedback on cooperative gameplay.</small>`;

    // Convert every literal "\n" (backslash + n) into a real newline
    goalsText = goalsText.split('\\n').join('\n');

    // Convert <small> tags to markdown italics, strip remaining HTML
    goalsText = goalsText
        .replace(/<small>(.*?)<\/small>/gi, '_$1_')
        .replace(/<[^>]*>/g, '');

    // Ensure proper list markers and handle Success metric line
    goalsText = goalsText.split('\n').map(line => {
        const t = line.trim();
        if (!t) return '';
        if (t.toLowerCase().startsWith('success metric:')) return `_${t}_`;
        if (t.startsWith('- ') || t.startsWith('* ') || t.startsWith('> ') || t.startsWith('**') || t.startsWith('#') || t.startsWith('_')) return t;
        return `- ${t}`;
    }).filter(Boolean).join('\n');

    return goalsText;
}