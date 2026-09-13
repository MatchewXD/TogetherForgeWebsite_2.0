/**
 * Tether-9 Production look from Tether_Task_Breakdown_v0.23 plus v0.25.
 * Staging-board import source. Upsert by title / ID prefix.
 * Do not publish. Do not rewrite Tether-4 through Tether-8, Tether-11, or Tether-12.
 */

export const TETHER_V025_VERSION = 'v0.25';
export const TETHER_V025_PROJECT_SLUG = 'tether';
export const TETHER_V025_SOURCE = 'Tether_Task_Breakdown_v0.23 plus v0.25';

export const TETHER_V025_TITLE_RE = /^Tether-9([. ]|$)/;

export const TETHER_V025_SHEET_CODES = [
  'Tether-9.0.A',
  'Tether-9.0.B',
  'Tether-9.0.C',
];

export function isTetherV025Title(title) {
  return TETHER_V025_TITLE_RE.test(String(title || '').trim());
}

const LOOK =
  'Look: worn mid-poly sci-fi. Cool colony tech. Beam carries the energy color. One suit silhouette. One scuffed metal. Basic and quick. Match Tether_Art_Reference_List.docx and Docs/StyleLock.md. Do not import Lethal Company or Deep Rock Galactic meshes.';

const SHEET_WAIT =
  'Blocked on Tether-9.0.A Scale sheet, Tether-9.0.B Suit sheet, and Tether-9.0.C World sheet. When those three are Done, helpers can claim 9.1-9.8 and stay on style.';

function t(partial) {
  return partial;
}

function look(partial) {
  return t({
    skill: 'Art',
    staffOnly: false,
    blockedByCodes: TETHER_V025_SHEET_CODES,
    extra: SHEET_WAIT,
    ...partial,
  });
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
 *  extra?: string,
 *  blockedByCodes?: string[],
 *  sortOrder: number,
 * }>} */
export const TETHER_V025_TASKS = [
  t({
    code: 'Tether-9',
    parentCode: null,
    shortTitle: 'Production look',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Art',
    staffOnly: true,
    purpose:
      'Meshes, materials, icons. Tether-6.1 owns graybox shapes. Tether-11 owns clips. A look card paints a piece that already exists in the kit. It does not invent a tenth campaign map.',
    extra: `${LOOK}\n\nSource: ${TETHER_V025_SOURCE}. Staging only. Do not publish.`,
    sortOrder: 90,
  }),

  t({
    code: 'Tether-9.0',
    parentCode: 'Tether-9',
    shortTitle: 'Reference sheets',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Art',
    staffOnly: true,
    purpose:
      'Pictures other artists copy. Output PNGs to Docs/ArtRef/ in the Tether repo. Link them from Docs/StyleLock.md.',
    extra: LOOK,
    sortOrder: 10,
  }),
  t({
    code: 'Tether-9.0.0',
    parentCode: 'Tether-9.0',
    shortTitle: 'Mood board',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Art',
    staffOnly: true,
    purpose:
      'Four shots from Lethal Company and Deep Rock Galactic. Each shot has a take line and a leave line. Not production meshes. Not a blocker for 9.1-9.8.',
    extra: 'Do not import Lethal Company or Deep Rock Galactic meshes.',
    dod: [
      'Mood board has four shots.',
      'Each shot has a take line and a leave line.',
      'Shots are reference only. Not production meshes.',
    ],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-9.0.A',
    parentCode: 'Tether-9.0',
    shortTitle: 'Scale sheet',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Art',
    staffOnly: true,
    purpose:
      '180 cm mannequin on a 200 cm tile. Airlock a suited player can walk through. Ramp walkable with the beam on. Resource that reads in a gloved hand. Oversized scrap that needs two hands. Beam thickness at Low and at Over. Front shot with a meter grid.',
    output: 'Docs/ArtRef/ scale sheet PNG.',
    dod: [
      '180 cm mannequin stands on a 200 cm tile.',
      'Airlock is walkable for a suited player.',
      'Ramp is walkable with the beam on.',
      'A resource reads in a gloved hand.',
      'Oversized scrap needs two hands.',
      'Beam thickness is shown at Low and at Over.',
      'Front shot includes a meter grid.',
    ],
    sortOrder: 20,
  }),
  t({
    code: 'Tether-9.0.B',
    parentCode: 'Tether-9.0',
    shortTitle: 'Suit sheet',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Art',
    staffOnly: true,
    purpose:
      'One Tether crew. Helmet on. Pack on. Front, side, back. Empty hands, Extractor out, carrying oversized scrap. No second body shape.',
    output: 'Docs/ArtRef/ suit sheet PNG.',
    dod: [
      'One Tether crew with helmet on and pack on.',
      'Front, side, and back views exist.',
      'Empty hands, Extractor out, and carrying oversized scrap are shown.',
      'No second body shape.',
    ],
    sortOrder: 30,
  }),
  t({
    code: 'Tether-9.0.C',
    parentCode: 'Tether-9.0',
    shortTitle: 'World sheet',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Art',
    staffOnly: true,
    purpose:
      'One interior wall tile. One exterior rock tile. One repeating crate or panel. One scuffed metal material ball. Same metal everyone else instances.',
    output: 'Docs/ArtRef/ world sheet PNG.',
    dod: [
      'Interior wall tile, exterior rock tile, and a repeating crate or panel exist.',
      'One scuffed metal material ball is on the sheet.',
      'That metal is the instance target for the rest of the look.',
    ],
    sortOrder: 40,
  }),
  t({
    code: 'Tether-9.0.1',
    parentCode: 'Tether-9.0',
    shortTitle: 'ArtRef folder and StyleLock links',
    state: 'Blocked',
    size: 'Small',
    skill: 'Art',
    staffOnly: true,
    purpose: 'Blocked on 9.0.A, 9.0.B, 9.0.C existing as pictures.',
    output: 'Docs/ArtRef/ PNGs linked from Docs/StyleLock.md.',
    blockedByCodes: TETHER_V025_SHEET_CODES,
    dod: [
      'Docs/ArtRef/ holds the scale, suit, and world sheets.',
      'Docs/StyleLock.md links those pictures.',
    ],
    sortOrder: 50,
  }),
  t({
    code: 'Tether-9.0.2',
    parentCode: 'Tether-9.0',
    shortTitle: 'Shared scuffed metal material',
    state: 'Blocked',
    size: 'Small',
    skill: 'Art',
    staffOnly: false,
    purpose: 'Blocked on 9.0.C. Master material in Content/Tether/Art. Everything else instances it.',
    blockedByCodes: ['Tether-9.0.C'],
    dod: [
      'A master scuffed-metal material exists in Content/Tether/Art.',
      'Other look cards instance that material.',
    ],
    sortOrder: 60,
  }),
  t({
    code: 'Tether-9.0.3',
    parentCode: 'Tether-9.0',
    shortTitle: 'Import path',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Art',
    staffOnly: true,
    purpose: 'FBX or glTF to Content/Tether/Art. Scale already 180 / 200.',
    dod: [
      'Import path lands FBX or glTF in Content/Tether/Art.',
      'Imported scale is already 180 / 200.',
    ],
    sortOrder: 70,
  }),
  t({
    code: 'Tether-9.0.4',
    parentCode: 'Tether-9.0',
    shortTitle: 'Review rule',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Art',
    staffOnly: true,
    purpose: 'Off-sheet work is declined by citing the sheet.',
    dod: ['Off-sheet work is declined by citing the matching sheet.'],
    sortOrder: 80,
  }),

  look({
    code: 'Tether-9.1',
    parentCode: 'Tether-9',
    shortTitle: 'Player',
    state: 'Blocked',
    size: 'Medium',
    purpose: 'Player suit look. One silhouette. Sheet B.',
    sortOrder: 20,
  }),
  ...[
    ['1', 'Suit body', 'Sheet B. Suit body. One Tether crew silhouette.'],
    ['2', 'Helmet', 'Helmet on. Sheet B.'],
    ['3', 'Pack', 'Pack on. Sheet B.'],
    ['4', 'Gloves', 'Gloves. Held size is the scale for weapons.'],
    ['5', 'Boots', 'Boots. Same silhouette.'],
    ['6', 'Dirt pass', 'Same silhouette. Wear only.'],
  ].map(([n, shortTitle, purpose], i) =>
    look({
      code: `Tether-9.1.${n}`,
      parentCode: 'Tether-9.1',
      shortTitle,
      state: 'Blocked',
      size: 'Small',
      purpose,
      dod: [`A production look exists for ${shortTitle}.`],
      sortOrder: (i + 1) * 10,
    })
  ),

  look({
    code: 'Tether-9.2',
    parentCode: 'Tether-9',
    shortTitle: 'Weapons and tools',
    state: 'Blocked',
    size: 'Medium',
    purpose: 'Held size next to the glove.',
    sortOrder: 30,
  }),
  ...[
    ['1', 'Hand Spark', 'Hand Spark held size next to the glove.'],
    ['2', 'Nano-Knife', 'Nano-Knife held size next to the glove.'],
    ['3', 'Beam Enforcer', 'Beam Enforcer held size next to the glove.'],
    ['4', 'Extractor body', 'Extractor body held size next to the glove.'],
    ['5', 'Extractor vacuum stream look', 'Extractor vacuum stream look. Not a pickaxe.'],
    ['6', 'Grapple hook', 'Grapple hook held size next to the glove.'],
    ['7', 'Boost pack housing', 'Boost pack housing. Same silhouette as the pack.'],
    [
      '8',
      'Energy Canon',
      'Later than Spark, knife, Enforcer, Extractor.',
    ],
    ['9', 'Snare gun and cable look', 'Later.'],
  ].map(([n, shortTitle, purpose], i) =>
    look({
      code: `Tether-9.2.${n}`,
      parentCode: 'Tether-9.2',
      shortTitle,
      state: 'Blocked',
      size: 'Small',
      purpose,
      dod: [`A production look exists for ${shortTitle}.`],
      sortOrder: (i + 1) * 10,
    })
  ),

  look({
    code: 'Tether-9.3',
    parentCode: 'Tether-9',
    shortTitle: 'Resources',
    state: 'Blocked',
    size: 'Medium',
    purpose: 'Resource looks. A resource that reads in a gloved hand. Oversized scrap needs two hands.',
    sortOrder: 40,
  }),
  ...[
    ['1', 'Ore vein', 'Readable metal type on the rock.'],
    ['2', 'Crystal cluster', 'Crystal cluster look.'],
    ['3', 'Energy crystal cluster', 'Energy crystal cluster look.'],
    ['4', 'Scrap pile', 'Scrap pile look.'],
    ['5', 'Power cell', 'Power cell. Reads in a gloved hand.'],
    ['6', 'Pack scrap A', 'Pack scrap A. Reads in a gloved hand.'],
    ['7', 'Pack scrap B', 'Pack scrap B. Reads in a gloved hand.'],
    ['8', 'Pack scrap C', 'Pack scrap C. Reads in a gloved hand.'],
    ['9', 'Oversized carry scrap', 'One hero piece. Two hands.'],
    ['10', 'Tether charge pickup', 'Tether charge pickup look.'],
    ['11', 'Ammo pack pickup', 'Ammo pack pickup look.'],
    ['12', 'Shield charge pickup', 'Shield charge pickup look.'],
    ['13', 'Warp pad look', 'Warp pad look. Paint the kit piece. Do not invent a tenth map.'],
    ['14', 'Resource pad look', 'Resource pad look. Paint the kit piece.'],
  ].map(([n, shortTitle, purpose], i) =>
    look({
      code: `Tether-9.3.${n}`,
      parentCode: 'Tether-9.3',
      shortTitle,
      state: 'Blocked',
      size: 'Small',
      purpose,
      dod: [`A production look exists for ${shortTitle}.`],
      sortOrder: (i + 1) * 10,
    })
  ),

  look({
    code: 'Tether-9.4',
    parentCode: 'Tether-9',
    shortTitle: 'World kit look',
    state: 'Blocked',
    size: 'Medium',
    purpose: 'Paint Tether-6.1 families. Do not unique-sculpt a mountain.',
    extra: `${SHEET_WAIT}\n\nTether-6.1 owns graybox shapes. This card paints those pieces.`,
    sortOrder: 50,
  }),
  ...[
    ['1', 'Ground floor tile', 'Paint the Tether-6.1 ground floor tile.'],
    ['2', 'Ground ramp', 'Paint the Tether-6.1 ground ramp. Walkable with the beam on.'],
    ['3', 'Ground ledge', 'Paint the Tether-6.1 ground ledge.'],
    ['4', 'Wrap pillar', 'Paint the Tether-6.1 wrap pillar.'],
    ['5', 'Hang lip', 'Paint the Tether-6.1 hang lip.'],
    ['6', 'Island landing pad', 'Paint the Tether-6.1 island landing pad.'],
    ['7', 'Drift rock', 'Paint the Tether-6.1 drift rock. Do not unique-sculpt a mountain.'],
    ['8', 'Gap marker', 'Paint the Tether-6.1 gap marker.'],
    ['9', 'Space strut', 'Paint the Tether-6.1 space strut.'],
    ['10', 'Space ring', 'Paint the Tether-6.1 space ring.'],
    ['11', 'No-floor room piece', 'Paint the Tether-6.1 no-floor room piece.'],
    ['12', 'Gravity well mouth', 'Paint the Tether-6.1 gravity well mouth.'],
    ['13', 'Enemy marker', 'Paint the Tether-6.1 enemy marker.'],
    ['14', 'Nest crack', 'Paint the Tether-6.1 nest crack.'],
    ['15', 'Habitat wall', 'Sheet C interior. Paint the habitat wall.'],
    ['16', 'Airlock', 'Airlock a suited player can walk through.'],
    ['17', 'Finale station piece', 'Same kit. Later volume for the creature.'],
  ].map(([n, shortTitle, purpose], i) =>
    look({
      code: `Tether-9.4.${n}`,
      parentCode: 'Tether-9.4',
      shortTitle,
      state: 'Blocked',
      size: 'Small',
      purpose,
      dod: [`A production look exists for ${shortTitle}.`],
      extra: `${SHEET_WAIT}\n\nPaint Tether-6.1 families. Do not unique-sculpt a mountain.`,
      sortOrder: (i + 1) * 10,
    })
  ),

  look({
    code: 'Tether-9.5',
    parentCode: 'Tether-9',
    shortTitle: 'Creatures',
    state: 'Blocked',
    size: 'Medium',
    purpose: 'Mesh and material only. Clips are Tether-11.2.',
    extra: `${SHEET_WAIT}\n\nTether-11 owns clips. This epic does not rewrite Tether-11.`,
    sortOrder: 60,
  }),
  ...[
    ['1', 'Snatch mesh', 'Snatch mesh and material. Clips are Tether-11.2.'],
    ['2', 'Latch mesh', 'Latch mesh and material. Clips are Tether-11.2.'],
    ['3', 'Tick mesh', 'Tick mesh and material. Clips are Tether-11.2.'],
    ['4', 'Guard mesh', 'Guard mesh and material. Clips are Tether-11.2.'],
    ['5', 'Spore mesh', 'Spore mesh and material. Clips are Tether-11.2.'],
  ].map(([n, shortTitle, purpose], i) =>
    look({
      code: `Tether-9.5.${n}`,
      parentCode: 'Tether-9.5',
      shortTitle,
      state: 'Blocked',
      size: 'Small',
      purpose,
      dod: [`A production mesh and material exist for ${shortTitle}.`],
      extra: `${SHEET_WAIT}\n\nMesh and material only. Clips are Tether-11.2.`,
      sortOrder: (i + 1) * 10,
    })
  ),
  look({
    code: 'Tether-9.5.6',
    parentCode: 'Tether-9.5',
    shortTitle: 'Finale creature mesh',
    state: 'Staff Only',
    size: 'Small',
    staffOnly: true,
    purpose: 'Later. No mesh until there is a brief.',
    dod: ['Finale creature mesh waits for a brief.'],
    extra: `${SHEET_WAIT}\n\nLater. Mesh and material only. Clips are Tether-11.2.`,
    sortOrder: 60,
  }),

  look({
    code: 'Tether-9.6',
    parentCode: 'Tether-9',
    shortTitle: 'Colony faces',
    state: 'Blocked',
    size: 'Medium',
    purpose: 'Colony faces. Not a walkable town.',
    sortOrder: 70,
  }),
  look({
    code: 'Tether-9.6.1',
    parentCode: 'Tether-9.6',
    shortTitle: 'Comms NPC bust',
    state: 'Blocked',
    size: 'Small',
    purpose: 'One character for the quota briefing.',
    dod: ['A comms NPC bust exists for the quota briefing.'],
    sortOrder: 10,
  }),
  look({
    code: 'Tether-9.6.2',
    parentCode: 'Tether-9.6',
    shortTitle: 'Distant colony building tile',
    state: 'Blocked',
    size: 'Small',
    purpose: 'Backdrop. Not a walkable town.',
    dod: ['A distant colony building tile exists as a backdrop.'],
    sortOrder: 20,
  }),

  look({
    code: 'Tether-9.7',
    parentCode: 'Tether-9',
    shortTitle: 'HUD and menus',
    state: 'Blocked',
    size: 'Medium',
    purpose: 'Art only. Layout is Tether-8.',
    extra: `${SHEET_WAIT}\n\nArt only. Layout is Tether-8. This epic does not rewrite Tether-8.`,
    sortOrder: 80,
  }),
  ...[
    ['1', 'Health bar frame', 'Health bar frame art. Layout is Tether-8.'],
    ['2', 'Shield bar frame', 'Shield bar frame art. Layout is Tether-8.'],
    ['3', 'Power clock ring art', 'Power clock ring art. Layout is Tether-8.'],
    ['4', 'Quota and extract tick type', 'Quota and extract tick type. Layout is Tether-8.'],
    ['5', 'Main menu frame', 'Main menu frame art. Layout is Tether-8.'],
    ['6', 'Play Host Join frames', 'Play, Host, Join frames. Layout is Tether-8.'],
    ['7', 'Pause and Settings frames', 'Pause and Settings frames. Layout is Tether-8.'],
    ['8', 'Warp stats and Gear Up tabs', 'Warp stats and Gear Up tab art. Layout is Tether-8.'],
    ['9', 'Fail and success frames', 'Fail and success frame art. Layout is Tether-8.'],
    ['10', 'Join the Forge button', 'Join the Forge button art. Layout is Tether-8.'],
  ].map(([n, shortTitle, purpose], i) =>
    look({
      code: `Tether-9.7.${n}`,
      parentCode: 'Tether-9.7',
      shortTitle,
      state: 'Blocked',
      size: 'Small',
      purpose,
      dod: [`Art exists for ${shortTitle}. Layout stays on Tether-8.`],
      extra: `${SHEET_WAIT}\n\nArt only. Layout is Tether-8.`,
      sortOrder: (i + 1) * 10,
    })
  ),

  look({
    code: 'Tether-9.8',
    parentCode: 'Tether-9',
    shortTitle: 'Beam and hits',
    state: 'Blocked',
    size: 'Medium',
    purpose: 'Beam and hit looks. Beam carries the energy color.',
    extra: `${SHEET_WAIT}\n\n${LOOK}`,
    sortOrder: 90,
  }),
  ...[
    ['1', 'Beam quiet look', 'Beam quiet look. Beam carries the energy color.'],
    ['2', 'Beam loud look', 'Beam loud look. Beam carries the energy color.'],
    ['3', 'Lock look', 'Tether Lock look.'],
    ['4', 'Snap look', 'Tether snap look.'],
    ['5', 'Hit spark', 'Hit spark look.'],
    ['6', 'Damage pop frame', 'Damage pop frame art.'],
    ['7', 'Nanite inside-target cue', 'Nanite inside-target cue look.'],
    ['8', 'Shield chew cue', 'Shield chew cue look. Shield damage also hits the beam.'],
  ].map(([n, shortTitle, purpose], i) =>
    look({
      code: `Tether-9.8.${n}`,
      parentCode: 'Tether-9.8',
      shortTitle,
      state: 'Blocked',
      size: 'Small',
      purpose,
      dod: [`A production look exists for ${shortTitle}.`],
      sortOrder: (i + 1) * 10,
    })
  ),
];

export function tetherV025Title(task) {
  return `${task.code} ${task.shortTitle}`;
}

export function tetherV025Difficulty(size) {
  if (size === 'Small') return 'Easy';
  return 'Medium';
}

export function tetherV025StaffOnly(task) {
  if (typeof task?.staffOnly === 'boolean') return task.staffOnly;
  return task?.state === 'Staff Only';
}

export function buildTetherV025Description(task) {
  const lines = [];
  if (task.purpose) lines.push(task.purpose);
  if (task.output) {
    lines.push('', `Output: ${task.output}`);
  }
  if (Array.isArray(task.dod) && task.dod.length) {
    lines.push('', 'Definition of Done:');
    for (const item of task.dod) lines.push(`- ${item}`);
  }
  if (task.extra) {
    lines.push('', task.extra);
  }
  return lines.join('\n').trim();
}

export function tetherV025Subtasks(task) {
  if (!Array.isArray(task.dod) || !task.dod.length) return [];
  return task.dod.map((label, i) => ({
    id: `s${i + 1}`,
    label,
    done: false,
  }));
}

export function tetherV025Depth(task) {
  if (!task.parentCode) return 0;
  const parent = TETHER_V025_TASKS.find((x) => x.code === task.parentCode);
  if (!parent || !parent.parentCode) return 1;
  return 2;
}

export function tetherV025Blockers(task) {
  return task.blockedByCodes || (task.blockedByCode ? [task.blockedByCode] : []);
}

export function isTetherV025LookCard(task) {
  return /^Tether-9\.[1-8]([.]|$)/.test(task.code);
}
