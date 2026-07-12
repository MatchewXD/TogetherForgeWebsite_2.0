# Successfully added a line of code
# Successfully added a line of code
# Successfully added a line of code
# Together Forge Website Structure & Feature Roadmap 
**Last Updated:** July 06, 2026

## Philosophy
- By the Community, For the Community
- Prioritize quality mechanics, fun, and real connection
- Profits reinvested for growth � not investors or excessive executive pay
- Fully transparent operations and finances
- Volunteer-friendly with proper credit for every contributor
- Community support funds development; incoming contributions treated as business revenue. Net proceeds after taxes and legitimate expenses are reinvested into games, tools, and community initiatives. Founder takes a reasonable living wage only.

## Core Pages (Build Order)

### 1. Home
- Hero section with mission
- Featured projects / demos
- Quick CTAs: "Browse Ideas", "Support the Forge", "Get Involved"

### 2. About
- Who we are + AAA critique
- Mission & Vision (cooperative survival/builder games, community building)
- How we operate (transparent community-supported studio � no outside investors, profits reinvested, founder takes living wage only)
- Clear legal & financial structure disclosure
- Call to action

### 3. Game Ideas
- Browse / search submissions (with filters by category, popularity, etc.)
- Submit Idea button ? dedicated form page (`/ideas/submit`)
- **Category dropdown** (recommended options below)
- **Threaded discussions**: Users can branch off ideas, link related mechanics, post files/demos, comment threads

Status (developer progress)

- ? In progress � High priority for submissions/engagement
  - ? Guided Idea submission form implemented (src/pages/IdeaSubmit.jsx) with structured fields, collapsible sections, per-field limits, dynamic lists (features, enemies, notes).
  - ? Idea edit form implemented (src/pages/IdeaEdit.jsx) to mirror submission fields, with inline delete UI (no browser confirm) and tag deduplication on save.
  - ? Client-side tag deduplication on submit and edit implemented.
  - ? Idea list and card UI redesigned (browse UI improvements completed).
  - ? Delete RLS policy added and applied (owners can delete their ideas); delete flow tested.
  - ? Pending: Threaded discussions / branching comment threads, advanced search & filters, vote decay ranking.

**Recommended Game Idea Categories:**
1. Full Game Idea
2. Game Mechanic
3. Setting / Story / Lore
4. Art / Visual Design
5. Audio / Sound / Music
6. Multiplayer / Cooperative Systems
7. Twitch / Streamer Integration
8. Progression / Economy / Crafting
9. Enemy / AI / Combat
10. World Building / Environment
11. Other (with custom description)

### 4. Projects
- Early Game, Mid Game, Late Game
- Status, goals, contribution info (including how past support helped)
- Cards link to detailed project pages later

### 5. Get Involved / Community
- Volunteer opportunities (development, art, **content creation**, moderation, etc.)
- Task board teaser
- Content creator volunteer section (paid when income allows)
- Contribution badges / recognition
- **Forge Hub / Community Projects** (phased rollout � see Phase 2/3 below): Allow indie developers to post projects and recruit community help (phased rollout, starting internal). Start internal to TogetherForge projects.

### 6. Interactive Demos (later)
- Standardized mechanic testing

### 7. How It Works + FAQ
- Detailed explanation of community model, idea process, contribution flow

### 8. Support / Donations
- Clear tiers with small incentives/perks (examples below)
- Prominent link to **Transparency Hub**
- Payment integration (e.g., Ko-fi, Patreon, Stripe links)
- Important disclaimer: Contributions are treated as support for our community-supported studio. They are **not tax-deductible** for donors. All funds are used responsibly with full transparency.

### 9. Transparency Hub (Core Page)
- Legal structure & governance overview
- Founder compensation policy (living wage only, no bonuses or investor payouts)
- Public financial summaries (donations received, major expense categories, reinvestment into projects)
- Public project roadmap & progress
- Volunteer credits & contributor gallery
- Decision logs (light version � why certain ideas or directions were chosen)
- Regular update archive (monthly "State of the Forge" summaries)
- Mini-site style founder expense transparency (if desired)
- How decisions are made section

#### Sample Support Tiers (with small incentives)
- **Supporter** (one-time or low monthly): Public thank you + name in credits list
- **Forge Member**: Exclusive Discord role, monthly devlog access, vote priority on minor decisions
- **Builder**: Early access to prototypes/demos, name in specific game credits, occasional digital rewards (wallpapers, lore drops)
- Higher tiers: Custom acknowledgments, input on mechanics (non-binding), merch when available

**Note:** Perks are thank-you incentives; value kept reasonable. Pure donations without perks also accepted.

## Phase 2 Features
- User accounts & profiles
- Contribution badges
- Full task claiming system (internal to TogetherForge first) � public view of open/in-progress/completed tasks with volunteer credits
- **Transparency Hub** (full version): Financial summaries, public roadmap, decision logs, volunteer gallery, regular update system
- Forums / threaded discussions on ideas
- Sorting, tags, filters on ideas
  - **Most Popular** (weighted vote decay): New votes have high weight that decays over time. Prevents old high-vote posts from staying at the top forever.
  - **Most Votes** (raw count): Simple descending vote count, no weighting.
- **Forge Hub / Community Projects (light version)**: Indie developers can post TogetherForge-related or approved projects; volunteers claim tasks with credit tracking. Moderated submissions to start.
- Public project roadmap with status indicators
- Accounting / fund tracking integration for public transparency reports
- Light decision log system (published reasoning for major choices)
- [Guided Idea Creation Feature (New)
Goal:
Help users submit higher-quality, well-structured ideas by providing optional guided templates while keeping the process flexible.
Core Flow:

User selects Idea Type (Full Game Idea, Game Mechanic, Setting/Lore, Art/Visual Design, etc.).
They can choose Freeform (current experience) or Guided Creation.
Guided mode uses a step-by-step wizard tailored to the idea type.
Final review screen allows editing before submission.
Submitted idea appears as a normal post in the Game Ideas section.

Key Features:

Save as Draft � Users can pause and return later.
AI Assistant Button � Takes current input and rewrites it into a clearer, more understandable version while preserving the original intent (not a full chatbot � one-click enhancement).
Users can skip any step.
Live preview pane (optional but recommended).
Examples and tips shown alongside each prompt.

Example Template � Game Mechanic:

Step 1: Name (with naming tips and examples)
Step 2: Core Description (�How does it work?�)
Step 3: Gameplay / How to Use
Step 4: Balance, Synergies & Counters
Step 5: Visual / Audio Ideas (optional)
Step 6: Tags & Additional Notes

Similar templates will be created for other idea types (Full Game, Lore, Art, etc.).
Distinction from General Ideas:

Game Ideas page remains for open community-to-community sharing.
Project-specific ideas can be submitted via �Suggest Ideas for This Project� buttons on Project pages (these will be tagged accordingly for easy discovery).

Future Enhancements:

Auto-tagging for Together Forge projects.
Integration with task boards on active projects.
Community voting or feedback on guided submissions.]

## Notes
- Volunteer content creators added
- Strong emphasis on transparency and crediting
- Threaded / branching idea discussions added
- **Forge Hub expansion**: Phase 3+ � Open to external indie teams for project posting and volunteer recruitment (with guidelines, moderation, and credit systems). Start light internally to validate and build community habits first.
- All financial tracking treats incoming support as business revenue; focus on net after-tax reinvestment into projects. Founder compensation limited to reasonable living wage.
- Legal/compliance: Include clear disclosure of business structure, disclaimers on donations (not tax-deductible), terms of service for idea submissions, contributions, and volunteer project collaborations (IP/credit policies important)
- Commit to regular public updates (e.g., monthly "State of the Forge" summaries covering finances, progress, challenges, and decisions)

## Future Enhancements
- Public profile viewing: Allow other logged-in users to view each other's profiles (read-only view of Bio, Interests, Favorite Games, external links, etc.) while keeping private editing restricted to the owner via RLS.

Repository progress notes (short)

- Files updated: src/pages/IdeaSubmit.jsx, src/pages/IdeaEdit.jsx, src/components/Navbar.jsx, supabase_schema.sql (RLS additions).
- Next technical actions: Run remaining ALTER TABLE migrations in supabase_schema.sql (features/enemies/additional_notes, progression/economy/story fields), audit and tighten RLS for insert/update, add server-side validation or DB constraints as needed, and implement threaded comments.

## Today's Priorities (July 6, 2026)
**Focus Areas:**
- **Projects Page**: Expand from MVP to useful content. Include Early/Mid/Late Game sections with status cards, goals, contribution opportunities, and links. Pull from vision doc (small focused multiplayer ? medium indie ? large persistent world).
- **Get Involved Page**: Flesh out volunteer opportunities, task board teaser, content creator section, badges/recognition. Make it actionable with clear calls to action.
- **Home Page Improvements**: Enhance utility while keeping landing appeal. Add persistent navigation elements, quick links to active sections (Projects, Ideas, Transparency), featured devlog teaser, or a "Current Forge Status" widget. Consider a dashboard-like feel for returning users (e.g., "Welcome back - see latest updates").
- Review and integrate content from Together Forge (2).docx across pages (Mission, Vision, Operating Model, Fair Progression).

**Quick Wins:**
- Update Navbar for better internal navigation.
- Ensure consistent CTAs linking to Projects, Get Involved, etc.
- Test mobile responsiveness.

Let's iterate step by step! Update this file as you complete tasks.


Community Idea Development � Guided Discussions (Project Questions)
Purpose
To develop high-quality ideas quickly and in a focused way, we will use structured discussions on each project page. This gives the community clear direction while allowing creative input.
How It Works
On every project page (especially Early Game projects), there will be a prominent section called �Open Questions from the Team� pinned at the top of the idea feed.

The development team (or moderators) will post specific, focused questions.
Community members reply with ideas, suggestions, and concepts.
Replies can be upvoted so the best ideas rise to the top.
The team can mark particularly strong replies as �Promising� or �Adopted� with visible badges and credit the contributor.

Example Question Post:
Title: What should the main player goal / core loop be for our first game?
Body:
In games like Lethal Company, the core loop is simple and compelling: collect scrap, deliver it, and survive.
We want something equally simple, fun, and cooperative for our first Early Game project.
Reply below with your suggested core goal or loop. Top ideas will directly influence the direction of the game.
Benefits

Gives contributors clear guidance instead of open-ended submissions.
Creates a visible history of how the community helped shape each project.
Makes it easy to credit people whose ideas are adopted.
Keeps idea development fast and iterative.

Implementation Notes

Questions will be created by the team and pinned.
A mix of question types will be used (Core Loop, Theme/Setting, Unique Mechanics, Balance, etc.).
Once a question is sufficiently answered, it can be archived and the next question pinned.
This system works alongside the general Game Ideas page (which remains for open community sharing).

This feature will be prioritized for Early Game projects to help define our first titles.