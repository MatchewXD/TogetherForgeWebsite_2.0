import { ArrowLeft, ArrowRight, GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';

const AboutPage = () => {
    return (
        <div className="pt-20">
            <div className="border-b border-white/10 bg-cyber-surface py-16">
                <div className="container-custom">
                    <Link to="/" className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" /> BACK TO HOME
                    </Link>

                    <div className="max-w-4xl">
                        <div className="section-header">BY THE COMMUNITY, FOR THE COMMUNITY</div>
                        <h1 className="text-6xl md:text-7xl font-bold tracking-[-3px] text-white mb-6">
                            A community-first independent game studio.
                        </h1>
                        <p className="max-w-2xl text-2xl text-text-secondary">
                            We are tired of AAA companies putting profits and ideology over good games.
                            Together Forge puts gamers and quality mechanics first.
                        </p>
                    </div>
                </div>
            </div>

            <div className="container-custom py-20 space-y-20">
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
                                Together Forge organizes, supports, and markets games created collaboratively by the community, for the community.
                                Our focus is bringing people together through groups of friends, streamers with their audiences, and massive online communities.
                            </p>
                            <p>
                                We prioritize quality mechanics, fun, and real connection. Profits are reinvested into growth and making better games, not into investors or excessive executive pay.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Mission / Vision cards */}
                <section className="grid md:grid-cols-2 gap-12">
                    <div className="cyber-card p-10">
                        <div className="section-header mb-4">MISSION</div>
                        <h3 className="text-2xl font-bold mb-6">By the community, for the community!</h3>
                        <p className="text-text-secondary">
                            We organize and support the development of games created collaboratively by gamers, streamers, and massive online communities.
                            We empower creativity, foster teamwork, and prioritize inclusivity.
                        </p>
                    </div>

                    <div className="cyber-card p-10">
                        <div className="section-header mb-4">VISION</div>
                        <h3 className="text-2xl font-bold mb-6">Redefine gaming through community power.</h3>
                        <p className="text-text-secondary">
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
                            <a href="#" className="btn-primary btn-neon px-10 py-4">SHARE A GAME IDEA</a>
                            <a href="#" className="btn-neon px-8 py-4">JOIN AS VOLUNTEER</a>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default AboutPage;