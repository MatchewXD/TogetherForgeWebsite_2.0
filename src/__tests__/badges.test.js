import { describe, it, expect } from 'vitest';
import {
  mapCustomDonationTier,
  mapCustomMonthlyTier,
  resolveDonationTierMeta,
  expectedBadgeKeys,
  getBadgeDef,
  getBadgeImageSrc,
  BADGE_CATALOG,
  BADGE_THRESHOLDS,
  DONATION_THRESHOLDS_DOLLARS,
  TASK_THRESHOLDS,
  listCatalogByCategory,
  sortBadgesByCatalog,
} from '../constants/badges';

describe('mapCustomDonationTier', () => {
  it('maps $5–$19.99 → supporter', () => {
    expect(mapCustomDonationTier(500).tierId).toBe('supporter');
    expect(mapCustomDonationTier(1999).tierId).toBe('supporter');
  });
  it('maps $20–$49.99 → member', () => {
    expect(mapCustomDonationTier(2000).tierId).toBe('member');
    expect(mapCustomDonationTier(4999).tierId).toBe('member');
  });
  it('maps $50+ → builder', () => {
    expect(mapCustomDonationTier(5000).tierId).toBe('builder');
    expect(mapCustomDonationTier(999999).tierId).toBe('builder');
  });
});

describe('mapCustomMonthlyTier', () => {
  it('maps monthly brackets', () => {
    expect(mapCustomMonthlyTier(500).tierId).toBe('supporter');
    expect(mapCustomMonthlyTier(1500).tierId).toBe('member');
    expect(mapCustomMonthlyTier(4000).tierId).toBe('builder');
  });
});

describe('resolveDonationTierMeta', () => {
  it('keeps explicit tier ids', () => {
    expect(
      resolveDonationTierMeta({ tierId: 'member', amountCents: 99999 }).tierId
    ).toBe('member');
  });
  it('maps custom one-time by amount', () => {
    expect(
      resolveDonationTierMeta({
        tierId: 'custom',
        amountCents: 2500,
        interval: 'once',
      }).tierId
    ).toBe('member');
  });
});

describe('expectedBadgeKeys', () => {
  it('grants donor and donation milestones', () => {
    const keys = expectedBadgeKeys({ totalCents: 10000 }); // $100
    expect(keys).toContain('status_donor');
    expect(keys).toContain('donation_10');
    expect(keys).toContain('donation_50');
    expect(keys).toContain('donation_100');
    expect(keys).not.toContain('donation_250');
  });
  it('grants task milestones', () => {
    const keys = expectedBadgeKeys({ tasksCompleted: 10 });
    expect(keys).toContain('tasks_1');
    expect(keys).toContain('tasks_5');
    expect(keys).toContain('tasks_10');
    expect(keys).not.toContain('tasks_25');
  });
  it('grants active subscriber only when active', () => {
    expect(expectedBadgeKeys({ hasActiveSub: true })).toContain(
      'status_active_subscriber'
    );
    expect(expectedBadgeKeys({ hasActiveSub: false })).not.toContain(
      'status_active_subscriber'
    );
  });

  it('grants game shipper when hasShippedGame', () => {
    expect(expectedBadgeKeys({ hasShippedGame: true })).toContain(
      'status_game_shipper'
    );
    expect(expectedBadgeKeys({ hasShippedGame: false })).not.toContain(
      'status_game_shipper'
    );
  });

  it('grants starter family from first actions', () => {
    const keys = expectedBadgeKeys({
      publicIdeaCount: 1,
      showcaseSubmissions: 1,
      meaningfulFeedbackOnOthers: 1,
      taskClaims: 1,
      isEarlySupporter: true,
    });
    expect(keys).toEqual(
      expect.arrayContaining([
        'starter_first_idea',
        'starter_showcase',
        'starter_first_feedback',
        'starter_task_claimed',
        'starter_early_supporter',
      ])
    );
  });

  it('grants impact badges from transparent post and account totals', () => {
    const keys = expectedBadgeKeys({
      maxIdeaCommentsByOthers: 25,
      maxIdeaVotes: 100,
      maxIdeaAwards: 8,
      maxIdeaMasterworks: 1,
      awardsReceived: 40,
    });
    expect(keys).toEqual(
      expect.arrayContaining([
        'impact_discussion_starter',
        'impact_well_received',
        'impact_deep_discussion',
        'impact_community_favorite',
        'impact_awarded_idea',
        'impact_recognized',
        'impact_respected',
        'impact_distinguished',
        'impact_talk_of_the_forge',
        'impact_viral_idea',
      ])
    );
    expect(
      expectedBadgeKeys({ maxIdeaAwards: 1 })
    ).toContain('impact_awarded_idea');
    expect(
      expectedBadgeKeys({ maxIdeaCommentsByOthers: 9 })
    ).not.toContain('impact_discussion_starter');
  });

  it('grants giving badges from Marks spent and comment volume', () => {
    const keys = expectedBadgeKeys({
      awardsGiven: 5,
      marksSpentOnAwards: 5000,
      meaningfulComments: 50,
    });
    expect(keys).toEqual(
      expect.arrayContaining([
        'giving_first_spark',
        'giving_generous',
        'giving_patron',
        'giving_commentator',
        'giving_active_voice',
        'giving_supporter',
        'giving_enthusiast',
      ])
    );
  });

  it('grants collaboration badges only when the flags are true', () => {
    expect(expectedBadgeKeys({ hasJoinedForce: true })).toContain(
      'collab_joined_force'
    );
    expect(expectedBadgeKeys({ hasSharedVictory: true })).toContain(
      'collab_shared_victory'
    );
    expect(expectedBadgeKeys({})).not.toContain('collab_joined_force');
  });
});

describe('catalog', () => {
  it('has unique keys covering thresholds', () => {
    const keys = BADGE_CATALOG.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const d of DONATION_THRESHOLDS_DOLLARS) {
      expect(getBadgeDef(`donation_${d}`)).toBeTruthy();
    }
    for (const t of TASK_THRESHOLDS) {
      expect(getBadgeDef(`tasks_${t}`)).toBeTruthy();
    }
    expect(getBadgeDef('status_game_shipper')?.name).toBe('Game Shipper');
    expect(getBadgeDef('starter_first_idea')?.name).toBe('First Idea');
    expect(getBadgeDef('impact_viral_idea')?.threshold).toBe(
      BADGE_THRESHOLDS.viralIdeaVotes
    );
    expect(getBadgeDef('giving_generous')?.threshold).toBe(
      BADGE_THRESHOLDS.generousMarks
    );
    expect(getBadgeDef('collab_shared_victory')?.category).toBe(
      'collaboration'
    );
  });

  it('lists the new families on the public catalog page', () => {
    const labels = listCatalogByCategory().map((s) => s.label);
    expect(labels).toEqual([
      'Status',
      'Starter',
      'Impact',
      'Giving & Engagement',
      'Collaboration',
      'Donation milestones',
      'Tasks shipped',
    ]);
  });

  it('sorts earned badges in catalog order', () => {
    const sorted = sortBadgesByCatalog([
      { key: 'giving_first_spark', name: 'First Spark Given' },
      { key: 'status_donor', name: 'Donor' },
      { key: 'starter_first_idea', name: 'First Idea' },
    ]);
    expect(sorted.map((b) => b.key)).toEqual([
      'status_donor',
      'starter_first_idea',
      'giving_first_spark',
    ]);
  });
});

describe('getBadgeImageSrc', () => {
  it('maps existing status and donor art', () => {
    expect(getBadgeImageSrc('status_donor')).toBe(
      '/images/Badges/Donor/Donator.png'
    );
    expect(getBadgeImageSrc('status_active_subscriber')).toBe(
      '/images/Badges/Active_Subscriber.png'
    );
    expect(getBadgeImageSrc('donation_10')).toBe(
      '/images/Badges/Donor/10_donor.png'
    );
    expect(getBadgeImageSrc('donation_500')).toBe(
      '/images/Badges/Donor/500_donor.png'
    );
    expect(getBadgeImageSrc('donation_1000')).toBe(
      '/images/Badges/Donor/1000_donor.png'
    );
    expect(getBadgeImageSrc('donation_100000')).toBe(
      '/images/Badges/Donor/100000_donor.png'
    );
  });

  it('maps task milestone art', () => {
    expect(getBadgeImageSrc('tasks_1')).toBe(
      '/images/Badges/Tasks/first_Ship.png'
    );
    expect(getBadgeImageSrc('tasks_5')).toBe(
      '/images/Badges/Tasks/5_tasks.png'
    );
    expect(getBadgeImageSrc('tasks_250')).toBe(
      '/images/Badges/Tasks/250_tasks.png'
    );
  });

  it('maps game shipper art', () => {
    expect(getBadgeImageSrc('status_game_shipper')).toBe(
      '/images/Badges/game_shipper.png'
    );
  });

  it('maps starter, impact, and engagement folder art', () => {
    expect(getBadgeImageSrc('starter_first_idea')).toBe(
      '/images/Badges/Starter/First_Idea.png'
    );
    expect(getBadgeImageSrc('impact_discussion_starter')).toBe(
      '/images/Badges/Impact/Discussion_Starter.png'
    );
    expect(getBadgeImageSrc('impact_well_received')).toBe(
      '/images/Badges/Impact/Well_Recieved.png'
    );
    expect(getBadgeImageSrc('giving_first_spark')).toBe(
      '/images/Badges/Engagement/First_Spark_Given.png'
    );
    expect(getBadgeImageSrc('giving_active_voice')).toBe(
      '/images/Badges/Engagement/Aactive_Voice.png'
    );
    expect(getBadgeImageSrc('collab_joined_force')).toBe(
      '/images/Badges/Engagement/Joined_Force.png'
    );
  });
});
