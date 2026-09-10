/**
 * Tether-7 Stats, weapons, tools from Tether_Task_Breakdown_v0.15
 * plus the v0.16 weapon addendum.
 * Staging-board import source. Upsert by title / ID prefix.
 * Do not publish. Do not rewrite Tether-4.1, Tether-4.2, Tether-5, or Tether-6.
 * Do not nest Tether-7 under Tether-5 or Tether-6. Do not put weapons under Tether-11.
 *
 * Board max is Epic → Medium → Small. Weapon/tool family steps (7.2.1.1, …)
 * are Definition of Done on the family card, not a fourth nesting level.
 */

export const TETHER_V015_VERSION = 'v0.15';
export const TETHER_V015_PROJECT_SLUG = 'tether';
export const TETHER_V015_SOURCE =
  'Tether_Task_Breakdown_v0.15 plus v0.16 weapon addendum';

export const TETHER_V015_TITLE_RE = /^Tether-(7|11)([. ]|$)/;

export function isTetherV015Title(title) {
  return TETHER_V015_TITLE_RE.test(String(title || '').trim());
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
export const TETHER_V015_TASKS = [
  t({
    code: 'Tether-7',
    parentCode: null,
    shortTitle: 'Stats, weapons, tools',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Player loadout and upgrades. Default weapons live here so Epic 5 has something to hit. Crew shields are a pawn field Tick and Spore use. Numbers wait on playtest and live in Docs/Tools.md.',
    extra: `Source: ${TETHER_V015_SOURCE}. Staging only. Do not publish.`,
    sortOrder: 70,
  }),

  t({
    code: 'Tether-7.1',
    parentCode: 'Tether-7',
    shortTitle: 'Stat upgrades',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'First slice: tether health, tether length, shield durability, repair strength, carry. Other stats wait on the Open Question.',
    sortOrder: 10,
  }),
  t({
    code: 'Tether-7.1.1',
    parentCode: 'Tether-7.1',
    shortTitle: 'Upgrade row data',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Name, what it changes, first cost. Numbers Open.',
    dod: [
      'Each first-slice upgrade has a name, what it changes, and a first cost.',
      'Numbers stay Open until playtest.',
    ],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-7.1.2',
    parentCode: 'Tether-7.1',
    shortTitle: 'Tether health upgrade',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Upgrade that raises tether health.',
    dod: ['Tether health can be upgraded from the first-slice row data.'],
    sortOrder: 20,
  }),
  t({
    code: 'Tether-7.1.3',
    parentCode: 'Tether-7.1',
    shortTitle: 'Tether length upgrade',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Upgrade that raises tether length.',
    dod: ['Tether length can be upgraded from the first-slice row data.'],
    sortOrder: 30,
  }),
  t({
    code: 'Tether-7.1.4',
    parentCode: 'Tether-7.1',
    shortTitle: 'Shield durability upgrade',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Upgrade that raises shield durability. Crew shields (7.3.5) spend this field.',
    dod: ['Shield durability can be upgraded from the first-slice row data.'],
    sortOrder: 40,
  }),
  t({
    code: 'Tether-7.1.5',
    parentCode: 'Tether-7.1',
    shortTitle: 'Repair strength upgrade',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Upgrade that raises repair strength.',
    dod: ['Repair strength can be upgraded from the first-slice row data.'],
    sortOrder: 50,
  }),
  t({
    code: 'Tether-7.1.6',
    parentCode: 'Tether-7.1',
    shortTitle: 'Carry upgrade',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Upgrade that raises carry.',
    dod: ['Carry can be upgraded from the first-slice row data.'],
    sortOrder: 60,
  }),
  t({
    code: 'Tether-7.1.7',
    parentCode: 'Tether-7.1',
    shortTitle: 'Spend currency',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Design',
    staffOnly: true,
    purpose:
      'Open until Matthew picks colony total, a separate chip, or something else.',
    dod: [
      'Matthew picks colony total, a separate chip, or something else.',
      'The pick is written in Docs/Tools.md.',
    ],
    sortOrder: 70,
  }),

  t({
    code: 'Tether-7.2',
    parentCode: 'Tether-7',
    shortTitle: 'Weapons',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Talk about power as time to kill a 1000 health body, one player, no extra tricks. First slice: Hand Spark, Nano-Knife, Beam Enforcer. Energy Canon and Snare are on the board after those three. Jetpack is a tool, not a gun.',
    sortOrder: 20,
  }),
  t({
    code: 'Tether-7.2.1',
    parentCode: 'Tether-7.2',
    shortTitle: 'Hand Spark',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Default pistol. Slow shot. Each hit adds a short slow that fades on its own clock. If four slows are on the target at the same time, those four burn off and the creature stuns. One gun can build the four. Four guns can land them in one volley. Durations wait on playtest. Solo TTK target about 30 seconds on 1000 health.',
    output: 'Hand Spark default pistol.',
    dod: [
      'Tether-7.2.1.1 Spark projectile and fire rate exist.',
      'Tether-7.2.1.2 Slow stacks: separate timers. Four live stacks consume into a stun.',
      'Tether-7.2.1.3 Spark stun read: placeholder cue and readable stun.',
      'Tether-7.2.1.4 Spark TTK check: about 30 seconds on 1000 health. Playtest overwrites.',
    ],
    extra: 'Moved from Tether-11.1 if that card existed. Not under Tether-11.',
    sortOrder: 10,
  }),
  t({
    code: 'Tether-7.2.2',
    parentCode: 'Tether-7.2',
    shortTitle: 'Nano-Knife',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Melee. The blade seeds nanites that attack the creature from the inside. The DoT is that swarm eating. Each cut adds a tiny DoT stack and refreshes every stack already on the target. More cutters, more stacks. Spark stun is the dump window. Tick rate, stack cap, and duration wait on playtest.',
    output: 'Nano-Knife melee.',
    dod: [
      'Tether-7.2.2.1 Melee hit lands.',
      'Tether-7.2.2.2 DoT stacks and refresh: each cut adds a stack and refreshes stacks already on the target.',
      'Tether-7.2.2.3 Crew dump on stun: Spark stun is the dump window.',
      'Tether-7.2.2.4 Nanite read: inside-the-body cue while stacks last. Inner glow or crawl.',
    ],
    sortOrder: 20,
  }),
  t({
    code: 'Tether-7.2.3',
    parentCode: 'Tether-7.2',
    shortTitle: 'Beam Enforcer',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Hold a beam on the target. Weak alone. Each extra beam on the same target raises damage a lot. One babysits. The rest can do something else. Starting extra-beam curve 1, 3, 9, 27 per tick. Playtest overwrites.',
    output: 'Beam Enforcer hold-beam.',
    dod: [
      'Tether-7.2.3.1 Hold beam: damage while the beam is on the target.',
      'Tether-7.2.3.2 Extra-beam multiplier: starting curve 1, 3, 9, 27 per tick. Playtest overwrites.',
      'Tether-7.2.3.3 Shared-target read: readable who is beaming the same target.',
    ],
    sortOrder: 30,
  }),
  blocked({
    code: 'Tether-7.2.4',
    parentCode: 'Tether-7.2',
    shortTitle: 'Energy Canon',
    state: 'Blocked',
    size: 'Medium',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Later than 7.2.1-7.2.3. Heavy charged shot. Limited ammo. Charge from the tether. Refill at a warp. Slow reload. One shot hits hard. Release early for medium contact and low AOE. Detonate mid-air on a second press. While charging, other players can hold the Canon. Each helper raises charge speed, projectile speed, AOE, and damage. Cap at three helpers so all four can be on one gun.',
    blockedByCodes: ['Tether-7.2.1', 'Tether-7.2.2', 'Tether-7.2.3'],
    output: 'Energy Canon heavy charged shot.',
    dod: [
      'Tether-7.2.4.1 Canon body, fire, and reload exist.',
      'Tether-7.2.4.2 Tether charge and warp refill: ammo count, charge from the tether, refill at warp.',
      'Tether-7.2.4.3 Charge tiers: early release vs held charge.',
      'Tether-7.2.4.4 Mid-air detonate on a second press.',
      'Tether-7.2.4.5 Helper interact: up to three extra players. Each adds charge speed, projectile speed, AOE, damage.',
      'Tether-7.2.4.6 Canon charge read: readable charge and who is helping.',
    ],
    sortOrder: 40,
  }),
  blocked({
    code: 'Tether-7.2.5',
    parentCode: 'Tether-7.2',
    shortTitle: 'Snare',
    state: 'Blocked',
    size: 'Medium',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Later than 7.2.1-7.2.3. Almost no damage. Pins the target to the ground at the shooter\'s spot with a cable. One cable holds for a short time. More cables share the chew, so they last longer. Small creatures break out slow. Large creatures break out fast. A massive creature breaks a basic cable immediately. High Snare upgrades can change that.',
    blockedByCodes: ['Tether-7.2.1', 'Tether-7.2.2', 'Tether-7.2.3'],
    output: 'Snare pin cable.',
    dod: [
      'Tether-7.2.5.1 Snare projectile and cable to the shooter\'s ground point.',
      'Tether-7.2.5.2 Cable health: chew while the target pulls.',
      'Tether-7.2.5.3 Extra cables split chew.',
      'Tether-7.2.5.4 Size modifier: break speed by creature size.',
      'Tether-7.2.5.5 Snare cable read exists.',
    ],
    sortOrder: 50,
  }),

  t({
    code: 'Tether-7.3',
    parentCode: 'Tether-7',
    shortTitle: 'Tools',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'First slice: Rescue Pull and Tether Lock. Section unlocks: Grapple for Section 2, Boost pack for Section 3. Jetpack is Later.',
    sortOrder: 30,
  }),
  t({
    code: 'Tether-7.3.1',
    parentCode: 'Tether-7.3',
    shortTitle: 'Rescue Pull',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'A hanging or stuck partner can be reeled in. Crew interacts with the beam. More people on the pull makes it faster.',
    dod: [
      'Tether-7.3.1.1 Pull interact: interact on the beam while a partner is hanging or adrift.',
      'Tether-7.3.1.2 Pull scales with hands.',
    ],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-7.3.2',
    parentCode: 'Tether-7.3',
    shortTitle: 'Tether Lock',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'A falling player can lock the line and stop the fall. The lock stays until that player touches ground. Nobody else can unlock it.',
    dod: [
      'Tether-7.3.2.1 Lock input: lock while falling.',
      'Tether-7.3.2.2 Hold until grounded: hold at current length until the locker is grounded.',
      'Tether-7.3.2.3 Locked beam read exists.',
    ],
    sortOrder: 20,
  }),
  t({
    code: 'Tether-7.3.3',
    parentCode: 'Tether-7.3',
    shortTitle: 'Grapple hook',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Section 2 unlock. Reach places walking cannot. Beam rules still apply. Section 2 map playtests wait on a usable hook.',
    extra: 'Moved from Tether-11.4 if that card existed. Not under Tether-11.',
    dod: ['A usable grapple hook exists. Beam rules still apply while hooked.'],
    sortOrder: 30,
  }),
  t({
    code: 'Tether-7.3.4',
    parentCode: 'Tether-7.3',
    shortTitle: 'Boost pack',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Section 3 unstuck assist. Short weak shove while not touching a surface. Cannot finish a space map alone. A stuck player still needs a teammate on a surface or on the line.',
    extra: 'Moved from Tether-11.5 if that card existed. Not under Tether-11.',
    dod: [
      'Boost pack is a short weak shove while not touching a surface.',
      'A solo player cannot finish a space map with the pack alone.',
    ],
    sortOrder: 40,
  }),
  t({
    code: 'Tether-7.3.5',
    parentCode: 'Tether-7.3',
    shortTitle: 'Crew shields field',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Tick and Spore spend this. Stand-in number allowed until 7.1.4 exists.',
    extra: 'Moved from Tether-11.2 if that card existed. Not under Tether-11.',
    dod: [
      'A crew shields pawn field exists.',
      'Tick and Spore can spend it. A stand-in number is allowed until Tether-7.1.4 exists.',
    ],
    sortOrder: 50,
  }),
  t({
    code: 'Tether-7.3.6',
    parentCode: 'Tether-7.3',
    shortTitle: 'Jetpack',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Later. Lethal Company shape: hard to fly, easy to rip the line if you punch it, fuel or weight so it cannot skip a map. Do not add extra smalls this pass.',
    dod: ['Jetpack stays a Later note. No extra smalls this pass.'],
    sortOrder: 60,
  }),

  t({
    code: 'Tether-7.4',
    parentCode: 'Tether-7',
    shortTitle: 'Docs and Open Question',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Writing',
    staffOnly: true,
    purpose: 'Docs/Tools.md and the upgrade Open Question.',
    sortOrder: 40,
  }),
  t({
    code: 'Tether-7.4.1',
    parentCode: 'Tether-7.4',
    shortTitle: 'Docs/Tools.md',
    state: 'Ready',
    size: 'Small',
    skill: 'Writing',
    staffOnly: false,
    purpose:
      'Spark, knife, enforcer, Canon, Snare, pull, lock, grapple, pack. Numbers live here.',
    output: 'Docs/Tools.md in the Tether repo.',
    dod: [
      'Docs/Tools.md exists with Spark, knife, enforcer, Canon, Snare, pull, lock, grapple, and pack.',
      'Numbers for those tools live in Docs/Tools.md.',
    ],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-7.4.2',
    parentCode: 'Tether-7.4',
    shortTitle: 'Upgrade Open Question',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Community',
    staffOnly: true,
    purpose:
      'Extra stats after the first five. Extra weapons after these five. Extra tools after pull, lock, grapple, pack. Extra resource types wait for the Tether-4.3 catalog pass. Do not post this until Matthew writes the form copy.',
    dod: [
      'Matthew writes the form copy before this question is posted.',
      'The question covers extra stats, weapons, and tools. Extra resource types wait for Tether-4.3.',
    ],
    sortOrder: 20,
  }),

  t({
    code: 'Tether-11',
    parentCode: null,
    shortTitle: 'UI',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Later. Tension read, carry count, tool status, upgrade screen, simple menus. No weapon children.',
    extra:
      'Empty of weapons. Hand Spark, Grapple, Boost pack, and crew shields live under Tether-7.',
    sortOrder: 110,
  }),
];

export function tetherV015Title(task) {
  return `${task.code} ${task.shortTitle}`;
}

export function tetherV015Difficulty(size) {
  if (size === 'Small') return 'Easy';
  return 'Medium';
}

export function tetherV015StaffOnly(task) {
  if (typeof task?.staffOnly === 'boolean') return task.staffOnly;
  return task?.state === 'Staff Only';
}

export function buildTetherV015Description(task) {
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

export function tetherV015Subtasks(task) {
  if (!Array.isArray(task.dod) || !task.dod.length) return [];
  return task.dod.map((label, i) => ({
    id: `s${i + 1}`,
    label,
    done: false,
  }));
}

export function tetherV015Depth(task) {
  if (!task.parentCode) return 0;
  const parent = TETHER_V015_TASKS.find((x) => x.code === task.parentCode);
  if (!parent || !parent.parentCode) return 1;
  return 2;
}
