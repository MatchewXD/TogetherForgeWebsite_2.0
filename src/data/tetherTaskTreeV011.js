/**
 * Tether-4 and Tether-5 from Tether_Task_Breakdown_v0.11.
 * Staging-board import source. Upsert by title / ID prefix.
 * Do not publish. Do not add Epic 11. Do not nest Tether-5 under Tether-4.
 * Snatch is the first enemy (5.1). Latch is 5.2.
 */

export const TETHER_V011_VERSION = 'v0.11';
export const TETHER_V011_PROJECT_SLUG = 'tether';
export const TETHER_V011_SOURCE = 'Tether_Task_Breakdown_v0.11';

/** Titles this pass owns (Tether-4 and Tether-5 only). */
export const TETHER_V011_TITLE_RE = /^Tether-[45]([. ]|$)/;

export function isTetherV011Title(title) {
  return TETHER_V011_TITLE_RE.test(String(title || '').trim());
}

function t(partial) {
  return partial;
}

/** @type {Array<{
 *  code: string,
 *  parentCode: string|null,
 *  shortTitle: string,
 *  state: 'Staff Only'|'Blocked'|'Ready'|'In Review'|'Done',
 *  size: 'Small'|'Medium',
 *  skill: 'Code'|'Art'|'Design'|'Writing'|'Level Design'|'Audio'|'QA'|'Community'|'Other',
 *  staffOnly: boolean,
 *  purpose: string,
 *  output?: string,
 *  dod?: string[],
 *  blocker?: string,
 *  blockedByCode?: string,
 *  extra?: string,
 *  sortOrder: number,
 * }>} */
export const TETHER_V011_TASKS = [
  t({
    code: 'Tether-4',
    parentCode: null,
    shortTitle: 'Resources and warp',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Staff or trusted. Graybox. Can run beside maps. Carry weight vs L100 stays Open.',
    extra: 'Source: Tether_Task_Breakdown_v0.11. Staging only. Do not publish.',
    sortOrder: 40,
  }),
  t({
    code: 'Tether-4.1',
    parentCode: 'Tether-4',
    shortTitle: 'Resource nodes',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Resource nodes the crew can pick up and carry.',
    sortOrder: 10,
  }),
  t({
    code: 'Tether-4.1.1',
    parentCode: 'Tether-4.1',
    shortTitle: 'ResourceNode prefab and interact',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Prefab a ResourceNode the player can interact with. Output in the Tether content tree used by Epic 4. Graybox only.',
    output: 'Graybox ResourceNode prefab in the Tether content tree used by Epic 4.',
    dod: [
      'A ResourceNode prefab exists that the player can interact with.',
      'Output lives in the Tether content tree used by Epic 4.',
      'Graybox only. No final mesh.',
    ],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-4.1.2',
    parentCode: 'Tether-4.1',
    shortTitle: 'Carry 1 or 2 and deliberate drop',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'A pawn can carry 1 or 2 nodes and drop on purpose. No accidental lose-on-bump unless a later rule says so.',
    dod: [
      'A pawn can carry 1 or 2 nodes.',
      'The pawn can drop a node on purpose.',
      'Nodes are not lost on bump unless a later rule says so.',
    ],
    sortOrder: 20,
  }),
  t({
    code: 'Tether-4.1.3',
    parentCode: 'Tether-4.1',
    shortTitle: 'Place six nodes on a test map',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Level Design',
    staffOnly: true,
    purpose: 'At least six nodes on the Epic 4 test map.',
    output: 'Epic 4 test map with at least six ResourceNode instances.',
    dod: ['At least six nodes are placed on the Epic 4 test map.'],
    sortOrder: 30,
  }),
  t({
    code: 'Tether-4.2',
    parentCode: 'Tether-4',
    shortTitle: 'Warp',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Warp banks carried resources into the session total.',
    sortOrder: 20,
  }),
  t({
    code: 'Tether-4.2.1',
    parentCode: 'Tether-4.2',
    shortTitle: 'Warp transfers carry to session total',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Using warp moves carried resources onto the session total and clears carry.',
    dod: [
      'Warp moves carried resources onto the session total.',
      'Carry is cleared after a successful warp.',
    ],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-4.2.2',
    parentCode: 'Tether-4.2',
    shortTitle: 'Placeholder confirm',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'A readable confirm when warp accepts the carry.',
    dod: ['A readable confirm plays when warp accepts the carry.'],
    sortOrder: 20,
  }),
  t({
    code: 'Tether-4.2.3',
    parentCode: 'Tether-4.2',
    shortTitle: 'Visible running total',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Session total stays visible after warp.',
    dod: ['The session total stays visible after warp.'],
    sortOrder: 30,
  }),

  t({
    code: 'Tether-5',
    parentCode: null,
    shortTitle: 'Enemies',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Current work. Pressure the net. Tools and shields live on Epic 11, which is out of this pass. Lmax hold already exists from Epic 2. If a creature pulls a pawn to the end of the line, that existing hold stops travel and the creature keeps straining. Maps may leave spawn markers and wire a creature later.',
    extra:
      'Canon for numbers later: Docs/Enemies.md in the Tether repo. Beam numbers stay in Docs/TetherRules.txt. Source: Tether_Task_Breakdown_v0.11. Staging only. Do not publish. Does not block Tether-4 or Tether-6.',
    sortOrder: 50,
  }),
  t({
    code: 'Tether-5.0',
    parentCode: 'Tether-5',
    shortTitle: 'Shared enemy kit',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'One base every starter creature uses. Until Hand Spark exists, staff debug apply-damage is enough to test stagger.',
    sortOrder: 5,
  }),
  t({
    code: 'Tether-5.0.1',
    parentCode: 'Tether-5.0',
    shortTitle: 'Enemy base',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Content/Tether/Enemies/ base actor or component. Fields: health, stagger step, stagger lockout, held pawn, current job. Collision a pawn and a trace can hit. Done when a dummy takes debug damage, staggers, and prints its job.',
    output: 'Content/Tether/Enemies/ base actor or component.',
    dod: [
      'Base actor or component exists under Content/Tether/Enemies/.',
      'Fields exist: health, stagger step, stagger lockout, held pawn, current job.',
      'Collision can be hit by a pawn and a trace.',
      'A dummy takes debug damage, staggers, and prints its job.',
    ],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-5.0.2',
    parentCode: 'Tether-5.0',
    shortTitle: 'Health and stagger',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Shared component. Each creature sets its own max health and stagger step. On stagger: stop moving a few seconds, drop anything held, readable cue. Starting lockout 2.5s unless a creature card says otherwise. Staff debug print allowed.',
    dod: [
      'Shared health and stagger component exists.',
      'Each creature sets its own max health and stagger step.',
      'On stagger the creature stops moving a few seconds, drops anything held, and shows a readable cue.',
      'Starting lockout is 2.5s unless a creature card says otherwise.',
    ],
    sortOrder: 20,
  }),
  t({
    code: 'Tether-5.0.3',
    parentCode: 'Tether-5.0',
    shortTitle: 'Hit pipeline',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Accept damage from player tools and from staff debug apply-damage. Hit flash or short flinch. Distinct stagger pose or color on threshold. Friendly fire off. Does not create a weapon.',
    dod: [
      'Damage is accepted from player tools and from staff debug apply-damage.',
      'A hit flash or short flinch plays.',
      'Stagger threshold has a distinct pose or color.',
      'Friendly fire is off.',
      'This card does not create a weapon.',
    ],
    sortOrder: 30,
  }),
  t({
    code: 'Tether-5.0.4',
    parentCode: 'Tether-5.0',
    shortTitle: 'Spawn marker',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Content/Tether/Enemies/BP_EnemySpawn. Fields: enemy type, count, radius. Maps may place it without wiring behavior. Tick groups use count > 1. Snatch, Latch, Guard default to 1.',
    output: 'Content/Tether/Enemies/BP_EnemySpawn.',
    dod: [
      'BP_EnemySpawn exists under Content/Tether/Enemies/.',
      'Fields exist: enemy type, count, radius.',
      'Maps may place it without wiring behavior.',
      'Tick groups use count > 1. Snatch, Latch, and Guard default to 1.',
    ],
    sortOrder: 40,
  }),
  t({
    code: 'Tether-5.0.5',
    parentCode: 'Tether-5.0',
    shortTitle: 'Docs/Enemies.md',
    state: 'Ready',
    size: 'Small',
    skill: 'Writing',
    staffOnly: false,
    purpose:
      'One page in the Tether repo: starter roster, per-creature numbers, target pick, Downed-from-drop, what CD.2 is for. Point at Docs/Tools.md for Hand Spark and shields. Link from README.',
    output: 'Docs/Enemies.md in the Tether repo, linked from README.',
    dod: [
      'Docs/Enemies.md exists in the Tether repo.',
      'It covers starter roster, per-creature numbers, target pick, Downed-from-drop, and what CD.2 is for.',
      'It points at Docs/Tools.md for Hand Spark and shields.',
      'README links Docs/Enemies.md.',
    ],
    sortOrder: 50,
  }),
  t({
    code: 'Tether-5.0.6',
    parentCode: 'Tether-5.0',
    shortTitle: 'Enemy QA sheet',
    state: 'Ready',
    size: 'Small',
    skill: 'QA',
    staffOnly: false,
    purpose: 'Docs/qa/EnemyNote.md using the PlaytestNote shape. One row per starter enemy.',
    output: 'Docs/qa/EnemyNote.md.',
    dod: [
      'Docs/qa/EnemyNote.md exists using the PlaytestNote shape.',
      'There is one row per starter enemy.',
    ],
    sortOrder: 60,
  }),

  t({
    code: 'Tether-5.1',
    parentCode: 'Tether-5',
    shortTitle: 'Snatch',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'First enemy. Beginner flyer. Working name Snatch. Latch is 5.2.\n\nWhat it does:\nFlies a loose patrol. When close to a player it stops and watches a few seconds, then dives to grab one person. On touch, that pawn is grabbed. Snatch tries to drop them off a high place. If there is no high place it flies up a ways and drops them. Carry is slow enough the crew can act. When the beam hits Lmax the existing hold stops travel. Snatch keeps pulling and straining for the normal hang window. That struggle is the attack window. If the hang ends and Snatch was not staggered or killed, existing snap or drain can kill the beam and Snatch may finish the drop. 1000 health, stagger every 100. Stagger stops it and drops whoever it holds. If the drop downs a player, Snatch stops hunting everyone else, flies to the body, and eats. Attacked while eating: fly away a short while, return to the body, keep eating, leave the rest of the crew alone. If the crew fights it far from the body it returns to Hunt until it dies or they leave it alone long enough to go back to eating.',
    sortOrder: 10,
  }),
  t({
    code: 'Tether-5.1.1',
    parentCode: 'Tether-5.1',
    shortTitle: 'Graybox body and spawn',
    state: 'Ready',
    size: 'Small',
    skill: 'Art',
    staffOnly: false,
    purpose:
      'Readable flying silhouette, bigger than a pawn, wings or a lift sac. Content/Tether/Enemies/Snatch/. Body collision plus a grab volume in front.',
    output: 'Content/Tether/Enemies/Snatch/ graybox body with grab volume.',
    dod: [
      'A readable flying silhouette exists, bigger than a pawn, with wings or a lift sac.',
      'Assets live under Content/Tether/Enemies/Snatch/.',
      'Body collision plus a grab volume in front.',
    ],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-5.1.2',
    parentCode: 'Tether-5.1',
    shortTitle: 'Fly and patrol',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Hover and fly between points or a radius around spawn. Does not clip floors. May pass over gaps. Crew can keep up on foot if they commit. Write fly speed into Docs/Enemies.md after the first playtest.',
    dod: [
      'Snatch hovers and flies between points or a radius around spawn.',
      'It does not clip floors and may pass over gaps.',
      'Crew can keep up on foot if they commit.',
      'Fly speed is written into Docs/Enemies.md after the first playtest.',
    ],
    sortOrder: 20,
  }),
  t({
    code: 'Tether-5.1.3',
    parentCode: 'Tether-5.1',
    shortTitle: 'Detect, watch, dive',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Starting aggro about 18m. Watch about 2.5s with a readable lean or eye cue. Dive can miss. Miss returns to hover after a short cool-down. Target pick: prefer a pawn farther from the group center. If everyone is stacked, nearest. Solo answer stays Open.',
    dod: [
      'Starting aggro is about 18m.',
      'Watch is about 2.5s with a readable lean or eye cue.',
      'Dive can miss and miss returns to hover after a short cool-down.',
      'Target pick prefers a pawn farther from the group center; if everyone is stacked, nearest.',
      'Solo answer stays Open.',
    ],
    sortOrder: 30,
  }),
  t({
    code: 'Tether-5.1.4',
    parentCode: 'Tether-5.1',
    shortTitle: 'Grab, carry, and keep pulling',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'On touch during dive, attach the pawn to a hold socket. Pawn cannot walk. Pawn can still look and fire once Hand Spark exists. Carry is deliberate. Grabbed pawn stays on the beam. Existing beam rules own length, pull, Lmax, hang, and snap. At Lmax, Snatch keeps trying to fly away. Animate strain. One Snatch holds one pawn.',
    dod: [
      'On touch during dive the pawn attaches to a hold socket.',
      'The grabbed pawn cannot walk and stays on the beam.',
      'Existing beam rules own length, pull, Lmax, hang, and snap.',
      'At Lmax, Snatch keeps trying to fly away and animates strain.',
      'One Snatch holds one pawn.',
    ],
    sortOrder: 40,
  }),
  t({
    code: 'Tether-5.1.5',
    parentCode: 'Tether-5.1',
    shortTitle: 'Drop targeting',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'If a tagged high place exists (ledge volume or drop marker), fly there and release. If none exists, fly up about 8 to 12m above the grab point and release. Release is a drop. Map helpers may place BP_SnatchDropMarker volumes.',
    dod: [
      'If a tagged high place exists, Snatch flies there and releases.',
      'If none exists, it flies up about 8 to 12m above the grab point and releases.',
      'Release is a drop.',
      'Map helpers may place BP_SnatchDropMarker volumes.',
    ],
    sortOrder: 50,
  }),
  t({
    code: 'Tether-5.1.6',
    parentCode: 'Tether-5.1',
    shortTitle: 'Health, stagger, drop on stagger',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      '1000 health, stagger every 100. Stagger always drops a held pawn. After lockout: Hunt if the body is not downed. Eat if a downed body exists and no one is hitting Snatch.',
    dod: [
      'Snatch has 1000 health and staggers every 100.',
      'Stagger always drops a held pawn.',
      'After lockout: Hunt if the body is not downed; Eat if a downed body exists and no one is hitting Snatch.',
    ],
    sortOrder: 60,
  }),
  t({
    code: 'Tether-5.1.7',
    parentCode: 'Tether-5.1',
    shortTitle: 'Downed-from-drop',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'A Snatch drop from a marked high place or from the fly-up height puts that pawn in Downed. Downed cannot walk. Teammates can see the body. A flag and a pose are enough. Revive stays Open. Playtest reset or end session is allowed. Write the Open in Docs/Enemies.md.',
    dod: [
      'A drop from a marked high place or the fly-up height puts that pawn in Downed.',
      'Downed cannot walk and teammates can see the body.',
      'A flag and a pose are enough. Revive stays Open.',
      'The Open is written in Docs/Enemies.md.',
    ],
    sortOrder: 70,
  }),
  t({
    code: 'Tether-5.1.8',
    parentCode: 'Tether-5.1',
    shortTitle: 'Eat loop',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'On a downing drop: cancel Hunt on everyone else, fly to the body, eat. Damaged during Eat: flee a short way, then return to the same body. Fought far from the body: Hunt the living crew until dead or left alone long enough to return to Eat. If the body is gone, Hunt.',
    dod: [
      'A downing drop cancels Hunt on everyone else; Snatch flies to the body and eats.',
      'Damaged during Eat: flee a short way, then return to the same body.',
      'Fought far from the body: Hunt the living crew until dead or left alone long enough to return to Eat.',
      'If the body is gone, Hunt.',
    ],
    sortOrder: 80,
  }),
  t({
    code: 'Tether-5.1.9',
    parentCode: 'Tether-5.1',
    shortTitle: 'Death and cleanup',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'At 0 health: drop anything held, short death, despawn or graybox corpse.',
    dod: [
      'At 0 health Snatch drops anything held.',
      'A short death plays, then despawn or a graybox corpse.',
    ],
    sortOrder: 90,
  }),
  t({
    code: 'Tether-5.1.10',
    parentCode: 'Tether-5.1',
    shortTitle: 'SnatchYard',
    state: 'Ready',
    size: 'Small',
    skill: 'Level Design',
    staffOnly: false,
    purpose:
      'Graybox yard: flat floor, one high ledge with a SnatchDropMarker, two spawn markers, room to stretch to Lmax. Content/Tether/Maps/Enemy_SnatchYard or a named sublevel on TetherPrototype.',
    output:
      'Content/Tether/Maps/Enemy_SnatchYard or a named sublevel on TetherPrototype.',
    dod: [
      'A graybox yard exists with a flat floor, one high ledge with a SnatchDropMarker, two spawn markers, and room to stretch to Lmax.',
      'It lives at Content/Tether/Maps/Enemy_SnatchYard or a named sublevel on TetherPrototype.',
    ],
    sortOrder: 100,
  }),
  t({
    code: 'Tether-5.1.11',
    parentCode: 'Tether-5.1',
    shortTitle: 'Concept and graybox art',
    state: 'Ready',
    size: 'Small',
    skill: 'Art',
    staffOnly: false,
    purpose:
      '2 to 4 concept stills or a turnaround. Cite StyleLock. Hostile planet creature. Improved graybox with grab pose and eat pose. Hero mesh, materials, and anim set stay Blocked on CD.1. Do not put the hero mesh on this card as Ready work.',
    dod: [
      '2 to 4 concept stills or a turnaround exist and cite StyleLock.',
      'Improved graybox has a grab pose and an eat pose.',
      'Hero mesh, materials, and anim set are not Ready work on this card; they stay Blocked on CD.1.',
    ],
    sortOrder: 110,
  }),
  t({
    code: 'Tether-5.1.12',
    parentCode: 'Tether-5.1',
    shortTitle: 'Placeholder audio and VFX',
    state: 'Ready',
    size: 'Small',
    skill: 'Audio',
    staffOnly: false,
    purpose:
      'Cues: patrol wing, watch hiss, dive, grab, strain against the line, stagger, drop, eat, flee. Placeholder wav or MetaSound on at least watch, grab, stagger, and eat. Production mix stays Epic 12.',
    dod: [
      'Placeholder cues exist for patrol wing, watch hiss, dive, grab, strain, stagger, drop, eat, and flee.',
      'Placeholder wav or MetaSound covers at least watch, grab, stagger, and eat.',
      'Production mix stays Epic 12.',
    ],
    sortOrder: 120,
  }),
  t({
    code: 'Tether-5.1.13',
    parentCode: 'Tether-5.1',
    shortTitle: 'Snatch net replicate',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Replicate job, health, held pawn, and transform. Follow Epic 10. Two-window listen server is enough. Two-machine stays deferred with 10.2.',
    dod: [
      'Job, health, held pawn, and transform replicate.',
      'Follows Epic 10. Two-window listen server is enough.',
      'Two-machine stays deferred with 10.2.',
    ],
    sortOrder: 130,
  }),
  t({
    code: 'Tether-5.1.14',
    parentCode: 'Tether-5.1',
    shortTitle: 'Snatch playtest',
    state: 'Staff Only',
    size: 'Small',
    skill: 'QA',
    staffOnly: true,
    purpose:
      'Two or more people. Docs/qa/EnemyNote.md. Must pass: watch readable, grab can miss, existing Lmax hold stops travel while Snatch keeps straining, stagger drops the held pawn, four people stagger it more than one person, eat starts only after a downing drop, hit-during-eat flees then returns, fight-away-from-body returns to Hunt. Medium 5.1 is Done only after this write-up.',
    output: 'Docs/qa/EnemyNote.md write-up for Snatch.',
    dod: [
      'Playtest used two or more people and wrote Docs/qa/EnemyNote.md.',
      'Watch is readable and grab can miss.',
      'Existing Lmax hold stops travel while Snatch keeps straining.',
      'Stagger drops the held pawn; four people stagger it more than one person.',
      'Eat starts only after a downing drop; hit-during-eat flees then returns; fight-away-from-body returns to Hunt.',
      'Medium 5.1 is marked Done only after this write-up.',
    ],
    sortOrder: 140,
  }),

  t({
    code: 'Tether-5.2',
    parentCode: 'Tether-5',
    shortTitle: 'Latch',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Fast closer. Runs at people, lunges, rides one pawn. Not the first enemy.\n\nWhat it does:\nMoves quickly and lunges. On grab it latches on and slows that player a lot. Bites and scratches until that player is dead. Then eats the body and ignores other players unless attacked. If left alone it keeps eating that body for the rest of the round.',
    sortOrder: 20,
  }),
  t({
    code: 'Tether-5.2.1',
    parentCode: 'Tether-5.2',
    shortTitle: 'Latch graybox',
    state: 'Ready',
    size: 'Small',
    skill: 'Art',
    staffOnly: false,
    purpose:
      "Low, clingy, readable on a pawn's back or chest. Content/Tether/Enemies/Latch/.",
    output: 'Content/Tether/Enemies/Latch/ graybox.',
    dod: [
      "Graybox is low, clingy, and readable on a pawn's back or chest.",
      'Assets live under Content/Tether/Enemies/Latch/.',
    ],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-5.2.2',
    parentCode: 'Tether-5.2',
    shortTitle: 'Fast move and lunge',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Fast ground move plus a lunge. Lunge can miss. Miss has a short recover.',
    dod: [
      'Latch has a fast ground move plus a lunge.',
      'Lunge can miss and miss has a short recover.',
    ],
    sortOrder: 20,
  }),
  t({
    code: 'Tether-5.2.3',
    parentCode: 'Tether-5.2',
    shortTitle: 'Latch-on and slow',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Significant slow on the ridden pawn. Pawn can still look and fire.',
    dod: [
      'The ridden pawn is significantly slowed.',
      'The pawn can still look and fire.',
    ],
    sortOrder: 30,
  }),
  t({
    code: 'Tether-5.2.4',
    parentCode: 'Tether-5.2',
    shortTitle: 'Bite and scratch',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Small hits on a timer until the pawn is Downed. Write the tick in Docs/Enemies.md.',
    dod: [
      'Small hits land on a timer until the pawn is Downed.',
      'The tick is written in Docs/Enemies.md.',
    ],
    sortOrder: 40,
  }),
  t({
    code: 'Tether-5.2.5',
    parentCode: 'Tether-5.2',
    shortTitle: 'Eat body',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Eats for the rest of the round if left alone. Attacked while eating: fight the attacker, then return to the body if left alone again.',
    dod: [
      'If left alone, Latch eats for the rest of the round.',
      'Attacked while eating: fight the attacker, then return to the body if left alone again.',
    ],
    sortOrder: 50,
  }),
  t({
    code: 'Tether-5.2.6',
    parentCode: 'Tether-5.2',
    shortTitle: 'Latch health',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: '400 health, stagger every 100. Stagger knocks it off the pawn.',
    dod: [
      'Latch has 400 health and staggers every 100.',
      'Stagger knocks it off the pawn.',
    ],
    sortOrder: 60,
  }),
  t({
    code: 'Tether-5.2.7',
    parentCode: 'Tether-5.2',
    shortTitle: 'Latch concept and audio',
    state: 'Ready',
    size: 'Small',
    skill: 'Art',
    staffOnly: false,
    purpose:
      'Concept, graybox art, placeholder audio: scurry, lunge, latch, bite, eat. Hero mesh Blocked on CD.1.',
    dod: [
      'Concept and graybox art exist.',
      'Placeholder audio covers scurry, lunge, latch, bite, and eat.',
      'Hero mesh stays Blocked on CD.1.',
    ],
    sortOrder: 70,
  }),
  t({
    code: 'Tether-5.2.8',
    parentCode: 'Tether-5.2',
    shortTitle: 'Latch QA',
    state: 'Ready',
    size: 'Small',
    skill: 'QA',
    staffOnly: false,
    purpose:
      'Slow is obvious. Solo peel is possible but ugly. Two people shooting it off is the clean answer. Eat lasts the round if ignored.',
    dod: [
      'Slow is obvious in playtest.',
      'Solo peel is possible but ugly; two people shooting it off is the clean answer.',
      'Eat lasts the round if ignored.',
    ],
    sortOrder: 80,
  }),

  t({
    code: 'Tether-5.3',
    parentCode: 'Tether-5',
    shortTitle: 'Tick',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Small swarm pests. Weak alone. Dangerous in a group. Eat the line and the shields first, then the person.\n\nWhat it does:\nTravel in groups. Hide in small pockets, cracks, under ledges, and surprise the crew. Crawl the beam and the players\' shields. Try to eat everything they touch. Each try does small damage. On a player who still has a shield, stay on that shield and keep chewing. On a player with no shield, stick and attack until the Tick is killed or that player is dead. When the player is dead, eat the body. Small and hard to hit. Once they have grabbed beam, shield, or body they crawl slowly while they attack.',
    sortOrder: 30,
  }),
  t({
    code: 'Tether-5.3.1',
    parentCode: 'Tether-5.3',
    shortTitle: 'Tick graybox',
    state: 'Ready',
    size: 'Small',
    skill: 'Art',
    staffOnly: false,
    purpose: 'Small. Must read on the beam and on a pawn. Content/Tether/Enemies/Tick/.',
    output: 'Content/Tether/Enemies/Tick/ graybox.',
    dod: [
      'Graybox is small and reads on the beam and on a pawn.',
      'Assets live under Content/Tether/Enemies/Tick/.',
    ],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-5.3.2',
    parentCode: 'Tether-5.3',
    shortTitle: 'Group spawn and hide',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Nest marker drops several Ticks. Starting pack 4 to 8. Hide until the crew is close.',
    dod: [
      'A nest marker drops several Ticks.',
      'Starting pack is 4 to 8.',
      'They hide until the crew is close.',
    ],
    sortOrder: 20,
  }),
  t({
    code: 'Tether-5.3.3',
    parentCode: 'Tether-5.3',
    shortTitle: 'Surprise leave-cover',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Short burst of speed out of the nest, then attach.',
    dod: ['Ticks leave cover with a short burst of speed, then attach.'],
    sortOrder: 30,
  }),
  t({
    code: 'Tether-5.3.4',
    parentCode: 'Tether-5.3',
    shortTitle: 'Crawl the beam',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Small damage to beam health on a timer while attached to the line.',
    dod: ['While attached to the line, a Tick deals small beam-health damage on a timer.'],
    sortOrder: 40,
  }),
  t({
    code: 'Tether-5.3.5',
    parentCode: 'Tether-5.3',
    shortTitle: 'Crawl a shield',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      "Small damage to that pawn's shield on a timer. Uses the shield field Epic 11 will own. Until 11.2 exists, a stand-in shield value on the pawn is enough and must use that same field.",
    dod: [
      "While on a shield, a Tick deals small damage to that pawn's shield on a timer.",
      'Uses the shield field Epic 11 will own. Until 11.2 exists, a stand-in on that same field is enough.',
    ],
    sortOrder: 50,
  }),
  t({
    code: 'Tether-5.3.6',
    parentCode: 'Tether-5.3',
    shortTitle: 'Stick to an unshielded pawn',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Slow crawl on the body. Attack until the pawn is dead or the Tick dies.',
    dod: [
      'On an unshielded pawn the Tick slow-crawls the body.',
      'It attacks until the pawn is dead or the Tick dies.',
    ],
    sortOrder: 60,
  }),
  t({
    code: 'Tether-5.3.7',
    parentCode: 'Tether-5.3',
    shortTitle: 'Tick eat body',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'After that pawn is Downed, eat the body. Ignore others unless attacked.',
    dod: [
      'After that pawn is Downed, the Tick eats the body.',
      'It ignores others unless attacked.',
    ],
    sortOrder: 70,
  }),
  t({
    code: 'Tether-5.3.8',
    parentCode: 'Tether-5.3',
    shortTitle: 'Hard to hit',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Small collision. Hip-fire on a moving Tick should miss often. Once latched, crawl is slow so the crew can peel them.',
    dod: [
      'Collision is small. Hip-fire on a moving Tick misses often.',
      'Once latched, crawl is slow so the crew can peel them.',
    ],
    sortOrder: 80,
  }),
  t({
    code: 'Tether-5.3.9',
    parentCode: 'Tether-5.3',
    shortTitle: 'Tick health',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: '80 to 120 health. One stagger knocks a Tick off beam, shield, or body.',
    dod: [
      'A Tick has 80 to 120 health.',
      'One stagger knocks it off beam, shield, or body.',
    ],
    sortOrder: 90,
  }),
  t({
    code: 'Tether-5.3.10',
    parentCode: 'Tether-5.3',
    shortTitle: 'Nest dressing',
    state: 'Ready',
    size: 'Small',
    skill: 'Level Design',
    staffOnly: false,
    purpose: 'Cracks, underside of a ledge, pipe mouth.',
    dod: ['Nest dressing exists: cracks, underside of a ledge, or a pipe mouth.'],
    sortOrder: 100,
  }),
  t({
    code: 'Tether-5.3.11',
    parentCode: 'Tether-5.3',
    shortTitle: 'Tick concept and audio',
    state: 'Ready',
    size: 'Small',
    skill: 'Art',
    staffOnly: false,
    purpose:
      'Concept, audio (skitter, chew, pack hiss), VFX on beam chew. Hero mesh Blocked on CD.1.',
    dod: [
      'Concept art exists.',
      'Placeholder audio covers skitter, chew, and pack hiss.',
      'VFX plays on beam chew.',
      'Hero mesh stays Blocked on CD.1.',
    ],
    sortOrder: 110,
  }),
  t({
    code: 'Tether-5.3.12',
    parentCode: 'Tether-5.3',
    shortTitle: 'Tick QA',
    state: 'Ready',
    size: 'Small',
    skill: 'QA',
    staffOnly: false,
    purpose:
      'One Tick is a nuisance. A group on the line is a problem. Unshielded stick is worse than shielded chew. Hard to hit until latched.',
    dod: [
      'One Tick is a nuisance; a group on the line is a problem.',
      'Unshielded stick is worse than shielded chew.',
      'Hard to hit until latched.',
    ],
    sortOrder: 120,
  }),

  t({
    code: 'Tether-5.4',
    parentCode: 'Tether-5',
    shortTitle: 'Guard',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Big slow eater. Finds the most valuable resource in its area and sits on it for most of the map. Leave the six Tether-4 cards unchanged. Give the node a value field on the Guard cards that touch it.\n\nWhat it does:\nFinds the most valuable resource in its area and slowly eats it. That item\'s value drops while it is eaten, very slowly. If the players want that resource they have to fight. Moves slowly when going for food. Moves quickly when attacking. Charges in a straight line. Getting hit hurts a lot. If it keeps missing it spits stones or metal balls. Spit animation is predictable. Getting hit still hurts. Walks on walls and ceilings. A charge does not knock it off a ledge. Jump is slow and obvious: stand still, wait, then jump very high and fast to the destination. Only jumps to reach a hard place, in or out of combat.',
    sortOrder: 40,
  }),
  t({
    code: 'Tether-5.4.1',
    parentCode: 'Tether-5.4',
    shortTitle: 'Guard graybox',
    state: 'Ready',
    size: 'Small',
    skill: 'Art',
    staffOnly: false,
    purpose: 'Big. Heavy. Must read on a wall and on a ceiling. Content/Tether/Enemies/Guard/.',
    output: 'Content/Tether/Enemies/Guard/ graybox.',
    dod: [
      'Graybox is big, heavy, and reads on a wall and on a ceiling.',
      'Assets live under Content/Tether/Enemies/Guard/.',
    ],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-5.4.2',
    parentCode: 'Tether-5.4',
    shortTitle: 'Pick and eat the best node',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Pick the highest-value ResourceNode in a radius. Walk to it slowly. Sit and eat.',
    dod: [
      'Guard picks the highest-value ResourceNode in a radius.',
      'It walks there slowly, then sits and eats.',
    ],
    sortOrder: 20,
  }),
  t({
    code: 'Tether-5.4.3',
    parentCode: 'Tether-5.4',
    shortTitle: 'Node value drain',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Give the node a value field. Drain is slow. A full eat should take most of a map-length stay. Warping a carried item is unchanged. Eating a node still in the world lowers what it is worth when picked up. Do not rewrite the six Tether-4 cards for this field.',
    dod: [
      'The node has a value field added from this Guard card, not by rewriting Tether-4.',
      'Drain is slow; a full eat takes most of a map-length stay.',
      'Warping a carried item is unchanged.',
      'Eating a node still in the world lowers what it is worth when picked up.',
    ],
    sortOrder: 30,
  }),
  t({
    code: 'Tether-5.4.4',
    parentCode: 'Tether-5.4',
    shortTitle: 'Aggro on contest',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Aggro when the crew contests the node or hits the Guard.',
    dod: ['Guard aggros when the crew contests the node or hits the Guard.'],
    sortOrder: 40,
  }),
  t({
    code: 'Tether-5.4.5',
    parentCode: 'Tether-5.4',
    shortTitle: 'Straight charge',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Fast straight charge. High damage. Miss recovery is readable.',
    dod: [
      'Guard has a fast straight charge with high damage.',
      'Miss recovery is readable.',
    ],
    sortOrder: 50,
  }),
  t({
    code: 'Tether-5.4.6',
    parentCode: 'Tether-5.4',
    shortTitle: 'Spit after misses',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Spit stones or metal after a documented number of missed charges. Predictable wind-up. High damage.',
    dod: [
      'After a documented number of missed charges, Guard spits stones or metal.',
      'Wind-up is predictable. Damage is high.',
    ],
    sortOrder: 60,
  }),
  t({
    code: 'Tether-5.4.7',
    parentCode: 'Tether-5.4',
    shortTitle: 'Wall and ceiling walk',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Charge along those surfaces stays on the surface.',
    dod: ['A charge along a wall or ceiling stays on that surface.'],
    sortOrder: 70,
  }),
  t({
    code: 'Tether-5.4.8',
    parentCode: 'Tether-5.4',
    shortTitle: 'Tell jump',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Stand, delay, then a high fast jump to a hard-to-reach point. Used to reach food and to reach the crew.',
    dod: [
      'Jump tell is stand, delay, then a high fast jump.',
      'Used to reach food and to reach the crew.',
    ],
    sortOrder: 80,
  }),
  t({
    code: 'Tether-5.4.9',
    parentCode: 'Tether-5.4',
    shortTitle: 'Guard health',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      '800 health, stagger every 200. Stagger interrupts a charge, a spit, and a jump tell.',
    dod: [
      'Guard has 800 health and staggers every 200.',
      'Stagger interrupts a charge, a spit, and a jump tell.',
    ],
    sortOrder: 90,
  }),
  t({
    code: 'Tether-5.4.10',
    parentCode: 'Tether-5.4',
    shortTitle: 'Guard on the six-node map',
    state: 'Ready',
    size: 'Small',
    skill: 'Level Design',
    staffOnly: false,
    purpose:
      'Place at least one Guard on the six-node test map from 4.1.3. That node has the highest value. Other nodes stay clean so Epic 4 still plays without a fight.',
    dod: [
      'At least one Guard is on the six-node test map from 4.1.3.',
      'That node has the highest value.',
      'Other nodes stay clean so Epic 4 still plays without a fight.',
    ],
    sortOrder: 100,
  }),
  t({
    code: 'Tether-5.4.11',
    parentCode: 'Tether-5.4',
    shortTitle: 'Guard concept and audio',
    state: 'Ready',
    size: 'Small',
    skill: 'Art',
    staffOnly: false,
    purpose:
      'Concept, audio (idle chew, charge roar, spit, jump tell), floor-to-wall transition. Hero mesh Blocked on CD.1.',
    dod: [
      'Concept art exists.',
      'Placeholder audio covers idle chew, charge roar, spit, and jump tell.',
      'Floor-to-wall transition reads.',
      'Hero mesh stays Blocked on CD.1.',
    ],
    sortOrder: 110,
  }),
  t({
    code: 'Tether-5.4.12',
    parentCode: 'Tether-5.4',
    shortTitle: 'Guard QA',
    state: 'Ready',
    size: 'Small',
    skill: 'QA',
    staffOnly: false,
    purpose:
      'Value drops while ignored. Charge hurts. Spit is readable. Wall walk holds. Jump tell is obvious. Slow on food, fast on fight.',
    dod: [
      'Value drops while ignored.',
      'Charge hurts. Spit is readable. Wall walk holds. Jump tell is obvious.',
      'Slow on food, fast on fight.',
    ],
    sortOrder: 120,
  }),

  t({
    code: 'Tether-5.5',
    parentCode: 'Tether-5',
    shortTitle: 'Spore',
    state: 'Staff Only',
    size: 'Medium',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Natural trap. Hard to see. Walking onto it snares one player. Vines whip that player until they die. The body stays wrapped until the Spore dies.\n\nWhat it does:\nHard to spot. When walked on, snares a player. A snared player gets whipped by vines until they die. A dead player is wrapped in vines until someone kills the Spore. The trapped player can use a weapon to attack the Spore. One or two players attacking the Spore is slower to kill it than the Spore is to break that player\'s shields. Three or four on the core is the clean answer. Write the numbers so that rule holds.',
    sortOrder: 50,
  }),
  t({
    code: 'Tether-5.5.1',
    parentCode: 'Tether-5.5',
    shortTitle: 'Spore graybox',
    state: 'Ready',
    size: 'Small',
    skill: 'Art',
    staffOnly: false,
    purpose: 'Core plus low foliage that reads late. Content/Tether/Enemies/Spore/.',
    output: 'Content/Tether/Enemies/Spore/ graybox.',
    dod: [
      'Graybox is a core plus low foliage that reads late.',
      'Assets live under Content/Tether/Enemies/Spore/.',
    ],
    sortOrder: 10,
  }),
  t({
    code: 'Tether-5.5.2',
    parentCode: 'Tether-5.5',
    shortTitle: 'Snare volume',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'One pawn at a time in this slice. Snared pawn cannot walk.',
    dod: [
      'One pawn at a time can be snared in this slice.',
      'The snared pawn cannot walk.',
    ],
    sortOrder: 20,
  }),
  t({
    code: 'Tether-5.5.3',
    parentCode: 'Tether-5.5',
    shortTitle: 'Vine whip',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'Whip the snared pawn. Shield first, then the pawn. Same shield field as Ticks.',
    dod: [
      'Vines whip the snared pawn.',
      'Damage hits shield first, then the pawn, using the same shield field as Ticks.',
    ],
    sortOrder: 30,
  }),
  t({
    code: 'Tether-5.5.4',
    parentCode: 'Tether-5.5',
    shortTitle: 'Shield race numbers',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      '1 to 2 players on the core lose the race against shield break. 3 to 4 win it. Curve in Docs/Enemies.md. Shield numbers in Docs/Tools.md.',
    dod: [
      '1 to 2 players on the core lose the race against shield break. 3 to 4 win it.',
      'Curve is written in Docs/Enemies.md. Shield numbers stay in Docs/Tools.md.',
    ],
    sortOrder: 40,
  }),
  t({
    code: 'Tether-5.5.5',
    parentCode: 'Tether-5.5',
    shortTitle: 'Snared player can fire',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose:
      'Snared pawn may fire Hand Spark at the core. That shot counts in the 1 to 2 vs 3 to 4 race.',
    dod: [
      'A snared pawn may fire Hand Spark at the core.',
      'That shot counts in the 1 to 2 vs 3 to 4 race.',
    ],
    sortOrder: 50,
  }),
  t({
    code: 'Tether-5.5.6',
    parentCode: 'Tether-5.5',
    shortTitle: 'Wrap the body',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: 'On Downed, wrap the body in vines until the Spore dies.',
    dod: ['On Downed, the body is wrapped in vines until the Spore dies.'],
    sortOrder: 60,
  }),
  t({
    code: 'Tether-5.5.7',
    parentCode: 'Tether-5.5',
    shortTitle: 'Spore health',
    state: 'Staff Only',
    size: 'Small',
    skill: 'Code',
    staffOnly: true,
    purpose: '500 health. Stagger pauses the whip for the shared lockout.',
    dod: [
      'Spore has 500 health.',
      'Stagger pauses the whip for the shared lockout.',
    ],
    sortOrder: 70,
  }),
  t({
    code: 'Tether-5.5.8',
    parentCode: 'Tether-5.5',
    shortTitle: 'Spore placement',
    state: 'Ready',
    size: 'Small',
    skill: 'Level Design',
    staffOnly: false,
    purpose: 'Place spores on routes people actually walk. Leave at least one clean path.',
    dod: [
      'Spores sit on routes people actually walk.',
      'At least one clean path remains.',
    ],
    sortOrder: 80,
  }),
  t({
    code: 'Tether-5.5.9',
    parentCode: 'Tether-5.5',
    shortTitle: 'Spore concept and audio',
    state: 'Ready',
    size: 'Small',
    skill: 'Art',
    staffOnly: false,
    purpose:
      'Concept, audio (quiet idle, snare snap, whip, wrap), hard-to-spot art brief. Hero mesh Blocked on CD.1.',
    dod: [
      'Concept art and a hard-to-spot art brief exist.',
      'Placeholder audio covers quiet idle, snare snap, whip, and wrap.',
      'Hero mesh stays Blocked on CD.1.',
    ],
    sortOrder: 90,
  }),
  t({
    code: 'Tether-5.5.10',
    parentCode: 'Tether-5.5',
    shortTitle: 'Spore QA',
    state: 'Ready',
    size: 'Small',
    skill: 'QA',
    staffOnly: false,
    purpose:
      'Spotting is late. Snare is obvious once it hits. 1 to 2 lose the shield race. 3 to 4 win. Wrapped body frees when the Spore dies.',
    dod: [
      'Spotting is late. Snare is obvious once it hits.',
      '1 to 2 lose the shield race. 3 to 4 win.',
      'Wrapped body frees when the Spore dies.',
    ],
    sortOrder: 100,
  }),
];

export function tetherV011Title(task) {
  return `${task.code} ${task.shortTitle}`;
}

export function tetherV011Difficulty(size) {
  if (size === 'Small') return 'Easy';
  return 'Medium';
}

export function tetherV011StaffOnly(task) {
  if (typeof task?.staffOnly === 'boolean') return task.staffOnly;
  return task?.state === 'Staff Only';
}

export function buildTetherV011Description(task) {
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

export function tetherV011Subtasks(task) {
  if (!Array.isArray(task.dod) || !task.dod.length) return [];
  return task.dod.map((label, i) => ({
    id: `s${i + 1}`,
    label,
    done: false,
  }));
}

export function tetherV011Depth(task) {
  if (!task.parentCode) return 0;
  const parent = TETHER_V011_TASKS.find((x) => x.code === task.parentCode);
  if (!parent || !parent.parentCode) return 1;
  return 2;
}

export function listTetherV011SmallsUnder(epicCode) {
  return TETHER_V011_TASKS.filter((task) => {
    if (tetherV011Depth(task) !== 2) return false;
    let cur = task;
    while (cur.parentCode) {
      cur = TETHER_V011_TASKS.find((x) => x.code === cur.parentCode);
      if (!cur) return false;
    }
    return cur.code === epicCode;
  });
}

const STAFF_FALSE_CODES = new Set([
  'Tether-5.0.5',
  'Tether-5.0.6',
  'Tether-5.1.1',
  'Tether-5.1.10',
  'Tether-5.1.11',
  'Tether-5.1.12',
  'Tether-5.2.1',
  'Tether-5.2.7',
  'Tether-5.2.8',
  'Tether-5.3.1',
  'Tether-5.3.10',
  'Tether-5.3.11',
  'Tether-5.3.12',
  'Tether-5.4.1',
  'Tether-5.4.10',
  'Tether-5.4.11',
  'Tether-5.4.12',
  'Tether-5.5.1',
  'Tether-5.5.8',
  'Tether-5.5.9',
  'Tether-5.5.10',
]);

export function isTetherV011StaffOnlyCode(code) {
  return !STAFF_FALSE_CODES.has(code);
}
