/**
 * Tether-8 UI and Tether-11 Model rigging and animation
 * from Tether_Task_Breakdown_v0.21 plus v0.22.
 * Staging-board import source. Upsert by title / ID prefix.
 * Do not publish. Do not rewrite Tether-4, Tether-5, Tether-6, or Tether-7.
 * Tether-10 is done. Do not Block any Tether-8 card on Tether-10.
 */

export const TETHER_V021_VERSION = 'v0.21';
export const TETHER_V021_PROJECT_SLUG = 'tether';
export const TETHER_V021_SOURCE = 'Tether_Task_Breakdown_v0.21 plus v0.22';

export const TETHER_V021_TITLE_RE = /^Tether-(8|11)([. ]|$)/;

export function isTetherV021Title(title) {
  return TETHER_V021_TITLE_RE.test(String(title || '').trim());
}

const SHIELD_RULE =
  'The tether feeds O2 and shields. Player health and shield are two bars with no numbers. If your tether snaps, your shield empties immediately. People still on a live tether keep theirs. Shield damage also hits the tether. A fall that bites the shield bites beam health too. Amount is playtest. Write both rules into Docs/TetherRules.txt when 8.1.2 ships.';

const ANIM_BAR =
  'Basic and quick. Readable loop. Faces the right way. Does not slide forever. No second idle. No hero cinematic. Perfect is out of scope.';

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
export const TETHER_V021_TASKS = [
  t({
    code: 'Tether-8',
    parentCode: null,
    shortTitle: 'UI',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Every player-facing screen and HUD read. Tension is the beam mesh, not a HUD meter.',
    extra: `${SHIELD_RULE}\n\nSource: ${TETHER_V021_SOURCE}. Staging only. Do not publish. Tether-10 is done. Do not Block this epic on Tether-10.`,
    sortOrder: 80,
  }),

  t({
    code: 'Tether-8.1',
    parentCode: 'Tether-8',
    shortTitle: 'HUD',
    state: 'Ready',
    size: 'Medium',
    skill: 'Code',
    staffOnly: false,
    purpose: 'Graybox HUD widgets. Tension stays on the beam mesh.',
    sortOrder: 10,
  }),
  t({
    code: 'Tether-8.1.1',
    parentCode: 'Tether-8.1',
    shortTitle: 'Player health bar',
    state: 'Ready',
    size: 'Small',
    skill: 'Code',
    staffOnly: false,
    purpose: 'A bar. No numbers on the bar.',
    dod: ['A player health bar exists. It has no numbers.'],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-8.1.2',
    parentCode: 'Tether-8.1',
    shortTitle: 'Shield bar',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Separate bar. Empties immediately when that pawn\'s tether snaps. Refills only while tethered. Shield damage also damages the beam. No numbers on the bar. Write the snap and shared-damage rules into Docs/TetherRules.txt.',
    extra: SHIELD_RULE,
    dod: [
      'A separate shield bar exists with no numbers.',
      'If that pawn\'s tether snaps, the shield empties immediately.',
      'Shield damage also damages the beam.',
      'Snap-dump and shared-damage rules are written in Docs/TetherRules.txt.',
    ],
    sortOrder: 20,
  }),
  t({
    code: 'Tether-8.1.3',
    parentCode: 'Tether-8.1',
    shortTitle: 'Damage pop',
    state: 'Ready',
    size: 'Small',
    skill: 'Code',
    staffOnly: false,
    purpose: 'When a creature or a pawn takes a hit, the amount pops and fades.',
    dod: ['Hit amount pops and fades on creature and pawn hits.'],
    sortOrder: 30,
  }),
  t({
    code: 'Tether-8.1.4',
    parentCode: 'Tether-8.1',
    shortTitle: 'Extract tick',
    state: 'Ready',
    size: 'Small',
    skill: 'Code',
    staffOnly: false,
    purpose:
      'While the Extractor is on a vein, a climbing line shows the metal and the count. +1 Gold, then +12 Gold, +13 Gold. When the player stops, the last number hangs a beat and fades.',
    dod: [
      'Extractor harvest shows a climbing metal count.',
      'When harvest stops, the last number hangs a beat and fades.',
    ],
    sortOrder: 40,
  }),
  t({
    code: 'Tether-8.1.5',
    parentCode: 'Tether-8.1',
    shortTitle: 'Quota on HUD',
    state: 'Ready',
    size: 'Small',
    skill: 'Code',
    staffOnly: false,
    purpose: 'Power cells and scrap needed vs held.',
    dod: ['HUD shows power-cell and scrap quota needed vs held.'],
    sortOrder: 50,
  }),
  t({
    code: 'Tether-8.1.6',
    parentCode: 'Tether-8.1',
    shortTitle: 'Round briefing',
    state: 'Ready',
    size: 'Small',
    skill: 'Code',
    staffOnly: false,
    purpose:
      'At map start a colony NPC speaks over comms and names the quota. First pass can be a comms text box plus a placeholder voice line.',
    dod: [
      'Map start plays a colony comms briefing that names the quota.',
      'First pass may be a text box plus a placeholder voice line.',
    ],
    sortOrder: 60,
  }),
  t({
    code: 'Tether-8.1.7',
    parentCode: 'Tether-8.1',
    shortTitle: 'Power clock',
    state: 'Ready',
    size: 'Small',
    skill: 'Code',
    staffOnly: false,
    purpose:
      'Stopwatch ring. Colored circle with an arrow that travels around the ring and eats the color. Turns red as time runs out. Empty is a loss.',
    dod: [
      'A power-clock ring exists with a traveling arrow that eats the color.',
      'The ring turns red as time runs out. Empty is a loss.',
    ],
    sortOrder: 70,
  }),
  t({
    code: 'Tether-8.1.8',
    parentCode: 'Tether-8.1',
    shortTitle: 'Combat reads',
    state: 'Ready',
    size: 'Small',
    skill: 'Code',
    staffOnly: false,
    purpose:
      'Spark stun, nanites inside a target, shared Enforcer beams, Snare cables, Canon helpers, Extractor stream. Tension stays on the beam mesh.',
    dod: [
      'Combat reads exist for Spark stun, nanites, Enforcer beams, Snare cables, Canon helpers, and Extractor stream.',
      'Tension is not a HUD meter. It stays on the beam mesh.',
    ],
    sortOrder: 80,
  }),

  t({
    code: 'Tether-8.2',
    parentCode: 'Tether-8',
    shortTitle: 'Main menu',
    state: 'Ready',
    size: 'Medium',
    skill: 'Code',
    staffOnly: false,
    purpose: 'Graybox main menu.',
    sortOrder: 20,
  }),
  t({
    code: 'Tether-8.2.1',
    parentCode: 'Tether-8.2',
    shortTitle: 'Main menu shell',
    state: 'Ready',
    size: 'Small',
    skill: 'Code',
    staffOnly: false,
    purpose: 'Play, Settings, Quit.',
    dod: ['Main menu has Play, Settings, and Quit.'],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-8.2.2',
    parentCode: 'Tether-8.2',
    shortTitle: 'Join the Forge',
    state: 'Ready',
    size: 'Small',
    skill: 'Code',
    staffOnly: false,
    purpose: 'Opens https://togetherforge.net in the system browser.',
    dod: ['Join the Forge opens https://togetherforge.net in the system browser.'],
    sortOrder: 20,
  }),
  t({
    code: 'Tether-8.2.3',
    parentCode: 'Tether-8.2',
    shortTitle: 'Settings',
    state: 'Ready',
    size: 'Small',
    skill: 'Code',
    staffOnly: false,
    purpose:
      'Sound, visuals, controls. First pass can be stubs with working sliders where they already exist.',
    dod: [
      'Settings covers sound, visuals, and controls.',
      'First pass may stub entries and use existing sliders.',
    ],
    sortOrder: 30,
  }),

  t({
    code: 'Tether-8.3',
    parentCode: 'Tether-8',
    shortTitle: 'Play, host, join',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'NOT blocked on Tether-10. Screens can use a stub session list until live listing is wired.',
    extra: 'Tether-10 is done. Do not Block this medium on Tether-10.',
    sortOrder: 30,
  }),
  t({
    code: 'Tether-8.3.1',
    parentCode: 'Tether-8.3',
    shortTitle: 'Play menu',
    state: 'Ready',
    size: 'Small',
    skill: 'Code',
    staffOnly: false,
    purpose: 'Host Game, Join Game.',
    dod: ['Play menu has Host Game and Join Game.'],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-8.3.2',
    parentCode: 'Tether-8.3',
    shortTitle: 'Host Game',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Campaign or unofficial map. Starts a session for the host and friends.',
    extra: 'Not blocked on Tether-10.',
    dod: [
      'Host can start a campaign or unofficial-map session.',
      'Friends can join that session.',
    ],
    sortOrder: 20,
  }),
  t({
    code: 'Tether-8.3.3',
    parentCode: 'Tether-8.3',
    shortTitle: 'Join Game',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'List of active sessions. Filters: friends only, not-full, campaign vs unofficial.',
    extra: 'Not blocked on Tether-10. A stub session list is enough until live listing is wired.',
    dod: [
      'Join Game lists active sessions.',
      'Filters exist for friends only, not-full, and campaign vs unofficial.',
    ],
    sortOrder: 30,
  }),
  t({
    code: 'Tether-8.3.4',
    parentCode: 'Tether-8.3',
    shortTitle: 'Session row',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Name and player count on each row.',
    extra: 'Not blocked on Tether-10.',
    dod: ['Each session row shows a name and player count.'],
    sortOrder: 40,
  }),

  t({
    code: 'Tether-8.4',
    parentCode: 'Tether-8',
    shortTitle: 'Pause',
    state: 'Ready',
    size: 'Medium',
    skill: 'Code',
    staffOnly: false,
    purpose: 'Graybox pause menu.',
    sortOrder: 40,
  }),
  t({
    code: 'Tether-8.4.1',
    parentCode: 'Tether-8.4',
    shortTitle: 'Pause menu',
    state: 'Ready',
    size: 'Small',
    skill: 'Code',
    staffOnly: false,
    purpose: 'Resume, Settings, Return to Main Menu, Quit.',
    dod: ['Pause menu has Resume, Settings, Return to Main Menu, and Quit.'],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-8.4.2',
    parentCode: 'Tether-8.4',
    shortTitle: 'Pause Settings',
    state: 'Ready',
    size: 'Small',
    skill: 'Code',
    staffOnly: false,
    purpose: 'Opens the same Settings as 8.2.3.',
    dod: ['Pause Settings opens the same Settings as Tether-8.2.3.'],
    sortOrder: 20,
  }),

  t({
    code: 'Tether-8.5',
    parentCode: 'Tether-8',
    shortTitle: 'Warp and Gear Up',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Reaching a warp gate opens stats first, then Gear Up.',
    sortOrder: 50,
  }),
  t({
    code: 'Tether-8.5.1',
    parentCode: 'Tether-8.5',
    shortTitle: 'Round stats',
    state: 'Ready',
    size: 'Small',
    skill: 'Code',
    staffOnly: false,
    purpose:
      'Enemies dealt with, raw collected by type, distance traveled. First pass is those three.',
    dod: [
      'Round stats show enemies dealt with, raw collected by type, and distance traveled.',
    ],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-8.5.2',
    parentCode: 'Tether-8.5',
    shortTitle: 'Continue into Gear Up',
    state: 'Ready',
    size: 'Small',
    skill: 'Code',
    staffOnly: false,
    purpose: 'From round stats, continue into Gear Up.',
    dod: ['A continue control opens Gear Up after round stats.'],
    sortOrder: 20,
  }),
  t({
    code: 'Tether-8.5.3',
    parentCode: 'Tether-8.5',
    shortTitle: 'Gear Up tabs',
    state: 'Ready',
    size: 'Small',
    skill: 'Code',
    staffOnly: false,
    purpose: 'Upgrades, Weapons, Tools, Conversion.',
    dod: ['Gear Up has Upgrades, Weapons, Tools, and Conversion tabs.'],
    sortOrder: 30,
  }),
  t({
    code: 'Tether-8.5.4',
    parentCode: 'Tether-8.5',
    shortTitle: 'Upgrades tab',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Player and group stats from Tether-7.1. Spend raw.',
    dod: ['Upgrades tab spends raw on Tether-7.1 player and group stats.'],
    sortOrder: 40,
  }),
  t({
    code: 'Tether-8.5.5',
    parentCode: 'Tether-8.5',
    shortTitle: 'Weapons tab',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Buy weapons the colony crafts. Upgrade weapons you already own. Spend raw.',
    dod: ['Weapons tab buys and upgrades colony weapons by spending raw.'],
    sortOrder: 50,
  }),
  t({
    code: 'Tether-8.5.6',
    parentCode: 'Tether-8.5',
    shortTitle: 'Tools tab',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Buy tools the colony crafts. Upgrade tools you already own. Spend raw.',
    dod: ['Tools tab buys and upgrades colony tools by spending raw.'],
    sortOrder: 60,
  }),
  t({
    code: 'Tether-8.5.7',
    parentCode: 'Tether-8.5',
    shortTitle: 'Conversion tab',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Trade one raw type for another by value. Rates Open. Logic is Tether-4.3.9.',
    dod: [
      'Conversion tab trades one raw type for another by value.',
      'Rates stay Open. Logic stays on Tether-4.3.9.',
    ],
    sortOrder: 70,
  }),
  t({
    code: 'Tether-8.5.8',
    parentCode: 'Tether-8.5',
    shortTitle: 'Leave Gear Up and finish warp',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Bank what you kept. Apply quota.',
    dod: ['Leaving Gear Up banks kept raw and applies quota.'],
    sortOrder: 80,
  }),

  t({
    code: 'Tether-8.6',
    parentCode: 'Tether-8',
    shortTitle: 'Fail and success',
    state: 'Ready',
    size: 'Medium',
    skill: 'Code',
    staffOnly: false,
    purpose: 'Graybox fail and success screens.',
    sortOrder: 60,
  }),
  t({
    code: 'Tether-8.6.1',
    parentCode: 'Tether-8.6',
    shortTitle: 'Fail screen',
    state: 'Ready',
    size: 'Small',
    skill: 'Code',
    staffOnly: false,
    purpose: 'Clock ring empty, or the crew cannot continue. Return to Main Menu or retry.',
    dod: ['Fail screen offers Return to Main Menu or retry.'],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-8.6.2',
    parentCode: 'Tether-8.6',
    shortTitle: 'Success screen',
    state: 'Ready',
    size: 'Small',
    skill: 'Code',
    staffOnly: false,
    purpose: 'Quota met and the crew warps. Later add the finale generator send.',
    dod: ['Success screen plays when quota is met and the crew warps.'],
    sortOrder: 20,
  }),

  t({
    code: 'Tether-11',
    parentCode: null,
    shortTitle: 'Model rigging and animation',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Art',
    staffOnly: true,
    purpose:
      'Own epic because each rig and clip is real work. Gameplay still lives on Tether-3, 5, and 7. This epic is the rig and the motion.',
    extra: `${ANIM_BAR}\n\nSource: ${TETHER_V021_SOURCE}. Staging only. Do not publish. Not UI. No weapon children.`,
    sortOrder: 110,
  }),

  t({
    code: 'Tether-11.0',
    parentCode: 'Tether-11',
    shortTitle: 'Shared rig',
    state: 'Ready',
    size: 'Medium',
    skill: 'Art',
    staffOnly: false,
    purpose: 'Shared player skeleton and export path.',
    extra: ANIM_BAR,
    sortOrder: 10,
  }),
  t({
    code: 'Tether-11.0.1',
    parentCode: 'Tether-11.0',
    shortTitle: 'Docs/Animation.md',
    state: 'Ready',
    size: 'Small',
    skill: 'Writing',
    staffOnly: false,
    purpose: `${ANIM_BAR} Clip list. Basic and quick written at the top.`,
    output: 'Docs/Animation.md in the Tether repo.',
    dod: [
      'Docs/Animation.md exists.',
      'Basic and quick is written at the top.',
      'A clip list is on the page.',
    ],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-11.0.2',
    parentCode: 'Tether-11.0',
    shortTitle: 'Player skeleton and first suit rig',
    state: 'Ready',
    size: 'Small',
    skill: 'Art',
    staffOnly: false,
    purpose: 'First player skeleton and suit rig. Basic and quick.',
    dod: ['A player skeleton and first suit rig exist.'],
    sortOrder: 20,
  }),
  t({
    code: 'Tether-11.0.3',
    parentCode: 'Tether-11.0',
    shortTitle: 'Export and retarget path',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Art',
    staffOnly: true,
    purpose: 'Later suits reuse this skeleton.',
    dod: ['An export and retarget path exists so later suits reuse this skeleton.'],
    sortOrder: 30,
  }),

  t({
    code: 'Tether-11.1',
    parentCode: 'Tether-11',
    shortTitle: 'Player clips',
    state: 'Ready',
    size: 'Medium',
    skill: 'Art',
    staffOnly: false,
    purpose: 'One loop or one-shot each. Basic and quick.',
    extra: ANIM_BAR,
    sortOrder: 20,
  }),
  ...[
    ['Tether-11.1.1', 'Idle', 10],
    ['Tether-11.1.2', 'Walk', 20],
    ['Tether-11.1.3', 'Run', 30],
    ['Tether-11.1.4', 'Jump', 40],
    ['Tether-11.1.5', 'Fall airborne', 50],
    ['Tether-11.1.6', 'Land', 60],
    ['Tether-11.1.7', 'Climb ledge get-up', 70],
    ['Tether-11.1.8', 'Lunge', 80],
    ['Tether-11.1.9', 'Extractor hold', 90],
    ['Tether-11.1.10', 'Spark fire', 100],
    ['Tether-11.1.11', 'Nano-Knife swing', 110],
    ['Tether-11.1.12', 'Enforcer hold', 120],
    ['Tether-11.1.13', 'Grapple fire and hang', 130],
    ['Tether-11.1.14', 'Rescue pull hold', 140],
    ['Tether-11.1.15', 'Carry oversized scrap', 150],
  ].map(([code, shortTitle, sortOrder]) =>
    t({
      code,
      parentCode: 'Tether-11.1',
      shortTitle,
      state: 'Ready',
      size: 'Small',
      skill: 'Art',
      staffOnly: false,
      purpose: `${shortTitle} clip. One loop or one-shot. Basic and quick.`,
      dod: [`A basic, quick ${shortTitle.toLowerCase()} clip exists.`],
      sortOrder,
    })
  ),

  t({
    code: 'Tether-11.2',
    parentCode: 'Tether-11',
    shortTitle: 'Enemy clips',
    state: 'Ready',
    size: 'Medium',
    skill: 'Art',
    staffOnly: false,
    purpose: 'Basic and quick. One rig per starter creature. Do not invent a sixth enemy.',
    extra: ANIM_BAR,
    sortOrder: 30,
  }),
  t({
    code: 'Tether-11.2.1',
    parentCode: 'Tether-11.2',
    shortTitle: 'Snatch clips',
    state: 'Ready',
    size: 'Small',
    skill: 'Art',
    staffOnly: false,
    purpose: 'Fly, watch, dive, carry, eat, stagger, death.',
    dod: ['Snatch has basic fly, watch, dive, carry, eat, stagger, and death clips.'],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-11.2.2',
    parentCode: 'Tether-11.2',
    shortTitle: 'Latch clips',
    state: 'Ready',
    size: 'Small',
    skill: 'Art',
    staffOnly: false,
    purpose: 'Run, lunge, ride, eat, death.',
    dod: ['Latch has basic run, lunge, ride, eat, and death clips.'],
    sortOrder: 20,
  }),
  t({
    code: 'Tether-11.2.3',
    parentCode: 'Tether-11.2',
    shortTitle: 'Tick clips',
    state: 'Ready',
    size: 'Small',
    skill: 'Art',
    staffOnly: false,
    purpose: 'Crawl, hide, chew, latch-on, death.',
    dod: ['Tick has basic crawl, hide, chew, latch-on, and death clips.'],
    sortOrder: 30,
  }),
  t({
    code: 'Tether-11.2.4',
    parentCode: 'Tether-11.2',
    shortTitle: 'Guard clips',
    state: 'Ready',
    size: 'Small',
    skill: 'Art',
    staffOnly: false,
    purpose: 'Walk food, charge, spit, wall walk, tell jump, eat, death.',
    dod: [
      'Guard has basic walk-food, charge, spit, wall walk, tell jump, eat, and death clips.',
    ],
    sortOrder: 40,
  }),
  t({
    code: 'Tether-11.2.5',
    parentCode: 'Tether-11.2',
    shortTitle: 'Spore clips',
    state: 'Ready',
    size: 'Small',
    skill: 'Art',
    staffOnly: false,
    purpose: 'Idle hidden, snare, whip, wrap, death.',
    dod: ['Spore has basic idle-hidden, snare, whip, wrap, and death clips.'],
    sortOrder: 50,
  }),
  t({
    code: 'Tether-11.2.6',
    parentCode: 'Tether-11.2',
    shortTitle: 'Finale creature',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Art',
    staffOnly: true,
    purpose: 'Later. One card only. No clip list until there is a founder brief.',
    dod: ['Finale creature stays one Later card with no clip list until a founder brief.'],
    sortOrder: 60,
  }),

  t({
    code: 'Tether-11.3',
    parentCode: 'Tether-11',
    shortTitle: 'Weapon and tool poses',
    state: 'Ready',
    size: 'Medium',
    skill: 'Art',
    staffOnly: false,
    purpose: 'Held poses for starter weapons and tools. Basic and quick.',
    sortOrder: 40,
  }),
  t({
    code: 'Tether-11.3.1',
    parentCode: 'Tether-11.3',
    shortTitle: 'Held weapon poses',
    state: 'Ready',
    size: 'Small',
    skill: 'Art',
    staffOnly: false,
    purpose: 'Spark, knife, Enforcer, Canon, Snare.',
    dod: ['Held poses exist for Spark, knife, Enforcer, Canon, and Snare.'],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-11.3.2',
    parentCode: 'Tether-11.3',
    shortTitle: 'Extractor stream pose',
    state: 'Ready',
    size: 'Small',
    skill: 'Art',
    staffOnly: false,
    purpose: 'Pose while the Extractor stream is on.',
    dod: ['An Extractor stream pose exists.'],
    sortOrder: 20,
  }),
  t({
    code: 'Tether-11.3.3',
    parentCode: 'Tether-11.3',
    shortTitle: 'Grapple hook pose',
    state: 'Ready',
    size: 'Small',
    skill: 'Art',
    staffOnly: false,
    purpose: 'Pose while firing or hanging on the grapple.',
    dod: ['A grapple hook pose exists.'],
    sortOrder: 30,
  }),
];

export function tetherV021Title(task) {
  return `${task.code} ${task.shortTitle}`;
}

export function tetherV021Difficulty(size) {
  if (size === 'Small') return 'Easy';
  return 'Medium';
}

export function tetherV021StaffOnly(task) {
  if (typeof task?.staffOnly === 'boolean') return task.staffOnly;
  return task?.state === 'Staff Only';
}

export function buildTetherV021Description(task) {
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

export function tetherV021Subtasks(task) {
  if (!Array.isArray(task.dod) || !task.dod.length) return [];
  return task.dod.map((label, i) => ({
    id: `s${i + 1}`,
    label,
    done: false,
  }));
}

export function tetherV021Depth(task) {
  if (!task.parentCode) return 0;
  const parent = TETHER_V021_TASKS.find((x) => x.code === task.parentCode);
  if (!parent || !parent.parentCode) return 1;
  return 2;
}
