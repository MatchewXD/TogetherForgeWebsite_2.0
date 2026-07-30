import { ArrowRight, GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';

const ABOUT_BANNER_SRC = '/images/About_Page_Background.webp';

const AboutPage = () => {
    return (
        <div className="min-h-screen bg-cyber-bg text-text-primary">
            {/* Page header banner */}
            <header className="relative pt-20 overflow-hidden">
                <div className="absolute inset-0" aria-hidden="true">
                    <img
                        src={ABOUT_BANNER_SRC}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover object-[center_40%] sm:object-center"
                        decoding="async"
                        fetchPriority="high"
                    />
                    {/* Readability: base dim + left-weighted panel + top shade */}
                    <div className="absolute inset-0 bg-cyber-bg/55" />
                    <div className="absolute inset-0 bg-gradient-to-r from-cyber-bg/96 via-cyber-bg/85 to-cyber-bg/35" />
                    <div className="absolute inset-0 bg-gradient-to-b from-cyber-bg/70 via-cyber-bg/25 to-transparent" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgb(var(--tf-forge-gold)/0.08)_0%,transparent_50%)]" />
                </div>
                {/* Soft fade into page background (matches home hero) */}
                <div
                    className="absolute bottom-0 inset-x-0 h-28 sm:h-32 pointer-events-none z-[5] bg-gradient-to-b from-transparent via-cyber-bg/50 to-cyber-bg"
                    aria-hidden="true"
                />

                <div className="container-custom relative z-10 py-10 sm:py-12 md:py-14 min-h-[16rem] sm:min-h-[18rem] md:min-h-[20rem] flex flex-col justify-center">
                    <div className="max-w-3xl [text-shadow:0_1px_2px_rgb(0_0_0_/_0.9),0_2px_16px_rgb(0_0_0_/_0.55)]">
                        <div className="section-header">
                            BY THE COMMUNITY, FOR THE COMMUNITY
                        </div>
                        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-4 sm:mb-6">
                            A community-first independent game studio.
                        </h1>
                        <p className="max-w-2xl text-lg sm:text-xl md:text-2xl text-white/85 leading-relaxed">
                            We are tired of AAA companies putting profits and
                            ideology over good games. Together Forge puts gamers
                            and quality mechanics first.
                        </p>
                    </div>
                </div>
            </header>

            <div className="container-custom relative z-10 py-16 md:py-20 space-y-16 md:space-y-20">
                <section>
                    <div className="grid md:grid-cols-12 gap-x-12 gap-y-8 items-start">
                        <div className="md:col-span-5">
                            <div className="sticky top-24">
                                <div className="section-header">WHO WE ARE</div>
                                <h2 className="text-4xl font-bold tracking-tight text-white">Built differently.</h2>
                            </div>
                        </div>
                        <div className="md:col-span-7 text-lg text-text-secondary space-y-6 leading-relaxed">
                            <p>
                                Together Forge is a community-driven game studio. We make cooperative games with the community, for gamers. Not for investors, not for outside agendas, and not for disposable slop designed to extract money.
                            </p>
                            <p>
                                We organize, build, and ship games focused on strong mechanics, real fun, and connection between players. Profits are reinvested into better games and long-term growth, never into shareholders or excessive executive pay.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Mission / Vision cards */}
                <section className="grid md:grid-cols-2 gap-12">
                    <div className="cyber-card cyber-card-gold p-10 space-y-4">
                        <div className="section-header mb-0">MISSION</div>
                        <h3 className="text-2xl font-bold text-white">
                            By the community, for the community!
                        </h3>
                        <p className="text-text-secondary leading-relaxed">
                            Together Forge makes cooperative games with gamers,
                            streamers, and online communities. We build together,
                            focus on strong mechanics and real fun, and put players
                            first.
                        </p>
                        <p className="text-text-secondary leading-relaxed">
                            We empower creativity, foster teamwork, and keep the work
                            independent and free from investor pressure or outside
                            agendas.
                        </p>
                    </div>

                    <div className="cyber-card cyber-card-gold p-10">
                        <div className="section-header mb-4">VISION</div>
                        <h3 className="text-2xl font-bold mb-6 text-white">
                            Redefine gaming through community power.
                        </h3>
                        <p className="text-text-secondary leading-relaxed">
                            A future where players and creators work together to craft extraordinary games that connect people across the world.
                        </p>
                    </div>
                </section>

                <section>
                    <div className="section-header">HOW WE OPERATE</div>
                    <h2 className="text-4xl font-bold tracking-tight text-white mb-8">Profits fuel growth, not greed.</h2>
                    <div className="prose prose-invert text-text-secondary max-w-none space-y-6">
                        <p>
                            We are not here to maximize short-term profits for investors. We are here to build incredible games and a thriving community.
                            Profits are reinvested into development, community projects, and the bigger vision.
                        </p>
                    </div>
                </section>

                {/* Education & long-term vision */}
                <section>
                    <div className="grid md:grid-cols-12 gap-x-12 gap-y-8 items-start">
                        <div className="md:col-span-5">
                            <div className="sticky top-24">
                                <div className="section-header">LONG-TERM VISION</div>
                                <h2 className="text-4xl font-bold tracking-tight text-white">
                                    Grow capability from within.
                                </h2>
                            </div>
                        </div>
                        <div className="md:col-span-7 text-lg text-text-secondary space-y-6 leading-relaxed">
                            <p>
                                Volunteering and open collaboration are how we start. Over time, once the studio has sustainable revenue,
                                a full core team, and surplus resources, we plan a formal{' '}
                                <strong className="text-white font-semibold">Education and Apprenticeship Program</strong>.
                            </p>
                            <p>
                                That program pairs motivated learners with experienced practitioners in art, programming, design,
                                writing, sound, production, and more. Teaching happens through real work on Together Forge projects:
                                structured objectives, mentorship, progress reviews, and public recognition for people who complete the path.
                            </p>
                            <p>
                                Mentors will be compensated for teaching time. Transparent feedback and accountability keep quality high
                                for both mentors and apprentices. The goal is a pipeline of skilled, values-aligned contributors, less
                                dependence on traditional industry gatekeeping, and genuine community uplift beyond short-term tasks.
                            </p>
                            <p>
                                Until launch, the best way to grow with us is to contribute on live projects, claim tasks, and build
                                with the community. Full program details, timing, and safeguards live on our Education page.
                            </p>
                            <Link
                                to="/education"
                                className="inline-flex items-center gap-2 text-neon-cyan hover:text-white font-mono text-sm tracking-widest transition-colors group"
                            >
                                <GraduationCap className="w-4 h-4" />
                                EDUCATION &amp; APPRENTICESHIPS
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
                            </Link>
                        </div>
                    </div>
                </section>

                <section className="pt-12 border-t border-white/10 text-center">
                    <div className="max-w-2xl mx-auto">
                        <h2 className="text-5xl font-bold tracking-tight text-white mb-6">Want to help build this?</h2>
                        <p className="text-xl text-text-secondary mb-10">
                            Share ideas. Volunteer your skills. Support the movement.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link
                                to="/ideas/submit"
                                className="btn-primary btn-neon px-10 py-4 text-center"
                            >
                                SHARE A GAME IDEA
                            </Link>
                            <Link
                                to="/get-involved"
                                className="btn-neon px-8 py-4 text-center"
                            >
                                JOIN AS VOLUNTEER
                            </Link>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default AboutPage;