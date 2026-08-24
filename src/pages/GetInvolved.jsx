/**
 * Get Involved — welcoming volunteer paths for Together Forge.
 * Six full sections with varied layout rhythm; applications stay private.
 *
 * Spot illustrations: set PATH_SPOT_SRC[id] when assets exist.
 * Layout modes adapt when art is present; empty slots take no space.
 */

import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

import Card from '../components/ui/Card';
import Button from '../components/ui/Buttons';
import BannerImage from '../components/ui/BannerImage';
import Modal from '../components/ui/Modal';
import DiscordLink from '../components/ui/DiscordLink';
import VolunteerOfferForm from '../components/getInvolved/VolunteerOfferForm';
import { COMMUNITY_MODERATOR_ACTIVITIES } from '../constants/volunteer';

const GET_INVOLVED_BANNER_SRC = '/images/Get_Involved_Background.webp';

const SPOT_BASE = '/images/spot_illustrations/Get_Involved';

/**
 * Spot art per section (from public/images/spot_illustrations/Get_Involved).
 * String = single image; { left, right } = flank the section copy.
 * @type {Record<string, string | { left?: string, right?: string } | null>}
 */
const PATH_SPOT_SRC = {
  'game-development': `${SPOT_BASE}/Game_Development.webp`,
  'ideas-feedback': `${SPOT_BASE}/Ideas.webp`,
  'content-creation': null,
  'community-moderation': `${SPOT_BASE}/Moderation.webp`,
  // Other Skills 2 left, Other Skills 1 right of Platform copy
  'platform-skills': {
    left: `${SPOT_BASE}/Other_Skills_2.webp`,
    right: `${SPOT_BASE}/Other_Skills_1.webp`,
  },
  'support-studio': `${SPOT_BASE}/Support_The_Studio.webp`,
  recognition: `${SPOT_BASE}/Credit.webp`,
};

const CONTENT_CREATORS_FOCUS = {
  id: 'creators-youtube',
  title: 'Content Creators Team (official YouTube)',
  skillIds: ['video', 'marketing', 'design'],
};

/** Single styled section title (no eyebrow + h2 pair). */
const pathHeadingClass =
  'section-header !mb-5 !text-2xl sm:!text-3xl !font-bold !tracking-tight !normal-case !text-white ![letter-spacing:0.01em]';

function scrollToId(id) {
  const el = document.getElementById(String(id).replace(/^#/, ''));
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const emptyFormFocus = () => ({
  skillIds: [],
  openNeedId: '',
  relatedNeedTitle: '',
  formKey: 0,
});

function PathSpot({ sectionId, src, className = '' }) {
  if (!src) return null;
  return (
    <div
      className={`w-full min-w-0 ${className}`}
      data-spot-slot={sectionId}
      aria-hidden="true"
    >
      <div className="relative w-full max-w-[22rem] sm:max-w-[26rem] mx-auto lg:max-w-none">
        <img
          src={src}
          alt=""
          className="w-full h-auto max-h-[15rem] sm:max-h-[17rem] lg:max-h-[19rem] object-contain object-center block mx-auto"
          decoding="async"
          loading="lazy"
        />
      </div>
    </div>
  );
}

/**
 * Alternating path layouts.
 * @param {'text-start'|'text-end'|'spot-end'|'spot-start'|'centered'|'wide'} layout
 * When no spot src is set, spot-* layouts fall back to text-start / text-end
 * so empty columns never appear.
 */
function PathSection({
  id,
  headingId,
  title,
  layout = 'text-start',
  children,
  actions,
  after = null,
}) {
  const spotCfg = PATH_SPOT_SRC[id] || null;
  const isFlanked =
    spotCfg &&
    typeof spotCfg === 'object' &&
    (spotCfg.left || spotCfg.right);
  const spotSrc =
    typeof spotCfg === 'string' ? spotCfg : null;
  const hasSpot = Boolean(spotSrc) || Boolean(isFlanked);

  let resolved = layout;
  if (!hasSpot) {
    if (layout === 'spot-end') resolved = 'text-start';
    if (layout === 'spot-start') resolved = 'text-end';
  }
  if (isFlanked) resolved = 'flanked';

  const heading = (
    <h2 id={headingId} className={pathHeadingClass}>
      {title}
    </h2>
  );

  const body = (
    <div className="text-text-secondary text-sm sm:text-base leading-relaxed space-y-3">
      {children}
    </div>
  );

  const actionRow = actions ? (
    <div className="flex flex-wrap gap-3 mt-6">{actions}</div>
  ) : null;

  let main = null;

  if (resolved === 'flanked' && isFlanked) {
    // [left art] [copy] [right art] — stacks on small screens: copy first
    main = (
      <div
        className="grid lg:grid-cols-12 gap-x-8 gap-y-8 items-center"
        data-spot-ready={id}
      >
        {spotCfg.left ? (
          <PathSpot
            sectionId={`${id}-left`}
            src={spotCfg.left}
            className="lg:col-span-3 order-2 lg:order-1"
          />
        ) : (
          <div className="hidden lg:block lg:col-span-3" aria-hidden="true" />
        )}
        <div className="lg:col-span-6 min-w-0 max-w-xl mx-auto text-center order-1 lg:order-2">
          <div className="flex justify-center">{heading}</div>
          <div className="text-left sm:text-center">{body}</div>
          {actions ? (
            <div className="flex flex-wrap gap-3 mt-6 justify-center">
              {actions}
            </div>
          ) : null}
        </div>
        {spotCfg.right ? (
          <PathSpot
            sectionId={`${id}-right`}
            src={spotCfg.right}
            className="lg:col-span-3 order-3"
          />
        ) : (
          <div className="hidden lg:block lg:col-span-3" aria-hidden="true" />
        )}
      </div>
    );
  } else if (resolved === 'centered') {
    main = (
      <div className="max-w-2xl mx-auto text-center" data-spot-ready={id}>
        <div className="flex justify-center">{heading}</div>
        <div className="text-left sm:text-center">{body}</div>
        {actions ? (
          <div className="flex flex-wrap gap-3 mt-6 justify-center">{actions}</div>
        ) : null}
        {spotSrc ? (
          <PathSpot sectionId={id} src={spotSrc} className="mt-8" />
        ) : null}
      </div>
    );
  } else if (resolved === 'wide') {
    if (spotSrc) {
      main = (
        <div
          className="grid lg:grid-cols-12 gap-x-10 gap-y-8 items-start"
          data-spot-ready={id}
        >
          <div className="lg:col-span-7 min-w-0 max-w-3xl">
            {heading}
            {body}
            {actionRow}
          </div>
          <PathSpot
            sectionId={id}
            src={spotSrc}
            className="lg:col-span-5"
          />
        </div>
      );
    } else {
      main = (
        <div className="max-w-3xl" data-spot-ready={id}>
          {heading}
          {body}
          {actionRow}
        </div>
      );
    }
  } else if (resolved === 'text-end') {
    // Right-weighted copy; optional spot sits above on mobile, left on desktop
    if (spotSrc) {
      main = (
        <div
          className="grid lg:grid-cols-12 gap-x-10 gap-y-8 items-center"
          data-spot-ready={id}
        >
          <PathSpot
            sectionId={id}
            src={spotSrc}
            className="lg:col-span-5 order-2 lg:order-1"
          />
          <div className="lg:col-span-7 min-w-0 max-w-2xl ml-auto lg:mr-0 order-1 lg:order-2">
            {heading}
            {body}
            {actionRow}
          </div>
        </div>
      );
    } else {
      main = (
        <div className="max-w-2xl ml-auto lg:mr-0" data-spot-ready={id}>
          {heading}
          {body}
          {actionRow}
        </div>
      );
    }
  } else if (resolved === 'spot-end' && spotSrc) {
    main = (
      <div
        className="grid lg:grid-cols-12 gap-x-10 gap-y-8 items-center"
        data-spot-ready={id}
      >
        <div className="lg:col-span-6 xl:col-span-7 min-w-0">
          {heading}
          {body}
          {actionRow}
        </div>
        <PathSpot
          sectionId={id}
          src={spotSrc}
          className="lg:col-span-6 xl:col-span-5"
        />
      </div>
    );
  } else if (resolved === 'spot-start' && spotSrc) {
    main = (
      <div
        className="grid lg:grid-cols-12 gap-x-10 gap-y-8 items-center"
        data-spot-ready={id}
      >
        <PathSpot
          sectionId={id}
          src={spotSrc}
          className="lg:col-span-6 xl:col-span-5 lg:order-1 order-2"
        />
        <div className="lg:col-span-6 xl:col-span-7 min-w-0 lg:order-2 order-1">
          {heading}
          {body}
          {actionRow}
        </div>
      </div>
    );
  } else {
    // text-start (default)
    main = (
      <div className="max-w-2xl" data-spot-ready={id}>
        {heading}
        {body}
        {actionRow}
      </div>
    );
  }

  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-24">
      {main}
      {after}
    </section>
  );
}

const GetInvolved = () => {
  const location = useLocation();
  const [skillModalOpen, setSkillModalOpen] = useState(false);
  const [modModalOpen, setModModalOpen] = useState(false);
  const [contentModalOpen, setContentModalOpen] = useState(false);
  const [formFocus, setFormFocus] = useState(emptyFormFocus);

  const openSkillModalBlank = () => {
    setFormFocus((prev) => ({
      skillIds: [],
      openNeedId: '',
      relatedNeedTitle: '',
      formKey: prev.formKey + 1,
    }));
    setModModalOpen(false);
    setContentModalOpen(false);
    setSkillModalOpen(true);
  };

  const openContentCreatorsModal = () => {
    setFormFocus((prev) => ({
      skillIds: [...CONTENT_CREATORS_FOCUS.skillIds],
      openNeedId: CONTENT_CREATORS_FOCUS.id,
      relatedNeedTitle: CONTENT_CREATORS_FOCUS.title,
      formKey: prev.formKey + 1,
    }));
    setSkillModalOpen(false);
    setModModalOpen(false);
    setContentModalOpen(true);
  };

  const openModModal = () => {
    setFormFocus((prev) => ({
      skillIds: ['moderation'],
      openNeedId: 'mod-team',
      relatedNeedTitle: 'Community Moderator',
      formKey: prev.formKey + 1,
    }));
    setSkillModalOpen(false);
    setContentModalOpen(false);
    setModModalOpen(true);
  };

  const closeSkillModal = () => setSkillModalOpen(false);
  const closeModModal = () => setModModalOpen(false);
  const closeContentModal = () => setContentModalOpen(false);

  useEffect(() => {
    if (!location.hash) return;
    const hashId = location.hash.replace(/^#/, '');
    if (hashId === 'offer-skills' || hashId === 'volunteer-skills') {
      window.setTimeout(() => openSkillModalBlank(), 50);
      return;
    }
    if (hashId === 'mod-apply') {
      window.setTimeout(() => openModModal(), 50);
      return;
    }
    if (hashId === 'content-creators' || hashId === 'content-apply') {
      window.setTimeout(() => openContentCreatorsModal(), 50);
      return;
    }
    const alias = {
      'open-needs': 'platform-skills',
      'moderation-roles': 'community-moderation',
      paths: 'game-development',
    };
    window.setTimeout(() => scrollToId(alias[hashId] || hashId), 80);
  }, [location.hash]);

  return (
    <div className="min-h-screen bg-cyber-bg text-text-primary">
      <header className="relative pt-20 overflow-hidden">
        <div className="absolute inset-0" aria-hidden="true">
          <BannerImage
            src={GET_INVOLVED_BANNER_SRC}
            className="absolute inset-0 w-full h-full object-cover object-[center_40%] sm:object-center"
            fetchPriority="high"
          />
          <div className="tf-banner-scrim" />
        </div>
        <div className="tf-banner-fade h-28 sm:h-32" aria-hidden="true" />

        <div className="container-custom relative z-10 py-8 sm:py-10 md:py-12 min-h-[16rem] sm:min-h-[18rem] md:min-h-[20rem] flex flex-col justify-center">
          <div className="max-w-2xl [text-shadow:0_1px_2px_rgb(0_0_0_/_0.9),0_2px_16px_rgb(0_0_0_/_0.55)]">
            <h1 className="section-header dashboard-page-title !mb-4 !text-3xl sm:!text-4xl !font-bold !tracking-tight !normal-case">
              Get Involved
            </h1>
            <p className="text-base sm:text-lg text-white/85 leading-relaxed max-w-xl">
              Together Forge is built by volunteers: game work, ideas, media,
              community care, platform skills, and optional support. Find the
              path that fits you.
            </p>
            <p className="mt-3 text-sm text-white/70 leading-relaxed max-w-xl">
              Paid opportunities will open later once studio income is stable.
              For now, contributions are volunteer with public credit where the
              product supports it.
            </p>
          </div>
        </div>
      </header>

      <div className="container-custom relative z-10 py-14 md:py-20 space-y-20 md:space-y-28">
        {/* 1 — text start (spot-end when art exists) */}
        <PathSection
          id="game-development"
          headingId="game-dev-heading"
          title="Game Development"
          layout="spot-end"
          actions={
            <>
              <Button
                type="button"
                className="gap-2"
                to="/open-work"
              >
                Open Work
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="gap-2"
                to="/projects"
              >
                Projects
                <ArrowRight className="w-4 h-4" />
              </Button>
            </>
          }
        >
          <p>
            Help build the games: code, design, art, audio, testing, and more
            on live project boards. Completed work earns public credit on
            contributor profiles and project spaces.
          </p>
        </PathSection>

        {/* 2 — text end (spot-start when art exists) */}
        <PathSection
          id="ideas-feedback"
          headingId="ideas-heading"
          title="Ideas & Feedback"
          layout="spot-start"
          actions={
            <>
              <Button
                type="button"
                className="gap-2"
                to="/ideas"
              >
                Ideas
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="gap-2"
                to="/ideas/submit"
              >
                Submit idea
                <ArrowRight className="w-4 h-4" />
              </Button>
            </>
          }
        >
          <p>
            Share game concepts, vote, and join the conversation. Strong ideas
            can grow into real project work, with credit that stays with the
            people who brought them forward.
          </p>
        </PathSection>

        {/* 3 — Content Creation: two inviting paths */}
        <section
          id="content-creation"
          aria-labelledby="content-heading"
          className="scroll-mt-24"
        >
          <div className="max-w-3xl mb-10 md:mb-12">
            <h2 id="content-heading" className={pathHeadingClass}>
              Content Creation
            </h2>
            <p className="text-text-secondary text-sm sm:text-base leading-relaxed">
              Media is one of the best ways to help Together Forge grow. You can
              share from the community, or join the team that makes our official
              channel content.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-10 md:gap-12 lg:gap-16">
            <div className="min-w-0 space-y-4">
              <h3 className="text-lg sm:text-xl font-semibold text-white tracking-tight">
                Community Showcase
              </h3>
              <p className="text-text-secondary text-sm sm:text-base leading-relaxed">
                A public home for Together Forge related media from anyone in
                the community. Share work that celebrates the forge and helps
                others discover it:
              </p>
              <ul className="text-sm sm:text-[15px] text-text-secondary leading-relaxed space-y-2 list-disc pl-5 marker:text-neon-cyan/80">
                <li>YouTube videos about Together Forge</li>
                <li>Clips of community events, playtests, or collab sessions</li>
                <li>
                  Character art, idea illustrations, or other Together Forge
                  related images
                </li>
              </ul>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  type="button"
                  className="gap-2"
                  to="/showcase"
                >
                  Browse Showcase
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-2"
                  to="/showcase/submit"
                >
                  Submit media
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="min-w-0 space-y-4">
              <h3 className="text-lg sm:text-xl font-semibold text-white tracking-tight">
                Content Creators Team
              </h3>
              <p className="text-text-secondary text-sm sm:text-base leading-relaxed">
                A select team that plans and produces official Together Forge
                YouTube videos. Right now the focus is foundational pieces:
                what Together Forge is, what we are about, how we plan to make a
                difference,
                and how the system works.
              </p>
              <p className="text-text-secondary text-sm sm:text-base leading-relaxed">
                Later the same team will cover trailers, progress updates,
                donation and runway updates, volunteer shoutouts, project
                status, and more. Volunteer help earns public credit for now;
                this becomes a paid role when the studio can support it.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  type="button"
                  className="gap-2"
                  onClick={() => openContentCreatorsModal()}
                >
                  Apply to join the team
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-2"
                  to="/media"
                >
                  Media hub
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {PATH_SPOT_SRC['content-creation'] ? (
            <PathSpot
              sectionId="content-creation"
              src={PATH_SPOT_SRC['content-creation']}
              className="mt-12 max-w-md mx-auto"
            />
          ) : null}
        </section>

        {/* 4 — Community Moderator activities + apply */}
        <PathSection
          id="community-moderation"
          headingId="mod-heading"
          title="Community & Moderation"
          layout="wide"
          actions={
            <Button
              type="button"
              className="gap-2"
              onClick={() => openModModal()}
            >
              Apply
              <ArrowRight className="w-4 h-4" />
            </Button>
          }
        >
          <p>
            Community Moderators help keep Together Forge welcoming, fair, and
            useful. They can:
          </p>
          <ul className="space-y-2.5 list-disc pl-5 marker:text-neon-cyan/80">
            {COMMUNITY_MODERATOR_ACTIVITIES.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </PathSection>

        {/* 5 — centered breathing room */}
        <PathSection
          id="platform-skills"
          headingId="skills-heading"
          title="Platform & Other Skills"
          layout="centered"
          actions={
            <Button
              type="button"
              className="gap-2"
              onClick={() => openSkillModalBlank()}
            >
              Volunteer Your Skills
              <ArrowRight className="w-4 h-4" />
            </Button>
          }
        >
          <p>
            Flexible help beyond a single game board: documentation,
            translations, tooling, testing, design, marketing assets, outreach,
            and more. Share what you can offer in a short private form. This is
            volunteer help, not a paid job listing.
          </p>
        </PathSection>

        {/* 6 — text end for variety */}
        <PathSection
          id="support-studio"
          headingId="support-heading"
          title="Support the Studio"
          layout="text-end"
          actions={
            <>
              <Button
                type="button"
                className="gap-2"
                to="/donate"
              >
                Donate
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="gap-2"
                to="/transparency"
              >
                Transparency
                <ArrowRight className="w-4 h-4" />
              </Button>
            </>
          }
        >
          <p>
            Optional financial support helps cover tools, hosting, and
            operations. Totals and spending stay transparent. Studio support is
            separate from AI token purchases, and giving is never required to
            contribute or belong here.
          </p>
        </PathSection>

        {/* Recognition */}
        <section aria-labelledby="credits-heading" className="scroll-mt-24">
          <Card className="bg-cyber-card/80 border-neon-purple/30 overflow-hidden relative p-6 sm:p-8 md:p-10">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_right,rgba(192,132,252,0.08)_0%,transparent_60%)]"
              aria-hidden="true"
            />
            <div className="relative grid lg:grid-cols-12 gap-8 lg:gap-10 items-center">
              <div className="lg:col-span-7 min-w-0 max-w-2xl">
                <h2 id="credits-heading" className={pathHeadingClass}>
                  Credit that follows the work
                </h2>
                <p className="text-text-secondary text-sm sm:text-base leading-relaxed mb-6">
                  Public credit lives on contributor profiles, completed work,
                  and project shoutouts. When you ship something, the site is
                  built to keep your name with it.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="secondary"
                    className="gap-2"
                    to="/contributors"
                  >
                    Contributors
                  </Button>
                  <Button
                    variant="ghost"
                    className="gap-2"
                    to="/how-it-works"
                  >
                    How credit works
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <PathSpot
                sectionId="recognition"
                src={PATH_SPOT_SRC.recognition}
                className="lg:col-span-5"
              />
            </div>
          </Card>
        </section>

        {/* Discord */}
        <section
          id="community"
          aria-labelledby="community-heading"
          className="scroll-mt-24"
        >
          <Card className="bg-cyber-card/80 p-6 sm:p-8 md:p-10 flex flex-col md:flex-row md:items-center gap-6 border-neon-cyan/20">
            <div className="min-w-0 flex-1">
              <h2
                id="community-heading"
                className={`${pathHeadingClass} !mb-3`}
              >
                Coordinate on Discord when you are ready
              </h2>
              <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
                The site is the public home for each path and for private
                applications. Discord is where day-to-day coordination and chat
                continue, not a wall before you can start.
              </p>
            </div>
            <DiscordLink
              variant="button"
              labelKey="join"
              className="shrink-0 self-start md:self-auto"
            />
          </Card>
        </section>

        <p className="text-sm text-text-muted text-center">
          Want to understand why this exists?{' '}
          <Link
            to="/founders-thoughts"
            className="text-text-secondary hover:text-neon-cyan transition-colors"
          >
            → Founders Thoughts
          </Link>
        </p>
      </div>

      <Modal
        isOpen={skillModalOpen}
        onClose={closeSkillModal}
        title="Volunteer Your Skills"
        size="lg"
      >
        <VolunteerOfferForm
          key={`skill-${formFocus.formKey}`}
          mode="skill_offer"
          defaultOpenNeedId={formFocus.openNeedId}
          relatedNeedTitle={formFocus.relatedNeedTitle}
          defaultSkillIds={formFocus.skillIds}
          formId="volunteer-offer-modal"
          variant="plain"
          onDone={closeSkillModal}
          onCancel={closeSkillModal}
        />
      </Modal>

      <Modal
        isOpen={contentModalOpen}
        onClose={closeContentModal}
        title="Content Creators Team"
        size="lg"
      >
        <div className="space-y-3">
          <p className="text-sm text-text-secondary leading-relaxed">
            Private application for the official Together Forge YouTube team.
            Coordinators review quietly.
          </p>
          <VolunteerOfferForm
            key={`content-${formFocus.formKey}`}
            mode="skill_offer"
            defaultOpenNeedId={formFocus.openNeedId}
            relatedNeedTitle={formFocus.relatedNeedTitle}
            defaultSkillIds={formFocus.skillIds}
            formId="content-creators-modal"
            variant="plain"
            onDone={closeContentModal}
            onCancel={closeContentModal}
          />
        </div>
      </Modal>

      <Modal
        isOpen={modModalOpen}
        onClose={closeModModal}
        title="Community Moderator application"
        size="lg"
      >
        <div className="space-y-3">
          <p className="text-sm text-text-secondary leading-relaxed">
            Apply to help as a Community Moderator. Reviewed privately.
          </p>
          <VolunteerOfferForm
            key={`mod-${formFocus.formKey}`}
            mode="moderation_role"
            defaultSkillIds={['moderation']}
            defaultOpenNeedId={formFocus.openNeedId || 'mod-team'}
            relatedNeedTitle={formFocus.relatedNeedTitle}
            formId="mod-application-modal"
            variant="plain"
            onDone={closeModModal}
            onCancel={closeModModal}
          />
        </div>
      </Modal>
    </div>
  );
};

export default GetInvolved;
