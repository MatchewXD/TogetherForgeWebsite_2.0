/**
 * Tether Task Breakdown v0.6 — source of truth for the staging-board import.
 * Codes match the doc (Tether-1.1.1). Do not invent extra Smalls.
 * All rows import to board_scope = staging. None are Ready for public claim.
 */

export const TETHER_V06_VERSION = 'v0.6';
export const TETHER_V06_PROJECT_SLUG = 'tether';

/** Titles that belong to the v0.6 tree (Tether-1…13 or Tether-P). */
export const TETHER_V06_TITLE_RE = /^Tether-(P|[1-9]|1[0-3])([. ]|$)/;

export function isTetherV06Title(title) {
  return TETHER_V06_TITLE_RE.test(String(title || '').trim());
}
export const TETHER_READY_PROMOTE_NOTE =
  'Promote to public Ready only after Epic 1 is Done in the Unreal repo.';

function t(partial) {
  return partial;
}

/** @type {Array<{
 *  code: string,
 *  parentCode: string|null,
 *  shortTitle: string,
 *  state: 'Staff Only'|'Blocked'|'Parked',
 *  size: 'First Spark'|'Small'|'Medium',
 *  skill: 'Code'|'Art'|'Design'|'Writing'|'Level Design'|'Audio'|'QA'|'Other',
 *  purpose: string,
 *  output?: string,
 *  dod?: string[],
 *  blocker?: string,
 *  blockedByCode?: string,
 *  staffNote?: string,
 *  extra?: string,
 *  sortOrder: number,
 * }>} */
export const TETHER_V06_TASKS = [
  t({
    code: 'Tether-1',
    parentCode: null,
    shortTitle: 'Project foundation',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    purpose:
      'One engine version, one repo, one folder map, Canon packet.',
    sortOrder: 10,
  }),
  t({
    code: 'Tether-1.1',
    parentCode: 'Tether-1',
    shortTitle: 'Engine lock and empty project',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    purpose: 'Lock Unreal 5.8.x and create the empty Tether project.',
    sortOrder: 10,
  }),
  t({
    code: 'Tether-1.1.1',
    parentCode: 'Tether-1.1',
    shortTitle: 'Record the engine decision',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Writing',
    purpose: 'Record the engine decision.',
    output:
      'Docs/EngineDecision.md with 5.8.x lock, why, four requirements, staff sign-off.',
    dod: [
      'Docs/EngineDecision.md exists with 5.8.x lock, rationale, four requirements, and staff sign-off.',
      'README notes the exact launcher build. Do not start on UE6.',
    ],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-1.1.2',
    parentCode: 'Tether-1.1',
    shortTitle: 'Install and create the project',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    purpose: 'Install Unreal 5.8.x and create the Tether project.',
    output:
      'Tether UE 5.8.x project, Content/Tether folder tree, Maps/TetherPrototype as startup map, project opens with no errors.',
    dod: [
      'Project opens in UE 5.8.x with no errors.',
      'Content/Tether folder tree exists (Characters, Tether, Maps, Enemies, Interact, Modular, UI, Audio).',
      'Maps/TetherPrototype is the startup map.',
    ],
    sortOrder: 20,
  }),
  t({
    code: 'Tether-1.2',
    parentCode: 'Tether-1',
    shortTitle: 'GitHub and collaboration base',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    purpose: 'Private GitHub repo and collaboration rules.',
    sortOrder: 20,
  }),
  t({
    code: 'Tether-1.2.1',
    parentCode: 'Tether-1.2',
    shortTitle: 'Repository',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    purpose: 'Create the private GitHub repository.',
    output:
      'Private repo, Unreal gitignore, LFS, first commit, develop + protected main, Docs/Repo.md with URL.',
    dod: [
      'Private GitHub repo exists with official Unreal gitignore and Git LFS for Unreal assets.',
      'First commit is on develop; main is protected; PRs are required.',
      'Docs/Repo.md records the URL.',
      'PR titles use the Task ID (example Tether-1.2.1).',
    ],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-1.2.2',
    parentCode: 'Tether-1.2',
    shortTitle: 'README and CONTRIBUTING',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Writing',
    purpose: 'Document how to open the project and how to contribute.',
    output:
      'README (version, how to open, how to run TetherPrototype), CONTRIBUTING (claim on site, Task ID, no invented scope), PR template, access rule.',
    dod: [
      'README covers version, how to open, and how to run TetherPrototype.',
      'CONTRIBUTING covers claim on site, Task ID in PRs, and no invented scope.',
      'PR template exists.',
      'Access rule: granted after a claimed repo task is approved, once public claiming exists.',
    ],
    sortOrder: 20,
  }),
  t({
    code: 'Tether-1.3',
    parentCode: 'Tether-1',
    shortTitle: 'Canon packet',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Writing',
    purpose: 'Canon packet: vision, what this is not, style lock, Tether rules.',
    sortOrder: 30,
  }),
  t({
    code: 'Tether-1.3.1',
    parentCode: 'Tether-1.3',
    shortTitle: 'Vision and What this is not',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Writing',
    purpose: 'Write Vision and What this is not.',
    output: 'Docs/Vision.md and Docs/WhatThisIsNot.md.',
    dod: [
      'Docs/Vision.md exists.',
      'Docs/WhatThisIsNot.md exists.',
    ],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-1.3.2',
    parentCode: 'Tether-1.3',
    shortTitle: 'Style lock and Tether rules',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Writing',
    purpose: 'Draft style lock and starting Tether rules.',
    output:
      'Docs/StyleLock.md (Draft until approved) and Docs/TetherRules.txt (starting bands, Open items labeled). Link all four Canon files from README.',
    dod: [
      'Docs/StyleLock.md exists and is labeled Draft until approved.',
      'Docs/TetherRules.txt exists with starting bands and Open items labeled.',
      'README links Vision, WhatThisIsNot, StyleLock, and TetherRules.',
    ],
    sortOrder: 20,
  }),

  t({
    code: 'Tether-P',
    parentCode: null,
    shortTitle: 'Ready lane',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Writing',
    purpose:
      'Staging Ready lane. These cards stay Staff Only and off the public board until Epic 1 is Done in the Unreal repo.',
    staffNote: TETHER_READY_PROMOTE_NOTE,
    sortOrder: 15,
  }),
  t({
    code: 'Tether-P.1',
    parentCode: 'Tether-P',
    shortTitle: 'Contributor docs',
    state: 'Staff Only',
    size: 'First Spark',
    skill: 'Writing',
    purpose: 'Contributor docs for running Tether and onboarding.',
    staffNote: TETHER_READY_PROMOTE_NOTE,
    sortOrder: 10,
  }),
  t({
    code: 'Tether-P.1.1',
    parentCode: 'Tether-P.1',
    shortTitle: 'How to run Tether',
    state: 'Staff Only',
    size: 'First Spark',
    skill: 'Writing',
    purpose: 'How to run Tether.',
    output: 'README how-to-run plus two screenshots in Docs/images/.',
    dod: [
      'README how-to-run is written.',
      'Two screenshots live in Docs/images/.',
    ],
    staffNote: TETHER_READY_PROMOTE_NOTE,
    sortOrder: 10,
  }),
  t({
    code: 'Tether-P.1.2',
    parentCode: 'Tether-P.1',
    shortTitle: 'First Spark onboarding note',
    state: 'Staff Only',
    size: 'First Spark',
    skill: 'Writing',
    purpose: 'First Spark onboarding note.',
    output:
      'Docs/FirstSpark.md covering claim, review, Grant Credit, conduct@togetherforge.net.',
    dod: [
      'Docs/FirstSpark.md covers claim, review, Grant Credit, and conduct@togetherforge.net.',
    ],
    staffNote: TETHER_READY_PROMOTE_NOTE,
    sortOrder: 20,
  }),
  t({
    code: 'Tether-P.2',
    parentCode: 'Tether-P',
    shortTitle: 'Art exploration',
    state: 'Staff Only',
    size: 'First Spark',
    skill: 'Art',
    purpose: 'Art exploration for player, tether, and scale.',
    staffNote: TETHER_READY_PROMOTE_NOTE,
    sortOrder: 20,
  }),
  t({
    code: 'Tether-P.2.1',
    parentCode: 'Tether-P.2',
    shortTitle: 'Player stand-in silhouettes',
    state: 'Staff Only',
    size: 'First Spark',
    skill: 'Art',
    purpose: 'Player stand-in silhouettes.',
    output: 'Three thumbnails in Docs/art-explorations/player/.',
    dod: ['Three thumbnails exist in Docs/art-explorations/player/.'],
    staffNote: TETHER_READY_PROMOTE_NOTE,
    sortOrder: 10,
  }),
  t({
    code: 'Tether-P.2.2',
    parentCode: 'Tether-P.2',
    shortTitle: 'Tether visual directions',
    state: 'Staff Only',
    size: 'First Spark',
    skill: 'Art',
    purpose: 'Tether visual directions.',
    output: 'Three Low vs High stills in Docs/art-explorations/tether/.',
    dod: ['Three Low vs High stills exist in Docs/art-explorations/tether/.'],
    staffNote: TETHER_READY_PROMOTE_NOTE,
    sortOrder: 20,
  }),
  t({
    code: 'Tether-P.2.3',
    parentCode: 'Tether-P.2',
    shortTitle: 'Modular kit scale sheet',
    state: 'Staff Only',
    size: 'First Spark',
    skill: 'Art',
    purpose: 'Modular kit scale sheet.',
    output: 'Docs/art-explorations/scale-sheet.md.',
    dod: ['Docs/art-explorations/scale-sheet.md exists.'],
    staffNote: TETHER_READY_PROMOTE_NOTE,
    sortOrder: 30,
  }),
  t({
    code: 'Tether-P.3',
    parentCode: 'Tether-P',
    shortTitle: 'QA templates',
    state: 'Staff Only',
    size: 'First Spark',
    skill: 'QA',
    purpose: 'QA templates for playtests.',
    staffNote: TETHER_READY_PROMOTE_NOTE,
    sortOrder: 30,
  }),
  t({
    code: 'Tether-P.3.1',
    parentCode: 'Tether-P.3',
    shortTitle: 'Dual-control checklist',
    state: 'Staff Only',
    size: 'First Spark',
    skill: 'QA',
    purpose: 'Control checklist for playtests.',
    output: 'Docs/qa/DualControlChecklist.md.',
    dod: ['Docs/qa/DualControlChecklist.md exists.'],
    staffNote: TETHER_READY_PROMOTE_NOTE,
    sortOrder: 10,
  }),
  t({
    code: 'Tether-P.3.2',
    parentCode: 'Tether-P.3',
    shortTitle: 'Playtest note template',
    state: 'Staff Only',
    size: 'First Spark',
    skill: 'QA',
    purpose: 'Playtest note template.',
    output: 'Docs/qa/PlaytestNote.md.',
    dod: ['Docs/qa/PlaytestNote.md exists.'],
    staffNote: TETHER_READY_PROMOTE_NOTE,
    sortOrder: 20,
  }),
  t({
    code: 'Tether-P.4',
    parentCode: 'Tether-P',
    shortTitle: 'Community credit',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Other',
    purpose: 'Credit current off-site helpers.',
    staffNote: TETHER_READY_PROMOTE_NOTE,
    sortOrder: 40,
  }),
  t({
    code: 'Tether-P.4.1',
    parentCode: 'Tether-P.4',
    shortTitle: 'Credit current off-site helpers',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Other',
    purpose: 'Credit current off-site helpers with Grant Credit.',
    output: 'Staff Grant Credit entries for current off-site helpers.',
    dod: [
      'Current off-site helpers are credited with Grant Credit (no fake tasks).',
    ],
    staffNote: TETHER_READY_PROMOTE_NOTE,
    sortOrder: 10,
  }),

  t({
    code: 'Tether-2',
    parentCode: null,
    shortTitle: 'Core tether physics',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    purpose:
      'Shared tether feels good and is readable. First feel test uses two pawns. Do not unlock later gameplay until that test is playtested and TetherRules.txt is updated. Solo behavior and 3-4 tether topology stay Open.',
    sortOrder: 20,
  }),
  t({
    code: 'Tether-2.1',
    parentCode: 'Tether-2',
    shortTitle: 'Basic tether between two pawns',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    purpose: 'First feel test: a basic tether between two pawns.',
    sortOrder: 10,
  }),
  t({
    code: 'Tether-2.1.1',
    parentCode: 'Tether-2.1',
    shortTitle: 'Player stand-ins',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    purpose: 'Player stand-ins.',
    output:
      'Content/Tether/Characters/BP_PlayerStandIn, two stand-ins in TetherPrototype for the first feel test.',
    dod: [
      'BP_PlayerStandIn exists under Content/Tether/Characters/.',
      'Two stand-ins are in TetherPrototype for the first feel test.',
    ],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-2.1.2',
    parentCode: 'Tether-2.1',
    shortTitle: 'Distance constraint and visual',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    purpose: 'Distance constraint and visual.',
    output:
      'Content/Tether/Tether/, max distance 8–12 units written into TetherRules.txt, line changes at stretch.',
    dod: [
      'Tether lives under Content/Tether/Tether/.',
      'Max distance 8–12 units is written into TetherRules.txt.',
      'The line changes at stretch.',
    ],
    sortOrder: 20,
  }),
  t({
    code: 'Tether-2.1.3',
    parentCode: 'Tether-2.1',
    shortTitle: 'Local dual control',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Writing',
    purpose: 'Document local controls for the two-pawn feel test.',
    output: 'Docs/Controls.md.',
    dod: [
      'Docs/Controls.md exists and documents local controls for the two-pawn feel test.',
    ],
    sortOrder: 30,
  }),
  t({
    code: 'Tether-2.2',
    parentCode: 'Tether-2',
    shortTitle: 'Tension states',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    purpose: 'Tension states tethered players can read.',
    sortOrder: 20,
  }),
  t({
    code: 'Tether-2.2.1',
    parentCode: 'Tether-2.2',
    shortTitle: 'Tension calculation',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    purpose: 'Tension calculation.',
    output: 'Low 0–50, Medium 50–85, High 85–100. Write thresholds in TetherRules.txt.',
    dod: [
      'Low 0–50, Medium 50–85, High 85–100 are implemented.',
      'Thresholds are written in TetherRules.txt.',
    ],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-2.2.2',
    parentCode: 'Tether-2.2',
    shortTitle: 'Movement response to High tension',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    purpose: 'Movement response to High tension.',
    output: 'Document the speed multiplier.',
    dod: ['High-tension speed multiplier is implemented and documented.'],
    sortOrder: 20,
  }),
  t({
    code: 'Tether-2.2.3',
    parentCode: 'Tether-2.2',
    shortTitle: 'Visual and placeholder High-tension audio',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Art',
    purpose: 'Visual and placeholder High-tension audio.',
    output: 'Spectator can read the state.',
    dod: [
      'A spectator can read Low / Medium / High from the visual.',
      'Placeholder High-tension audio plays.',
    ],
    sortOrder: 30,
  }),
  t({
    code: 'Tether-2.3',
    parentCode: 'Tether-2',
    shortTitle: 'Over-stretch and recovery',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    purpose: 'Over-stretch and recovery.',
    sortOrder: 30,
  }),
  t({
    code: 'Tether-2.3.1',
    parentCode: 'Tether-2.3',
    shortTitle: 'Over-stretch behavior',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    purpose: 'Over-stretch behavior.',
    output: 'Documented in TetherRules.txt and implemented.',
    dod: [
      'Over-stretch behavior is documented in TetherRules.txt.',
      'Over-stretch behavior is implemented.',
    ],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-2.3.2',
    parentCode: 'Tether-2.3',
    shortTitle: 'Recovery',
    state: 'Staff Only',
    size: 'Small',
    skill: 'QA',
    purpose: 'Recovery after over-stretch.',
    output: 'Done only after a two-pawn feel test using Docs/qa/PlaytestNote.md.',
    dod: [
      'Recovery is implemented.',
      'A two-pawn feel test was recorded with Docs/qa/PlaytestNote.md.',
      'TetherRules.txt is updated from that playtest.',
    ],
    sortOrder: 20,
  }),

  t({
    code: 'Tether-3',
    parentCode: null,
    shortTitle: 'Tether-aware movement',
    state: 'Blocked',
    size: 'Medium',
    skill: 'Code',
    purpose: 'Tether-aware movement.',
    blocker: 'Epic 2 playtest not passed.',
    blockedByCode: 'Tether-2',
    sortOrder: 30,
  }),
  t({
    code: 'Tether-3.1',
    parentCode: 'Tether-3',
    shortTitle: 'Core locomotion and camera',
    state: 'Blocked',
    size: 'Medium',
    skill: 'Code',
    purpose: 'Core locomotion and camera choice documented in Docs/.',
    blocker: 'Epic 2 playtest not passed.',
    blockedByCode: 'Tether-2',
    sortOrder: 10,
  }),
  t({
    code: 'Tether-3.2',
    parentCode: 'Tether-3',
    shortTitle: 'Pull/resist and failure-mode tests',
    state: 'Blocked',
    size: 'Medium',
    skill: 'Code',
    purpose: 'Pull/resist and failure-mode tests.',
    blocker: 'Epic 2 playtest not passed.',
    blockedByCode: 'Tether-2',
    sortOrder: 20,
  }),

  t({
    code: 'Tether-4',
    parentCode: null,
    shortTitle: 'Resources and warp',
    state: 'Blocked',
    size: 'Medium',
    skill: 'Code',
    purpose: 'Resources and warp.',
    blocker: 'Epic 3 not stable.',
    blockedByCode: 'Tether-3',
    sortOrder: 40,
  }),
  t({
    code: 'Tether-4.1',
    parentCode: 'Tether-4',
    shortTitle: 'ResourceNode and carry limit',
    state: 'Blocked',
    size: 'Medium',
    skill: 'Code',
    purpose: 'ResourceNode, carry limit 1 or 2, at least six nodes.',
    blocker: 'Epic 3 not stable.',
    blockedByCode: 'Tether-3',
    sortOrder: 10,
  }),
  t({
    code: 'Tether-4.2',
    parentCode: 'Tether-4',
    shortTitle: 'Checkpoint warp and session total',
    state: 'Blocked',
    size: 'Medium',
    skill: 'Code',
    purpose: 'Checkpoint warp and session total.',
    output: 'Done at collect → carry → warp → total updates.',
    dod: ['Collect → carry → warp → session total updates in one loop.'],
    blocker: 'Epic 3 not stable.',
    blockedByCode: 'Tether-3',
    sortOrder: 20,
  }),

  t({
    code: 'Tether-5',
    parentCode: null,
    shortTitle: 'Enemies that stress the tether',
    state: 'Blocked',
    size: 'Medium',
    skill: 'Code',
    purpose: 'Enemies that stress the tether.',
    blocker: 'Epic 4 loop not working.',
    blockedByCode: 'Tether-4',
    sortOrder: 50,
  }),
  t({
    code: 'Tether-5.1',
    parentCode: 'Tether-5',
    shortTitle: 'Latch enemy',
    state: 'Blocked',
    size: 'Medium',
    skill: 'Code',
    purpose: 'Latch enemy, attach penalty, Energy Pulse removal.',
    blocker: 'Epic 4 loop not working.',
    blockedByCode: 'Tether-4',
    sortOrder: 10,
  }),

  t({
    code: 'Tether-6',
    parentCode: null,
    shortTitle: 'First playable surface level',
    state: 'Blocked',
    size: 'Medium',
    skill: 'Level Design',
    purpose: 'First playable surface level.',
    blocker: 'Epic 5 has no working enemy.',
    blockedByCode: 'Tether-5',
    sortOrder: 60,
  }),
  t({
    code: 'Tether-6.1',
    parentCode: 'Tether-6',
    shortTitle: 'Modular graybox kit plus Level_01_Surface',
    state: 'Blocked',
    size: 'Medium',
    skill: 'Level Design',
    purpose: 'Modular graybox kit plus Level_01_Surface.',
    blocker: 'Epic 5 has no working enemy.',
    blockedByCode: 'Tether-5',
    sortOrder: 10,
  }),
  t({
    code: 'Tether-6.2',
    parentCode: 'Tether-6',
    shortTitle: 'End-to-end 1-4 player loop',
    state: 'Blocked',
    size: 'Medium',
    skill: 'QA',
    purpose:
      'End-to-end 1-4 player cooperative loop with a recorded successful run. Solo behavior and 3-4 tether topology stay Open.',
    dod: ['A recorded successful 1-4 player run exists.'],
    blocker: 'Epic 5 has no working enemy.',
    blockedByCode: 'Tether-5',
    sortOrder: 20,
  }),

  t({
    code: 'Tether-7',
    parentCode: null,
    shortTitle: 'Tools, upgrades, between-level flow',
    state: 'Parked',
    size: 'Medium',
    skill: 'Code',
    purpose: 'Parked placeholder. Do not invent extra Smalls.',
    sortOrder: 70,
  }),
  t({
    code: 'Tether-7.1',
    parentCode: 'Tether-7',
    shortTitle: 'Upgrade screen',
    state: 'Parked',
    size: 'Medium',
    skill: 'Design',
    purpose: 'Parked placeholder: upgrade screen.',
    sortOrder: 10,
  }),
  t({
    code: 'Tether-7.2',
    parentCode: 'Tether-7',
    shortTitle: 'First upgrades',
    state: 'Parked',
    size: 'Medium',
    skill: 'Code',
    purpose: 'Parked placeholder: first upgrades — max distance, Anchor, Shared Reinforcer.',
    sortOrder: 20,
  }),

  t({
    code: 'Tether-8',
    parentCode: null,
    shortTitle: 'Final station sequence',
    state: 'Parked',
    size: 'Medium',
    skill: 'Level Design',
    purpose: 'Parked placeholder. Do not invent extra Smalls.',
    sortOrder: 80,
  }),
  t({
    code: 'Tether-8.1',
    parentCode: 'Tether-8',
    shortTitle: 'Station blockout',
    state: 'Parked',
    size: 'Medium',
    skill: 'Level Design',
    purpose: 'Parked placeholder: station blockout.',
    sortOrder: 10,
  }),
  t({
    code: 'Tether-8.2',
    parentCode: 'Tether-8',
    shortTitle: 'Creature drive-off',
    state: 'Parked',
    size: 'Medium',
    skill: 'Code',
    purpose: 'Parked placeholder: creature drive-off.',
    sortOrder: 20,
  }),

  t({
    code: 'Tether-9',
    parentCode: null,
    shortTitle: 'Art pipeline',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Art',
    purpose: 'Art pipeline. Exploration is Staff Only until style lock is approved.',
    sortOrder: 90,
  }),
  t({
    code: 'Tether-9.1',
    parentCode: 'Tether-9',
    shortTitle: 'Style lock approval',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Art',
    purpose: 'Style lock approval (exploration). Staff Only for now.',
    sortOrder: 10,
  }),
  t({
    code: 'Tether-9.2',
    parentCode: 'Tether-9',
    shortTitle: 'Core final assets',
    state: 'Blocked',
    size: 'Medium',
    skill: 'Art',
    purpose: 'Core final assets.',
    blocker: 'Style lock not approved.',
    blockedByCode: 'Tether-9.1',
    sortOrder: 20,
  }),

  t({
    code: 'Tether-10',
    parentCode: null,
    shortTitle: 'Networking foundation',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    purpose: 'Networking foundation. Founder-owned.',
    extra: 'Founder-owned. Default candidate: Iris on UE 5.8.',
    sortOrder: 100,
  }),
  t({
    code: 'Tether-10.1',
    parentCode: 'Tether-10',
    shortTitle: 'Core netcode',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    purpose:
      'Core netcode. Default candidate: Iris on UE 5.8. Host/join, pawn sync, tether sync later.',
    extra: 'Founder-owned.',
    sortOrder: 10,
  }),
  t({
    code: 'Tether-10.2',
    parentCode: 'Tether-10',
    shortTitle: 'Two-machine test on TetherPrototype',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    purpose: 'Two-machine test on TetherPrototype.',
    extra: 'Founder-owned.',
    sortOrder: 20,
  }),

  t({
    code: 'Tether-11',
    parentCode: null,
    shortTitle: 'UI',
    state: 'Parked',
    size: 'Medium',
    skill: 'Design',
    purpose: 'Parked placeholder. Do not invent extra Smalls.',
    sortOrder: 110,
  }),
  t({
    code: 'Tether-12',
    parentCode: null,
    shortTitle: 'Audio',
    state: 'Parked',
    size: 'Medium',
    skill: 'Audio',
    purpose: 'Parked placeholder. Do not invent extra Smalls.',
    sortOrder: 120,
  }),
  t({
    code: 'Tether-13',
    parentCode: null,
    shortTitle: 'Playtesting and polish',
    state: 'Parked',
    size: 'Medium',
    skill: 'QA',
    purpose: 'Parked placeholder. Do not invent extra Smalls.',
    sortOrder: 130,
  }),
];

export function tetherV06Title(task) {
  return `${task.code} ${task.shortTitle}`;
}

export function tetherV06Difficulty(size) {
  if (size === 'First Spark' || size === 'Small') return 'Easy';
  return 'Medium';
}

export function tetherV06StaffOnly(state) {
  return state === 'Staff Only';
}

export function buildTetherV06Description(task) {
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
  if (task.staffNote) {
    lines.push('', `Staff note: ${task.staffNote}`);
  }
  if (task.extra) {
    lines.push('', task.extra);
  }
  return lines.join('\n').trim();
}

export function tetherV06Subtasks(task) {
  if (!Array.isArray(task.dod) || !task.dod.length) return [];
  return task.dod.map((label, i) => ({
    id: `s${i + 1}`,
    label,
    done: false,
  }));
}

export function tetherV06Depth(task) {
  if (!task.parentCode) return 0;
  const parent = TETHER_V06_TASKS.find((x) => x.code === task.parentCode);
  if (!parent || !parent.parentCode) return 1;
  return 2;
}

export function listTetherV06SmallsUnder(epicCode) {
  return TETHER_V06_TASKS.filter((t) => {
    if (tetherV06Depth(t) !== 2) return false;
    let cur = t;
    while (cur.parentCode) {
      cur = TETHER_V06_TASKS.find((x) => x.code === cur.parentCode);
      if (!cur) return false;
    }
    return cur.code === epicCode;
  });
}
