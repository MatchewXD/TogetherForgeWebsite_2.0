/**
 * Tether Task Breakdown v0.6 tree with v0.8 language (Enemies, CD, maps).
 * Staging-board import source. Epic 5 is Enemies. Latch is one example creature.
 * Codes match the doc (Tether-1.1.1). Do not invent extra Smalls under parked 7, 8, 11, 12, 13.
 * Tether-P is the public First Spark lane (docs and QA).
 * Art suggestions belong in Open Questions; Tether-9 is the art section.
 * Do not recreate Tether-P.1, P.2, P.2.1-P.2.6, P.3.1, or P.4.
 * Staff Only only on: Tether-10 and children, Tether-3.2, Tether-9.1, Tether-P.3 / P.3.2.
 * Do not make Tether-2 or Tether-10 claimable.
 */

export const TETHER_V06_VERSION = 'v0.6';
export const TETHER_V06_PROJECT_SLUG = 'tether';

/** Titles that belong to the v0.6 tree (Tether-1…13 or Tether-P). */
export const TETHER_V06_TITLE_RE = /^Tether-(P|CD|[1-9]|1[0-3])([. ]|$)/;

export function isTetherV06Title(title) {
  return TETHER_V06_TITLE_RE.test(String(title || '').trim());
}

function t(partial) {
  return partial;
}

/** @type {Array<{
 *  code: string,
 *  parentCode: string|null,
 *  shortTitle: string,
 *  state: 'Staff Only'|'Blocked'|'Parked'|'Ready'|'Done',
 *  size: 'First Spark'|'Small'|'Medium',
 *  skill: 'Code'|'Art'|'Design'|'Writing'|'Level Design'|'Audio'|'QA'|'Community'|'Other',
 *  purpose: string,
 *  output?: string,
 *  dod?: string[],
 *  blocker?: string,
 *  blockedByCode?: string,
 *  staffNote?: string,
 *  extra?: string,
 *  completed?: boolean,
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
    shortTitle: 'First Spark',
    state: 'Ready',
    size: 'First Spark',
    skill: 'QA',
    purpose:
      'Public First Spark lane: docs and QA. Art suggestions go in Open Questions. Tether-9 is the art section. Networking stays Tether-10.',
    sortOrder: 15,
  }),
  t({
    code: 'Tether-P.3',
    parentCode: 'Tether-P',
    shortTitle: 'QA templates',
    state: 'Staff Only',
    size: 'First Spark',
    skill: 'QA',
    purpose: 'Templates for the first beam playtests. Staff Only.',
    completed: true,
    sortOrder: 20,
  }),
  t({
    code: 'Tether-P.3.2',
    parentCode: 'Tether-P.3',
    shortTitle: 'Playtest note template',
    state: 'Staff Only',
    size: 'First Spark',
    skill: 'QA',
    purpose:
      'Write Docs/qa/PlaytestNote.md with fields: date, build, testers, what felt good, what broke, recommended task change (not a new feature).',
    output: 'Docs/qa/PlaytestNote.md.',
    dod: [
      'Docs/qa/PlaytestNote.md exists with date, build, testers, what felt good, what broke, and recommended task change (not a new feature).',
    ],
    completed: true,
    sortOrder: 20,
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
    code: 'Tether-2.1.0',
    parentCode: 'Tether-2.1',
    shortTitle: 'Prototype graybox',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Level Design',
    purpose:
      'The live Unreal map TetherPrototype is a black void. Build a walkable graybox before stand-ins or the tether line. Follow Docs/TetherPrototype.md. No art, enemies, resources, or Level 1 work.',
    output:
      'A walkable Content/Tether/Maps/TetherPrototype instead of a void: lit floor, collision, 200 cm tiles, at least 20 x 20 m, one ledge 250 to 400 cm high, two Player Starts about 300 cm apart.',
    dod: [
      'Map is lit.',
      'Floor holds a pawn.',
      'Ledge exists (250 to 400 cm).',
      'Two Player Starts exist about 300 cm apart.',
      'Editor opens Content/Tether/Maps/TetherPrototype.',
    ],
    sortOrder: 0,
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
    blocker: 'Do not start until a TetherPrototype graybox exists.',
    blockedByCode: 'Tether-2.1.0',
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
    blocker: 'Do not start until a TetherPrototype graybox exists.',
    blockedByCode: 'Tether-2.1.0',
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
    state: 'Ready',
    size: 'Medium',
    skill: 'Code',
    purpose:
      'Tether-aware movement. Epic 2 playtest is treated as passed. Community claims Tether-3.1. Staff retune pull on Tether-3.2.',
    sortOrder: 30,
  }),
  t({
    code: 'Tether-3.1',
    parentCode: 'Tether-3',
    shortTitle: 'Core locomotion and camera',
    state: 'Ready',
    size: 'Medium',
    skill: 'Code',
    purpose:
      'Walk, run, jump, ground detect, keyboard and gamepad. Document speeds in Docs/ or TetherRules.txt. Camera is Open: third-person that keeps both pawns readable, or first-person plus a tether cue. Write the choice in Docs/Camera.md. Cite Docs/TetherRules.txt. Do not retune pull, L100, or Tether Health.',
    output: 'Docs/Camera.md plus documented walk/run/jump speeds.',
    dod: [
      'Walk, run, jump, and ground detect work on keyboard and gamepad.',
      'Speeds are documented in Docs/ or TetherRules.txt.',
      'Camera choice is written in Docs/Camera.md.',
      'This card does not retune pull, L100, or Tether Health.',
    ],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-3.2',
    parentCode: 'Tether-3',
    shortTitle: 'Pull/resist and failure-mode tests',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    purpose:
      'Staff retune pull toward partner and optional resist. Community must not retune pull. Failure-mode playtest is Tether-3.2.1.',
    sortOrder: 20,
  }),
  t({
    code: 'Tether-3.2.1',
    parentCode: 'Tether-3.2',
    shortTitle: 'Failure-mode playtest',
    state: 'Blocked',
    size: 'Small',
    skill: 'QA',
    purpose:
      'Playtest failure modes. Do not change TetherRules numbers on this card.',
    output: 'Dated Docs/qa/PlaytestNote.',
    dod: [
      'A dated Docs/qa/PlaytestNote exists.',
      'Tested: one falls off a ledge.',
      'Tested: both jump.',
      'Tested: one sprints / one stands.',
      'TetherRules numbers were not changed on this card.',
    ],
    blocker: 'Waiting on staff pull/resist work on Tether-3.2.',
    blockedByCode: 'Tether-3.2',
    sortOrder: 10,
  }),

  t({
    code: 'Tether-4',
    parentCode: null,
    shortTitle: 'Resources and warp',
    state: 'Blocked',
    size: 'Medium',
    skill: 'Code',
    purpose: 'Resources and warp.',
    blocker: 'Waiting on Tether-3.1 Core locomotion and camera.',
    blockedByCode: 'Tether-3.1',
    sortOrder: 40,
  }),
  t({
    code: 'Tether-4.1',
    parentCode: 'Tether-4',
    shortTitle: 'ResourceNode and carry limit',
    state: 'Blocked',
    size: 'Medium',
    skill: 'Code',
    purpose:
      'ResourceNode prefab, interact volume, carry limit 1 or 2, deliberate drop. Place at least six nodes in the prototype or a test map.',
    dod: [
      'ResourceNode prefab exists with an interact volume.',
      'Carry limit is 1 or 2 with a deliberate drop.',
      'At least six nodes are placed in the prototype or a test map.',
    ],
    blocker: 'Waiting on Tether-3.1 Core locomotion and camera.',
    blockedByCode: 'Tether-3.1',
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
    blocker: 'Waiting on Tether-4.1 ResourceNode and carry limit.',
    blockedByCode: 'Tether-4.1',
    sortOrder: 20,
  }),

  t({
    code: 'Tether-CD',
    parentCode: null,
    shortTitle: 'Community Decisions',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Community',
    purpose:
      'Holds live Open Questions. Each child is a status marker. Nobody claims these cards. People post one suggestion and vote on the Open Questions board. When staff close a vote, update the GDD and then write production Smalls.',
    sortOrder: 45,
  }),
  t({
    code: 'Tether-CD.1',
    parentCode: 'Tether-CD',
    shortTitle: 'Suit and world palette',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Community',
    purpose:
      'Open Question marker. Not claimable work.\n\nPrompt to post on Open Questions:\nThe crew wears future-tech survival suits that have been used. Helmets, packs, manufactured gear, dirt and scuffs. Cool colony tech in the world. The beam carries the energy color. What color palette would look good with that? Stay readable at a distance. No real-world party marks. No slogan decals. One suggestion per reply. Vote the ones you want staff to take seriously.\n\nWhen Adopted: write the palette into Docs/StyleLock.md. Then production art cards may leave Blocked.',
    sortOrder: 10,
  }),
  t({
    code: 'Tether-CD.2',
    parentCode: 'Tether-CD',
    shortTitle: 'What kinds of enemies should we add',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Community',
    purpose:
      'Open Question marker. Not claimable work.\n\nPrompt to post on Open Questions:\nWe want enemies that hinder utility, not a shooter roster. Example jobs: grab a person or the beam, pick a friend up and carry them toward a drop, make a stretch of ground unsafe to linger on, tax the beam without becoming a health-bar boss. What kinds of enemies should we add? Name. What it does to a person or the beam. How the crew answers it together. One enemy per reply.',
    sortOrder: 20,
  }),

  t({
    code: 'Tether-5',
    parentCode: null,
    shortTitle: 'Enemies',
    state: 'Blocked',
    size: 'Medium',
    skill: 'Code',
    purpose:
      'Enemies that stress the tether. Threats whose job is coordination, not a DPS sponge. Latch is one example creature, not the name of this epic.',
    blocker: 'Waiting on Tether-4.2 Checkpoint warp and session total.',
    blockedByCode: 'Tether-4.2',
    sortOrder: 50,
  }),
  t({
    code: 'Tether-5.1',
    parentCode: 'Tether-5',
    shortTitle: 'First utility enemy',
    state: 'Blocked',
    size: 'Medium',
    skill: 'Code',
    purpose:
      'First utility enemy. One example is a grab-the-person-or-beam creature (a Latch): it moves toward a pawn or the tether midpoint, attaches, applies a documented penalty (extra tension, slow, or drain), and shows a clear attached state. Removal is faster when both players use Energy Pulse inside a short window (pair-remove). Playtest with two people and confirm the pair advantage is obvious.',
    dod: [
      'A first utility enemy attaches to a pawn or the tether midpoint with a clear attached state. A grab-the-person-or-beam Latch is one valid example.',
      'A documented penalty applies while attached.',
      'Energy Pulse pair-remove is faster when both players use it in a short window.',
    ],
    blocker: 'Waiting on Tether-4.2 Checkpoint warp and session total.',
    blockedByCode: 'Tether-4.2',
    sortOrder: 10,
  }),

  t({
    code: 'Tether-6',
    parentCode: null,
    shortTitle: 'First playable surface level',
    state: 'Ready',
    size: 'Medium',
    skill: 'Level Design',
    purpose:
      'Maps. First playable surface level. Not blocked by Enemies. Official campaign maps must match Vision, StyleLock, Camera.md, and TetherRules.txt.',
    sortOrder: 60,
  }),
  t({
    code: 'Tether-6.1',
    parentCode: 'Tether-6',
    shortTitle: 'Modular graybox kit plus Level_01_Surface',
    state: 'Ready',
    size: 'Medium',
    skill: 'Level Design',
    purpose:
      'Parent for kit pieces and Level_01_Surface blockout. Claim the Smalls. Not blocked by Enemies.',
    sortOrder: 10,
  }),
  t({
    code: 'Tether-6.1.1',
    parentCode: 'Tether-6.1',
    shortTitle: 'Five modular graybox pieces',
    state: 'Ready',
    size: 'Small',
    skill: 'Level Design',
    purpose: 'Five modular graybox pieces in Content/Tether/Modular.',
    output: 'Content/Tether/Modular with at least five graybox pieces.',
    dod: [
      'At least five modular graybox pieces exist in Content/Tether/Modular.',
    ],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-6.1.2',
    parentCode: 'Tether-6.1',
    shortTitle: 'Block out Level_01_Surface',
    state: 'Blocked',
    size: 'Small',
    skill: 'Level Design',
    purpose:
      'Block out Content/Tether/Maps/Level_01_Surface: start, two traversal sections, resources, one or two enemy points, end checkpoint. Official campaign maps must match Vision, StyleLock, Camera.md, and TetherRules.txt.',
    output: 'Content/Tether/Maps/Level_01_Surface.',
    dod: [
      'Level_01_Surface has a start, two traversal sections, resources, one or two enemy points, and an end checkpoint.',
    ],
    blocker: 'Waiting on Tether-6.1.1 Five modular graybox pieces.',
    blockedByCode: 'Tether-6.1.1',
    sortOrder: 20,
  }),
  t({
    code: 'Tether-6.2',
    parentCode: 'Tether-6',
    shortTitle: 'End-to-end 1-4 player loop',
    state: 'Blocked',
    size: 'Medium',
    skill: 'QA',
    purpose:
      'Recorded 1-4 player loop. Two-window listen server is enough until Tether-10.2 exists. Solo behavior and 3-4 tether topology stay Open.',
    dod: [
      'A recorded successful 1-4 player run exists.',
      'Two-window listen server is enough until Tether-10.2 exists.',
    ],
    blocker: 'Waiting on Tether-6.1.2 Block out Level_01_Surface.',
    blockedByCode: 'Tether-6.1.2',
    sortOrder: 20,
  }),
  t({
    code: 'Tether-6.3',
    parentCode: 'Tether-6',
    shortTitle: 'Unofficial community maps',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Level Design',
    purpose:
      'Lane for unofficial maps. Output Content/Tether/Maps/Community/ plus a short note (author, intended player count, what the line is asked to do). Off-campaign but playable maps stay in that folder. Off-brand work (nuke the map, and similar) is declined, not filed as unofficial. Not blocked by Enemies.',
    output: 'Content/Tether/Maps/Community/ with a short author note per map.',
    dod: [
      'Unofficial playable maps live in Content/Tether/Maps/Community/.',
      'Each map has a short note: author, intended player count, what the line is asked to do.',
      'Off-brand work is declined, not filed as unofficial.',
    ],
    sortOrder: 30,
  }),

  t({
    code: 'Tether-7',
    parentCode: null,
    shortTitle: 'Tools, upgrades, between-level flow',
    state: 'Parked',
    size: 'Medium',
    skill: 'Code',
    purpose: 'Parked chapter. Do not invent extra Smalls.',
    blocker: 'Parked until Epic 6 is playtested.',
    blockedByCode: 'Tether-6',
    sortOrder: 70,
  }),
  t({
    code: 'Tether-7.1',
    parentCode: 'Tether-7',
    shortTitle: 'Upgrade screen',
    state: 'Parked',
    size: 'Medium',
    skill: 'Design',
    purpose: 'Parked chapter card: upgrade screen. Do not invent extra Smalls.',
    blocker: 'Parked until Epic 6 is playtested.',
    blockedByCode: 'Tether-6',
    sortOrder: 10,
  }),
  t({
    code: 'Tether-7.2',
    parentCode: 'Tether-7',
    shortTitle: 'First upgrades',
    state: 'Parked',
    size: 'Medium',
    skill: 'Code',
    purpose: 'Parked chapter card: first upgrades — max distance, Anchor, Shared Reinforcer. Do not invent extra Smalls.',
    blocker: 'Parked until Epic 6 is playtested.',
    blockedByCode: 'Tether-6',
    sortOrder: 20,
  }),

  t({
    code: 'Tether-8',
    parentCode: null,
    shortTitle: 'Final station sequence',
    state: 'Parked',
    size: 'Medium',
    skill: 'Level Design',
    purpose: 'Parked chapter. Do not invent extra Smalls.',
    blocker: 'Parked until Epic 6 is playtested.',
    blockedByCode: 'Tether-6',
    sortOrder: 80,
  }),
  t({
    code: 'Tether-8.1',
    parentCode: 'Tether-8',
    shortTitle: 'Station blockout',
    state: 'Parked',
    size: 'Medium',
    skill: 'Level Design',
    purpose: 'Parked chapter card: station blockout. Do not invent extra Smalls.',
    blocker: 'Parked until Epic 6 is playtested.',
    blockedByCode: 'Tether-6',
    sortOrder: 10,
  }),
  t({
    code: 'Tether-8.2',
    parentCode: 'Tether-8',
    shortTitle: 'Creature drive-off',
    state: 'Parked',
    size: 'Medium',
    skill: 'Code',
    purpose: 'Parked chapter card: creature drive-off. Do not invent extra Smalls.',
    blocker: 'Parked until Epic 6 is playtested.',
    blockedByCode: 'Tether-6',
    sortOrder: 20,
  }),

  t({
    code: 'Tether-9',
    parentCode: null,
    shortTitle: 'Art pipeline',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Art',
    purpose:
      'Art pipeline. Production final assets wait on Tether-CD.1 (palette Adopted into StyleLock.md). Art exploration replies belong on that Open Question, not as a separate public art epic.',
    sortOrder: 90,
  }),
  t({
    code: 'Tether-9.1',
    parentCode: 'Tether-9',
    shortTitle: 'Style lock approval',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Art',
    purpose:
      'Staff approve StyleLock.md after Tether-CD.1 is Adopted (palette, silhouettes, materials). StyleLock.md stays Draft until staff accept.',
    output: 'Docs/StyleLock.md accepted by staff.',
    dod: [
      'Staff accept Docs/StyleLock.md.',
      'Until then StyleLock.md stays Draft.',
    ],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-9.2',
    parentCode: 'Tether-9',
    shortTitle: 'Core final assets',
    state: 'Blocked',
    size: 'Medium',
    skill: 'Art',
    purpose:
      'Core final assets. Blocked on Tether-CD.1 Suit and world palette only. Not on Enemies. Not on maps.',
    blocker: 'Waiting on Tether-CD.1 Suit and world palette.',
    blockedByCode: 'Tether-CD.1',
    sortOrder: 20,
  }),

  t({
    code: 'Tether-10',
    parentCode: null,
    shortTitle: 'Networking foundation',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    purpose: 'Networking foundation. Staff Only. Not claimable.',
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
      'Two-window pawn + beam sync. Do not require two machines. Default candidate: Iris on UE 5.8.',
    extra: 'Founder-owned. Staff Only Done.',
    completed: true,
    sortOrder: 10,
  }),
  t({
    code: 'Tether-10.2',
    parentCode: 'Tether-10',
    shortTitle: 'Two-machine test on TetherPrototype',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    purpose: 'Two-machine test on TetherPrototype. Deferred.',
    extra: 'Founder-owned.',
    blocker: 'Two-machine test deferred.',
    sortOrder: 20,
  }),

  t({
    code: 'Tether-11',
    parentCode: null,
    shortTitle: 'UI',
    state: 'Parked',
    size: 'Medium',
    skill: 'Design',
    purpose: 'Parked chapter. Do not invent extra Smalls.',
    blocker: 'Parked until Epic 6 is playtested.',
    blockedByCode: 'Tether-6',
    sortOrder: 110,
  }),
  t({
    code: 'Tether-12',
    parentCode: null,
    shortTitle: 'Audio',
    state: 'Parked',
    size: 'Medium',
    skill: 'Audio',
    purpose: 'Parked chapter. Do not invent extra Smalls.',
    blocker: 'Parked until Epic 6 is playtested.',
    blockedByCode: 'Tether-6',
    sortOrder: 120,
  }),
  t({
    code: 'Tether-13',
    parentCode: null,
    shortTitle: 'Playtesting and polish',
    state: 'Parked',
    size: 'Medium',
    skill: 'QA',
    purpose: 'Parked chapter. Do not invent extra Smalls.',
    blocker: 'Parked until Epic 6 is playtested.',
    blockedByCode: 'Tether-6',
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

export function tetherV06Completed(task) {
  return Boolean(task?.completed) || task?.state === 'Done';
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
