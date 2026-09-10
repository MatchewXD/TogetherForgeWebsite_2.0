/**
 * Tether-4 Raw materials, collectables, quota from Tether_Task_Breakdown_v0.18.
 * Staging-board import source. Upsert by title / ID prefix.
 * Do not publish. Do not rewrite Tether-5, Tether-6, or Tether-7.
 * Do not rewrite Tether-4.1.1, 4.1.2, 4.1.3, 4.2.1, 4.2.2, 4.2.3.
 *
 * Board max is Epic → Medium → Small. Extractor steps (4.3.0.1, …)
 * are Definition of Done on Tether-4.3.0, not a fourth nesting level.
 */

export const TETHER_V018_VERSION = 'v0.18';
export const TETHER_V018_PROJECT_SLUG = 'tether';
export const TETHER_V018_SOURCE = 'Tether_Task_Breakdown_v0.18';

export const TETHER_V018_KEEP_CODES = [
  'Tether-4.1.1',
  'Tether-4.1.2',
  'Tether-4.1.3',
  'Tether-4.2.1',
  'Tether-4.2.2',
  'Tether-4.2.3',
];

export const TETHER_V018_TITLE_RE = /^Tether-4([. ]|$)/;

export function isTetherV018Title(title) {
  return TETHER_V018_TITLE_RE.test(String(title || '').trim());
}

export function isTetherV018KeepTitle(title) {
  const head = String(title || '').trim();
  return TETHER_V018_KEEP_CODES.some(
    (code) => head === code || (head.startsWith(`${code} `) && !head.startsWith(`${code}.`))
  );
}

const COLONY_LORE =
  'The antimatter generator was damaged in the debris of the destroyed space station. A temporary generator is keeping the colony alive. It does not make enough power for the shields. Power cells feed the generator. Scrap repairs the metal walls around the buildings. Those walls are the only shield against the planet. No scrap, walls fail, buildings collapse, colony dies. Raw materials do not keep the colony alive. They buy weapons, tools, and upgrades. That is progress. Extra collectables convert to raw at warp. Each map has a colony power clock. Zero means the run is lost. Each map has a quota of power cells and scrap.';

function t(partial) {
  return partial;
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
 *  sortOrder: number,
 * }>} */
export const TETHER_V018_TASKS = [
  t({
    code: 'Tether-4',
    parentCode: null,
    shortTitle: 'Resources and warp',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    staffOnly: true,
    purpose: COLONY_LORE,
    extra: `Source: ${TETHER_V018_SOURCE}. Staging only. Do not publish. Pickup and warp Smalls 4.1.1–4.1.3 and 4.2.1–4.2.3 stay as written.`,
    sortOrder: 40,
  }),

  t({
    code: 'Tether-4.3',
    parentCode: 'Tether-4',
    shortTitle: 'Raw materials',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    staffOnly: false,
    purpose:
      'Stackable raw from world nodes. Cap Open. First metals: iron, copper, tin, gold, platinum. Crystal and energy crystal are raw types beside the metals. Glass is a candidate, not locked. Raw comes from ore veins, crystal clusters, and scrap piles. Raw is progress only. It buys weapons, tools, and upgrades. It does not keep the colony alive.',
    extra: COLONY_LORE,
    sortOrder: 30,
  }),
  t({
    code: 'Tether-4.3.0',
    parentCode: 'Tether-4.3',
    shortTitle: 'Extractor',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Default harvest tool. Also list it under Tether-7 tools when that epic is next edited. Harvest rules live here. No pickaxe. No drill. The player pulls a tool that melts only the metal in that vein, then an anti-gravity stream vacuums the molten metal into a containment cell that keeps it liquid. That cell is the stack.',
    output: 'Extractor harvest tool. Melt plus vacuum, not a pickaxe.',
    dod: [
      'Tether-4.3.0.1 Extractor body and hold-to-harvest exist.',
      'Tether-4.3.0.2 Melt only the target metal. Other rock stays.',
      'Tether-4.3.0.3 Anti-gravity vacuum into liquid containment.',
      'Tether-4.3.0.4 Harvest read: glow of the specific metal. Stream you can see.',
    ],
    sortOrder: 5,
  }),
  t({
    code: 'Tether-4.3.1',
    parentCode: 'Tether-4.3',
    shortTitle: 'Docs/Resources.md',
    state: 'Ready',
    size: 'Small',
    skill: 'Writing',
    staffOnly: false,
    purpose: 'Groups, metals, nodes, quota, clock, converter. Link from README.',
    output: 'Docs/Resources.md in the Tether repo, linked from README.',
    dod: [
      'Docs/Resources.md exists with groups, metals, nodes, quota, clock, and converter.',
      'README links Docs/Resources.md.',
    ],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-4.3.2',
    parentCode: 'Tether-4.3',
    shortTitle: 'Raw stack',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Liquid containment per metal. Cap Open.',
    dod: [
      'Raw stacks as liquid containment per metal.',
      'Cap stays Open.',
    ],
    sortOrder: 20,
  }),
  t({
    code: 'Tether-4.3.3',
    parentCode: 'Tether-4.3',
    shortTitle: 'Ore vein',
    state: 'Ready',
    size: 'Small',
    skill: 'Level Design',
    staffOnly: false,
    purpose: 'Node with a set metal type. Harvest with the Extractor.',
    output: 'Graybox ore vein node.',
    dod: [
      'An ore vein has a set metal type.',
      'The vein is harvested with the Extractor.',
    ],
    sortOrder: 30,
  }),
  t({
    code: 'Tether-4.3.4',
    parentCode: 'Tether-4.3',
    shortTitle: 'Crystal cluster',
    state: 'Ready',
    size: 'Small',
    skill: 'Level Design',
    staffOnly: false,
    purpose: 'Gives crystal or energy crystal. Harvest with the Extractor.',
    output: 'Graybox crystal cluster.',
    dod: [
      'A crystal cluster gives crystal or energy crystal.',
      'The cluster is harvested with the Extractor.',
    ],
    sortOrder: 40,
  }),
  t({
    code: 'Tether-4.3.5',
    parentCode: 'Tether-4.3',
    shortTitle: 'Scrap pile',
    state: 'Ready',
    size: 'Small',
    skill: 'Level Design',
    staffOnly: false,
    purpose: 'Breaks down into raw.',
    output: 'Graybox scrap pile.',
    dod: ['A scrap pile breaks down into raw.'],
    sortOrder: 50,
  }),
  t({
    code: 'Tether-4.3.6',
    parentCode: 'Tether-4.3',
    shortTitle: 'First metals',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Iron, copper, tin, gold, platinum as data on veins.',
    dod: ['Veins can be iron, copper, tin, gold, or platinum.'],
    sortOrder: 60,
  }),
  t({
    code: 'Tether-4.3.7',
    parentCode: 'Tether-4.3',
    shortTitle: 'Crystal and energy crystal',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'From clusters.',
    dod: ['Clusters grant crystal or energy crystal.'],
    sortOrder: 70,
  }),
  t({
    code: 'Tether-4.3.8',
    parentCode: 'Tether-4.3',
    shortTitle: 'Mix on the six-node test map',
    state: 'Ready',
    size: 'Small',
    skill: 'Level Design',
    staffOnly: false,
    purpose:
      'Veins, clusters, and piles together. Do not replace 4.1.3. Extend that map.',
    dod: [
      'The Epic 4 six-node test map also has veins, clusters, and piles.',
      'Tether-4.1.3 is not replaced.',
    ],
    sortOrder: 80,
  }),
  t({
    code: 'Tether-4.3.9',
    parentCode: 'Tether-4.3',
    shortTitle: 'Converter',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Later. Bench that trades metals by value. Shape: if gold is worth 100 copper, 100 copper become 1 gold, or 1 gold becomes 100 copper. Exact rates Open. Do not invent rates on this card.',
    dod: [
      'Converter shape is metal-by-value trade.',
      'Exact rates stay Open. This card does not invent rates.',
    ],
    sortOrder: 90,
  }),

  t({
    code: 'Tether-4.4',
    parentCode: 'Tether-4',
    shortTitle: 'Collectables',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    staffOnly: false,
    purpose:
      'Power cells and scrap keep the colony alive. Higher value scrap takes more pack space. Too big to pack is hands-only carry under Tether-4.1.2.',
    extra: COLONY_LORE,
    sortOrder: 40,
  }),
  t({
    code: 'Tether-4.4.1',
    parentCode: 'Tether-4.4',
    shortTitle: 'Collectable data',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Name, value, pack size, carry-only flag.',
    dod: ['Each collectable has a name, value, pack size, and carry-only flag.'],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-4.4.2',
    parentCode: 'Tether-4.4',
    shortTitle: 'Power cell',
    state: 'Ready',
    size: 'Small',
    skill: 'Level Design',
    staffOnly: false,
    purpose: 'Credits the power quota. Feeds the temporary generator.',
    output: 'Graybox power cell.',
    dod: [
      'A power cell credits the power quota.',
      'It feeds the temporary generator.',
    ],
    sortOrder: 20,
  }),
  t({
    code: 'Tether-4.4.3',
    parentCode: 'Tether-4.4',
    shortTitle: 'Scrap catalog',
    state: 'Ready',
    size: 'Small',
    skill: 'Design',
    staffOnly: false,
    purpose:
      'Short first list plus one oversized carry piece. More scraps wait on an Open Question. Do not invent a huge scrap list on this card.',
    dod: [
      'A short first scrap list exists plus one oversized carry piece.',
      'This card does not invent a huge scrap list.',
    ],
    sortOrder: 30,
  }),
  t({
    code: 'Tether-4.4.4',
    parentCode: 'Tether-4.4',
    shortTitle: 'Extra collectables convert to raw',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Happens at warp after quota is filled.',
    dod: ['Extra collectables convert to raw at warp after quota is filled.'],
    sortOrder: 40,
  }),

  t({
    code: 'Tether-4.5',
    parentCode: 'Tether-4',
    shortTitle: 'Consumables',
    state: 'Ready',
    size: 'Medium',
    skill: 'Code',
    staffOnly: false,
    purpose: 'Used on the map.',
    sortOrder: 50,
  }),
  t({
    code: 'Tether-4.5.1',
    parentCode: 'Tether-4.5',
    shortTitle: 'Tether charge',
    state: 'Ready',
    size: 'Small',
    skill: 'Level Design',
    staffOnly: false,
    purpose: 'Refills beam health.',
    dod: ['A tether charge refills beam health.'],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-4.5.2',
    parentCode: 'Tether-4.5',
    shortTitle: 'Ammo pack',
    state: 'Ready',
    size: 'Small',
    skill: 'Level Design',
    staffOnly: false,
    purpose: 'Refills Energy Canon and later guns.',
    dod: ['An ammo pack refills Energy Canon and later guns.'],
    sortOrder: 20,
  }),
  t({
    code: 'Tether-4.5.3',
    parentCode: 'Tether-4.5',
    shortTitle: 'Shield charge',
    state: 'Ready',
    size: 'Small',
    skill: 'Level Design',
    staffOnly: false,
    purpose: 'Refills crew shields.',
    dod: ['A shield charge refills crew shields.'],
    sortOrder: 30,
  }),

  t({
    code: 'Tether-4.6',
    parentCode: 'Tether-4',
    shortTitle: 'Quota, clock, warp',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Does not replace 4.2. Adds fail and quota on top of warp.',
    sortOrder: 60,
  }),
  t({
    code: 'Tether-4.6.1',
    parentCode: 'Tether-4.6',
    shortTitle: 'Map quota',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Power cells and scrap the colony needs this run. Visible before the crew leaves the airlock.',
    dod: [
      'A run has a quota of power cells and scrap.',
      'The quota is visible before the crew leaves the airlock.',
    ],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-4.6.2',
    parentCode: 'Tether-4.6',
    shortTitle: 'Colony power clock',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Readable. Fail the run at zero. Numbers Open.',
    dod: [
      'A readable colony power clock exists.',
      'The run fails at zero. Numbers stay Open.',
    ],
    sortOrder: 20,
  }),
  t({
    code: 'Tether-4.6.3',
    parentCode: 'Tether-4.6',
    shortTitle: 'Warp order',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Fill quota, convert extra collectables to raw, bank raw for Tether-7.',
    dod: [
      'Warp fills quota, then converts extra collectables to raw, then banks raw for Tether-7.',
    ],
    sortOrder: 30,
  }),
  t({
    code: 'Tether-4.6.4',
    parentCode: 'Tether-4.6',
    shortTitle: 'Guard value',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Guard still picks the highest-value object in range. Value lives on collectables and on energy crystals. Do not reopen Tether-5.4.',
    dod: [
      'Guard value lives on collectables and on energy crystals.',
      'Tether-5.4 is not reopened.',
    ],
    sortOrder: 40,
  }),
];

export function tetherV018Title(task) {
  return `${task.code} ${task.shortTitle}`;
}

export function tetherV018Difficulty(size) {
  if (size === 'Small') return 'Easy';
  return 'Medium';
}

export function tetherV018StaffOnly(task) {
  if (typeof task?.staffOnly === 'boolean') return task.staffOnly;
  return task?.state === 'Staff Only';
}

export function buildTetherV018Description(task) {
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

export function tetherV018Subtasks(task) {
  if (!Array.isArray(task.dod) || !task.dod.length) return [];
  return task.dod.map((label, i) => ({
    id: `s${i + 1}`,
    label,
    done: false,
  }));
}

export function tetherV018Depth(task) {
  if (!task.parentCode) return 0;
  const parent = TETHER_V018_TASKS.find((x) => x.code === task.parentCode);
  if (!parent || !parent.parentCode) return 1;
  return 2;
}
