/**
 * Tether-6 Maps from Tether_Task_Breakdown_v0.14.
 * Staging-board import source. Upsert by title / ID prefix.
 * Do not publish. Do not rewrite Tether-4 or Tether-5. Do not add Tether-5.6.
 * Kit is 6.1 (first). Section maps assemble from kit families.
 */

export const TETHER_V014_VERSION = 'v0.14';
export const TETHER_V014_PROJECT_SLUG = 'tether';
export const TETHER_V014_SOURCE = 'Tether_Task_Breakdown_v0.14';

export const TETHER_V014_TITLE_RE = /^Tether-(6|11\.4|11\.5|CD\.3)([. ]|$)/;

export function isTetherV014Title(title) {
  return TETHER_V014_TITLE_RE.test(String(title || '').trim());
}

function t(partial) {
  return partial;
}

function blocked(task) {
  const codes = task.blockedByCodes || (task.blockedByCode ? [task.blockedByCode] : []);
  return {
    ...task,
    blockedByCode: codes[0] || undefined,
    blockedByCodes: codes,
    state: codes.length ? 'Blocked' : task.state,
    blocker:
      task.blocker ||
      (codes.length ? `Waiting on ${codes.join(' and ')}.` : undefined),
  };
}

/** @type {Array<{
 *  code: string,
 *  parentCode: string|null,
 *  shortTitle: string,
 *  state: 'Staff Only'|'Blocked'|'Ready'|'In Review'|'Done',
 *  size: 'Small'|'Medium',
 *  skill: string,
 *  staffOnly: boolean,
 *  purpose: string,
 *  output?: string,
 *  dod?: string[],
 *  blocker?: string,
 *  blockedByCode?: string,
 *  blockedByCodes?: string[],
 *  extra?: string,
 *  sortOrder: number,
 * }>} */
export const TETHER_V014_TASKS = [
  t({
    code: 'Tether-6',
    parentCode: null,
    shortTitle: 'Maps',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Level Design',
    staffOnly: true,
    purpose:
      'Official run: 9 maps in 3 sections of 3, plus one finale arena. Semi-procedural. A map is a spine plus slots. Slots accept modular kit pieces. Kit is built first. Do not unique-sculpt a map that cannot accept kit pieces.',
    extra: 'Source: Tether_Task_Breakdown_v0.14. Staging only. Do not publish.',
    sortOrder: 60,
  }),

  t({
    code: 'Tether-6.0',
    parentCode: 'Tether-6',
    shortTitle: 'Spine and shuffle rules',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Design',
    staffOnly: true,
    purpose: 'Write this before helpers drop pieces.',
    sortOrder: 5,
  }),
  t({
    code: 'Tether-6.0.1',
    parentCode: 'Tether-6.0',
    shortTitle: 'Docs/Maps.md',
    state: 'Ready',
    size: 'Small',
    skill: 'Writing',
    staffOnly: false,
    purpose: 'Campaign list. Spine per section. What may shuffle. What must stay. Link from README.',
    output: 'Docs/Maps.md in the Tether repo, linked from README.',
    dod: [
      'Docs/Maps.md exists with the campaign list, spine per section, what may shuffle, and what must stay.',
      'README links Docs/Maps.md.',
    ],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-6.0.2',
    parentCode: 'Tether-6.0',
    shortTitle: 'Seed rule',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Design',
    staffOnly: true,
    purpose:
      'Daily, per-session, or player choice. Open until Matthew picks it. Write the pick in Docs/Maps.md.',
    dod: [
      'Matthew picks daily, per-session, or player choice.',
      'The pick is written in Docs/Maps.md.',
    ],
    sortOrder: 20,
  }),
  t({
    code: 'Tether-6.0.3',
    parentCode: 'Tether-6.0',
    shortTitle: 'Slot language',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Design',
    staffOnly: true,
    purpose: 'A slot accepts one kit piece from a named list.',
    dod: ['Slot language is written: one kit piece from a named list.'],
    sortOrder: 30,
  }),
  t({
    code: 'Tether-6.0.4',
    parentCode: 'Tether-6.0',
    shortTitle: 'Theme gate',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Design',
    staffOnly: true,
    purpose:
      'Official slots only take on-theme pieces. Off-theme pieces go to unofficial maps.',
    dod: [
      'Official slots only accept on-theme pieces.',
      'Off-theme pieces are routed to unofficial maps.',
    ],
    sortOrder: 40,
  }),

  t({
    code: 'Tether-6.1',
    parentCode: 'Tether-6',
    shortTitle: 'Modular kit',
    state: 'Ready',
    size: 'Medium',
    skill: 'Level Design',
    staffOnly: false,
    purpose:
      'FIRST BUILD. Content/Tether/Modular. StyleLock scale: player about 180 cm, floor tile 200 cm, ramps walkable with the beam on. Build by family. Close a family when that section needs it. Do not wait for every family before Map 1.',
    output: 'Content/Tether/Modular kit families.',
    sortOrder: 10,
  }),
  t({
    code: 'Tether-6.1.1',
    parentCode: 'Tether-6.1',
    shortTitle: 'Folder naming and piece list',
    state: 'Ready',
    size: 'Small',
    skill: 'Writing',
    staffOnly: false,
    purpose: 'Folder, naming, and piece list in Docs/Maps.md.',
    dod: ['Docs/Maps.md records the Modular folder, naming, and piece list.'],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-6.1.2',
    parentCode: 'Tether-6.1',
    shortTitle: 'Ground kit family',
    state: 'Ready',
    size: 'Small',
    skill: 'Level Design',
    staffOnly: false,
    purpose:
      'Floors, ramps, ledges, wrap pillars, beginner hang lips. Required before Section 1 maps.',
    output: 'Ground kit family in Content/Tether/Modular.',
    dod: [
      'Ground kit includes floors, ramps, ledges, wrap pillars, and beginner hang lips.',
      'Pieces follow StyleLock scale and are walkable with the beam on.',
    ],
    sortOrder: 20,
  }),
  t({
    code: 'Tether-6.1.3',
    parentCode: 'Tether-6.1',
    shortTitle: 'Island and rock kit family',
    state: 'Ready',
    size: 'Small',
    skill: 'Level Design',
    staffOnly: false,
    purpose:
      'Landing pads, gap markers, drift rocks. Required before Section 2 maps.',
    output: 'Island and rock kit family in Content/Tether/Modular.',
    dod: ['Landing pads, gap markers, and drift rocks exist in the kit.'],
    sortOrder: 30,
  }),
  t({
    code: 'Tether-6.1.4',
    parentCode: 'Tether-6.1',
    shortTitle: 'Space kit family',
    state: 'Ready',
    size: 'Small',
    skill: 'Level Design',
    staffOnly: false,
    purpose:
      'Struts, rings, no-floor rooms, well mouth. Required before Section 3 maps and the arena.',
    output: 'Space kit family in Content/Tether/Modular.',
    dod: ['Struts, rings, no-floor rooms, and a well mouth exist in the kit.'],
    sortOrder: 40,
  }),
  t({
    code: 'Tether-6.1.5',
    parentCode: 'Tether-6.1',
    shortTitle: 'Utility kit pieces',
    state: 'Ready',
    size: 'Small',
    skill: 'Level Design',
    staffOnly: false,
    purpose:
      'Resource pad, warp pad, enemy marker, spore-legal ground, nest crack. Needed as soon as a map uses them.',
    output: 'Utility kit pieces in Content/Tether/Modular.',
    dod: [
      'Resource pad, warp pad, enemy marker, spore-legal ground, and nest crack exist.',
    ],
    sortOrder: 50,
  }),
  t({
    code: 'Tether-6.1.6',
    parentCode: 'Tether-6.1',
    shortTitle: 'Slot sockets',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Invisible volumes on a spine that accept one piece from a list. Required before shuffle can run.',
    dod: [
      'Slot sockets exist as invisible volumes on a spine.',
      'A socket accepts one piece from a named list.',
    ],
    sortOrder: 60,
  }),
  blocked({
    code: 'Tether-6.1.7',
    parentCode: 'Tether-6.1',
    shortTitle: 'Kit hero art',
    state: 'Blocked',
    size: 'Small',
    skill: 'Art',
    staffOnly: true,
    purpose: 'Blocked on CD.1. Graybox closes 6.1.',
    blockedByCode: 'Tether-CD.1',
    dod: [
      'Hero kit art waits on Tether-CD.1.',
      'Graybox kit is enough to close Medium 6.1.',
    ],
    sortOrder: 70,
  }),

  blocked({
    code: 'Tether-6.2',
    parentCode: 'Tether-6',
    shortTitle: 'Section 1 beginner ground',
    state: 'Blocked',
    size: 'Medium',
    skill: 'Level Design',
    staffOnly: true,
    purpose:
      'Low world. Start low, climb high. Map 1 easiest, Map 2 a step up, Map 3 hardest of the three. No grapple. No zero-g. Assemble from kit pieces.',
    blockedByCode: 'Tether-6.1.2',
    sortOrder: 20,
  }),
  t({
    code: 'Tether-6.2.1',
    parentCode: 'Tether-6.2',
    shortTitle: 'Map 1 spine',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Level Design',
    staffOnly: true,
    purpose:
      'Teaching map. Short climb. Wide ledges. One easy wrap or tight path. Resource pocket. Warp or checkpoint at the top.',
    dod: [
      'Map 1 is a short climb with wide ledges and one easy wrap or tight path.',
      'A resource pocket exists. Warp or checkpoint sits at the top.',
    ],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-6.2.2',
    parentCode: 'Tether-6.2',
    shortTitle: 'Map 2 spine',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Level Design',
    staffOnly: true,
    purpose: 'Same language, longer or tighter. One extra challenge slot.',
    dod: ['Map 2 uses the same language, longer or tighter, with one extra challenge slot.'],
    sortOrder: 20,
  }),
  t({
    code: 'Tether-6.2.3',
    parentCode: 'Tether-6.2',
    shortTitle: 'Map 3 spine',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Level Design',
    staffOnly: true,
    purpose: 'Hardest ground map. Still readable. Still low world.',
    dod: ['Map 3 is the hardest ground map and stays readable and low-world.'],
    sortOrder: 30,
  }),
  t({
    code: 'Tether-6.2.4',
    parentCode: 'Tether-6.2',
    shortTitle: 'Section 1 slot list',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Design',
    staffOnly: true,
    purpose: 'Legal ground pieces only.',
    dod: ['Section 1 slots accept legal ground pieces only.'],
    sortOrder: 40,
  }),
  t({
    code: 'Tether-6.2.5',
    parentCode: 'Tether-6.2',
    shortTitle: 'Section 1 enemy markers',
    state: 'Ready',
    size: 'Small',
    skill: 'Level Design',
    staffOnly: false,
    purpose: 'Optional. Empty until a creature is wired.',
    dod: ['Enemy markers may sit empty until a creature is wired.'],
    sortOrder: 50,
  }),
  t({
    code: 'Tether-6.2.6',
    parentCode: 'Tether-6.2',
    shortTitle: 'Section 1 playtest',
    state: 'Staff Only',
    size: 'Small',
    skill: 'QA',
    staffOnly: true,
    purpose: 'Beam on. Two people.',
    dod: ['Section 1 is playtested with the beam on and two people.'],
    sortOrder: 60,
  }),

  blocked({
    code: 'Tether-6.3',
    parentCode: 'Tether-6',
    shortTitle: 'Section 2 floating rocks and islands',
    state: 'Blocked',
    size: 'Medium',
    skill: 'Level Design',
    staffOnly: true,
    purpose:
      'Grapple unlocks here (Tether-11.4). Map 4 easy test of the section. Map 5 more intense. Map 6 hardest of the three and ends in the gravity well.',
    blockedByCode: 'Tether-6.1.3',
    sortOrder: 30,
  }),
  t({
    code: 'Tether-6.3.1',
    parentCode: 'Tether-6.3',
    shortTitle: 'Map 4 spine',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Level Design',
    staffOnly: true,
    purpose: 'Intro to gaps and islands.',
    dod: ['Map 4 introduces gaps and islands.'],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-6.3.2',
    parentCode: 'Tether-6.3',
    shortTitle: 'Map 5 spine',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Level Design',
    staffOnly: true,
    purpose: 'More gaps and challenge slots.',
    dod: ['Map 5 adds more gaps and challenge slots.'],
    sortOrder: 20,
  }),
  t({
    code: 'Tether-6.3.3',
    parentCode: 'Tether-6.3',
    shortTitle: 'Map 6 spine',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Level Design',
    staffOnly: true,
    purpose: 'Hardest island map. Ends at the gravity well.',
    dod: ['Map 6 is the hardest island map and ends at the gravity well.'],
    sortOrder: 30,
  }),
  t({
    code: 'Tether-6.3.4',
    parentCode: 'Tether-6.3',
    shortTitle: 'Gravity well piece',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Lives in the kit, then sits in the Map 6 end slot. Readable pull. Beam rules still apply. Numbers Open.',
    dod: [
      'A gravity-well piece exists in the kit and sits in the Map 6 end slot.',
      'Pull is readable. Beam rules still apply. Numbers stay Open.',
    ],
    sortOrder: 40,
  }),
  t({
    code: 'Tether-6.3.5',
    parentCode: 'Tether-6.3',
    shortTitle: 'Section 2 slot list',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Design',
    staffOnly: true,
    purpose: 'Legal island and rock pieces for Section 2 slots.',
    dod: ['Section 2 slots have a legal piece list.'],
    sortOrder: 50,
  }),
  t({
    code: 'Tether-6.3.6',
    parentCode: 'Tether-6.3',
    shortTitle: 'Section 2 waits on grapple',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Design',
    staffOnly: true,
    purpose:
      'Spines can be laid out before Tether-11.4 exists. Playtests wait on a usable hook.',
    dod: [
      'Spines may be laid out before Tether-11.4.',
      'Playtests wait on a usable grapple hook.',
    ],
    sortOrder: 60,
  }),
  blocked({
    code: 'Tether-6.3.7',
    parentCode: 'Tether-6.3',
    shortTitle: 'Section 2 playtest',
    state: 'Blocked',
    size: 'Small',
    skill: 'QA',
    staffOnly: true,
    purpose: 'Section 2 playtest waits on a usable grapple hook.',
    blockedByCode: 'Tether-11.4',
    dod: ['Section 2 is playtested with a usable grapple hook.'],
    sortOrder: 70,
  }),

  blocked({
    code: 'Tether-6.4',
    parentCode: 'Tether-6',
    shortTitle: 'Section 3 space',
    state: 'Blocked',
    size: 'Medium',
    skill: 'Level Design',
    staffOnly: true,
    purpose:
      'No gravity. Boost pack is Tether-11.5: a short weak shove while not touching a surface. Assist only. A stuck player still needs a teammate on a surface or on the line. Fail the pack if a solo player can finish the map without the beam.',
    blockedByCode: 'Tether-6.1.4',
    sortOrder: 40,
  }),
  t({
    code: 'Tether-6.4.1',
    parentCode: 'Tether-6.4',
    shortTitle: 'Map 7 spine',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Level Design',
    staffOnly: true,
    purpose:
      'Intro space. Teaches no-floor play and that the pack cannot replace the line.',
    dod: ['Map 7 teaches no-floor play and that the pack cannot replace the line.'],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-6.4.2',
    parentCode: 'Tether-6.4',
    shortTitle: 'Map 8 spine',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Level Design',
    staffOnly: true,
    purpose: 'Harder space.',
    dod: ['Map 8 is a harder space layout.'],
    sortOrder: 20,
  }),
  t({
    code: 'Tether-6.4.3',
    parentCode: 'Tether-6.4',
    shortTitle: 'Map 9 spine',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Level Design',
    staffOnly: true,
    purpose: 'Hardest space map before the arena.',
    dod: ['Map 9 is the hardest space map before the arena.'],
    sortOrder: 30,
  }),
  t({
    code: 'Tether-6.4.4',
    parentCode: 'Tether-6.4',
    shortTitle: 'Section 3 slot list',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Design',
    staffOnly: true,
    purpose: 'Legal space pieces for Section 3 slots.',
    dod: ['Section 3 slots have a legal piece list.'],
    sortOrder: 40,
  }),
  t({
    code: 'Tether-6.4.5',
    parentCode: 'Tether-6.4',
    shortTitle: 'Section 3 waits on boost pack',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Design',
    staffOnly: true,
    purpose: 'Playtests wait on Tether-11.5.',
    dod: ['Section 3 playtests wait on Tether-11.5.'],
    sortOrder: 50,
  }),
  blocked({
    code: 'Tether-6.4.6',
    parentCode: 'Tether-6.4',
    shortTitle: 'Section 3 playtest',
    state: 'Blocked',
    size: 'Small',
    skill: 'QA',
    staffOnly: true,
    purpose: 'Section 3 playtest waits on the boost pack.',
    blockedByCode: 'Tether-11.5',
    dod: ['Section 3 is playtested with Tether-11.5.'],
    sortOrder: 60,
  }),

  blocked({
    code: 'Tether-6.5',
    parentCode: 'Tether-6',
    shortTitle: 'Finale arena',
    state: 'Blocked',
    size: 'Medium',
    skill: 'Level Design',
    staffOnly: true,
    purpose:
      'After Map 9. Arena, not a climb. Station feel. Win idea: antimatter generator through the warp portal. Opponent is an idea only. Very large dangerous unknown alien. Big enough to move space station parts around. No fight card. No Tether-5.6.',
    blockedByCodes: ['Tether-6.1.4', 'Tether-6.1.5'],
    sortOrder: 50,
  }),
  t({
    code: 'Tether-6.5.1',
    parentCode: 'Tether-6.5',
    shortTitle: 'Arena spine',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Level Design',
    staffOnly: true,
    purpose:
      'Space and utility pieces. Leave a large volume the creature could occupy later.',
    dod: [
      'Arena spine uses space and utility pieces.',
      'A large volume is left for a creature later. No fight card.',
    ],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-6.5.2',
    parentCode: 'Tether-6.5',
    shortTitle: 'Generator pickup',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Uses Epic 4 carry. One object.',
    dod: ['One generator object uses the Epic 4 carry.'],
    sortOrder: 20,
  }),
  t({
    code: 'Tether-6.5.3',
    parentCode: 'Tether-6.5',
    shortTitle: 'Portal send',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Warp the generator. Session complete message.',
    dod: [
      'Warping the generator works.',
      'A session-complete message plays.',
    ],
    sortOrder: 30,
  }),
  t({
    code: 'Tether-6.5.4',
    parentCode: 'Tether-6.5',
    shortTitle: 'Boss idea note',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Writing',
    staffOnly: true,
    purpose:
      'One paragraph in Docs/Maps.md. Large unknown alien that can shove station parts. Stop there.',
    dod: [
      'Docs/Maps.md has one paragraph: large unknown alien that can shove station parts.',
      'No fight card. No Tether-5.6.',
    ],
    sortOrder: 40,
  }),
  t({
    code: 'Tether-6.5.5',
    parentCode: 'Tether-6.5',
    shortTitle: 'Portal loop playtest',
    state: 'Staff Only',
    size: 'Small',
    skill: 'QA',
    staffOnly: true,
    purpose: 'Dummy object is enough.',
    dod: ['Portal loop is playtested. A dummy object is enough.'],
    sortOrder: 50,
  }),

  t({
    code: 'Tether-6.6',
    parentCode: 'Tether-6',
    shortTitle: 'Unofficial maps',
    state: 'Ready',
    size: 'Medium',
    skill: 'Level Design',
    staffOnly: false,
    purpose:
      'Same kit. Off-theme layouts people like. Loadable outside the official 10 spaces.',
    sortOrder: 60,
  }),
  t({
    code: 'Tether-6.6.1',
    parentCode: 'Tether-6.6',
    shortTitle: 'Community map path',
    state: 'Ready',
    size: 'Small',
    skill: 'Writing',
    staffOnly: false,
    purpose:
      'Content/Tether/Maps/Community/ plus a short Docs note: author, player count, what the line is asked to do, unofficial.',
    output: 'Content/Tether/Maps/Community/ with a short author note per map.',
    dod: [
      'Unofficial maps live in Content/Tether/Maps/Community/.',
      'Each map has a short note: author, player count, what the line is asked to do, unofficial.',
    ],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-6.6.2',
    parentCode: 'Tether-6.6',
    shortTitle: 'Unofficial Ready slots',
    state: 'Ready',
    size: 'Small',
    skill: 'Level Design',
    staffOnly: false,
    purpose:
      'Publish empty slots when staff want helpers in the editor. Stay on Staging this pass.',
    dod: [
      'Empty unofficial slots can be published when staff want helpers in the editor.',
      'This pass stays on Staging.',
    ],
    sortOrder: 20,
  }),
  t({
    code: 'Tether-6.6.3',
    parentCode: 'Tether-6.6',
    shortTitle: 'Unofficial review',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Design',
    staffOnly: true,
    purpose: 'Promote only if on theme and it fits a spine.',
    dod: ['Unofficial maps are promoted only if on theme and they fit a spine.'],
    sortOrder: 30,
  }),

  t({
    code: 'Tether-6.7',
    parentCode: 'Tether-6',
    shortTitle: 'Map Open Question',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Community',
    staffOnly: true,
    purpose:
      'Copy lives in Tether_Open_Question_Maps.docx. ID TQ-004 / Tether-CD.3. Question: What should Tether maps add? Official layout is locked. Community suggests obstacles, extra terrain, and unofficial maps.',
    sortOrder: 70,
  }),
  t({
    code: 'Tether-6.7.1',
    parentCode: 'Tether-6.7',
    shortTitle: 'Question copy on the card',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Writing',
    staffOnly: true,
    purpose:
      'Paste the public Question and Context from Tether_Open_Question_Maps.docx. Question: What should Tether maps add? Official layout is locked. Community suggests obstacles, extra terrain, and unofficial maps.',
    dod: [
      'The public Question and Context from Tether_Open_Question_Maps.docx are on this card.',
    ],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-6.7.2',
    parentCode: 'Tether-6.7',
    shortTitle: 'CD marker',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Community',
    staffOnly: true,
    purpose:
      'When the question is live, also add a Staff Only In Progress marker under Epic Tether-CD titled "Tether-CD.3 Map pieces TQ-004". That marker is not claimable. Do not parent the marker under a section map.',
    dod: [
      'Tether-CD.3 Map pieces TQ-004 exists under Epic Tether-CD.',
      'The marker is Staff Only, In Progress, and not claimable.',
      'It is not parented under a section map.',
    ],
    sortOrder: 20,
  }),

  t({
    code: 'Tether-11.4',
    parentCode: 'Tether-11',
    shortTitle: 'Grapple hook',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Section 2 unlock. Reach places walking cannot. Beam rules still apply while hooked. Numbers Open.',
    extra: 'Do not parent under Tether-6. Founder-owned feel stays Open.',
    sortOrder: 40,
  }),
  t({
    code: 'Tether-11.5',
    parentCode: 'Tether-11',
    shortTitle: 'Boost pack',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Section 3 assist. Short weak shove while not touching a surface. Cannot clear a space map alone. Founder owns the feel.',
    extra: 'Do not parent under Tether-6.',
    sortOrder: 50,
  }),
  t({
    code: 'Tether-CD.3',
    parentCode: 'Tether-CD',
    shortTitle: 'Map pieces TQ-004',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Community',
    staffOnly: true,
    purpose:
      'Open Question marker. Not claimable work. TQ-004. What should Tether maps add? Official layout is locked. Community suggests obstacles, extra terrain, and unofficial maps.',
    extra: 'Staff Only In Progress marker. Do not parent under a section map.',
    sortOrder: 30,
  }),
];

export function tetherV014Title(task) {
  return `${task.code} ${task.shortTitle}`;
}

export function tetherV014Difficulty(size) {
  if (size === 'Small') return 'Easy';
  return 'Medium';
}

export function tetherV014StaffOnly(task) {
  if (typeof task?.staffOnly === 'boolean') return task.staffOnly;
  return task?.state === 'Staff Only';
}

export function buildTetherV014Description(task) {
  const lines = [];
  if (task.purpose) lines.push(task.purpose);
  if (task.output) {
    lines.push('', `Output: ${task.output}`);
  }
  if (Array.isArray(task.dod) && task.dod.length) {
    lines.push('', 'Definition of Done:');
    for (const item of task.dod) lines.push(`- ${item}`);
  }
  if (task.blocker) {
    lines.push('', `Blocker: ${task.blocker}`);
  }
  if (task.extra) {
    lines.push('', task.extra);
  }
  return lines.join('\n').trim();
}

export function tetherV014Subtasks(task) {
  if (!Array.isArray(task.dod) || !task.dod.length) return [];
  return task.dod.map((label, i) => ({
    id: `s${i + 1}`,
    label,
    done: false,
  }));
}

export function tetherV014Depth(task) {
  if (!task.parentCode) return 0;
  const parent = TETHER_V014_TASKS.find((x) => x.code === task.parentCode);
  if (!parent || !parent.parentCode) return 1;
  return 2;
}
