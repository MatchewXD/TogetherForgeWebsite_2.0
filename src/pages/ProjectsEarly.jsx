import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useIsModerator } from '../hooks/useIsModerator';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const ProjectsEarly = () => {
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pageContent, setPageContent] = useState(null);

    const SAMPLE_GAMES = [
        { id: 'g1', title: 'Minimap Mayhem', desc: 'Small co-op arena focusing on resource delivery and defense.', status: 'in_progress' },
        { id: 'g2', title: 'Collector Caravan', desc: 'A short mission-based game that validates item collection loop.', status: 'todo' },
        { id: 'g3', title: 'Prototype PVP-lite', desc: 'Basic competitive prototype to test network and latency concerns.', status: 'completed' }
    ];

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            setLoading(true);
            try {
                const { data: gamesData } = await supabase.from('phase_games').select('*').eq('phase', 'early');
                if (mounted) setGames(gamesData && gamesData.length ? gamesData : SAMPLE_GAMES);

                const { data: contentData } = await supabase.from('page_content').select('content').eq('page_key', 'early_game').single();
                if (mounted && contentData?.content) {
                    let loaded = contentData.content;
                    if (Array.isArray(loaded.goals)) {
                        loaded = { ...loaded, goals: loaded.goals.map(g => `- ${g}`).join('\n') };
                    } else if (typeof loaded.goals === 'string') {
                        let goalsStr = loaded.goals;
                        // Convert escaped newline sequences (both single and double backslash forms) to real newlines
                        goalsStr = goalsStr.replace(/\\n/g, '\n').replace(/\\\\n/g, '\n');
                        // Strip HTML tags (e.g., <small>)
                        goalsStr = goalsStr.replace(/<[^>]*>/g, '');
                        // Split, trim, and ensure list prefixes
                        const lines = goalsStr.split('\n').map(l => l.trim()).filter(Boolean);
                        loaded.goals = lines.map(line => {
                            if (line.startsWith('- ') || line.startsWith('* ')) return line;
                            return `- ${line}`;
                        }).join('\n');
                    }
                    setPageContent(loaded);
                }
            } catch {
                if (mounted) setGames(SAMPLE_GAMES);
            }
            setLoading(false);
        };
        load();
        return () => { mounted = false; };
    }, []);

    const { isModerator } = useIsModerator();
    const doneCount = games.filter(g => g.status === 'completed').length;

    return (
        <div className="pt-20 min-h-screen">
            <div className="container-custom py-12">
                <Link to="/projects" className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" /> BACK TO PROJECTS
                </Link>

                <div className="mb-8 relative flex items-start justify-center">
                    <div className="text-center max-w-3xl">
                        <div className="section-header">EARLY GAME</div>
                        <h1 className="text-4xl font-bold tracking-tight text-white">{pageContent?.heroTitle || 'Early Game Project Hub'}</h1>
                        <div className="text-text-secondary mt-4 space-y-4">
                            <div>
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {pageContent?.heroSubtitle || `Early Game (Proof of Concept)
A small, focused multiplayer game that promotes teamwork and cooperation. The primary goal is to test and refine our community development systems (task management, volunteering, crediting, feedback loops). It should be relatively quick to make while still being genuinely fun and multiplayer.`}
                                </ReactMarkdown>
                            </div>
                        </div>
                    </div>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2">
                        <Link to="/projects" className="btn-primary">Volunteer</Link>
                    </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    <div className="md:col-span-2">
                        <div className="section-header">Early game goals</div>
                        <div className="cyber-card p-4 mb-6 text-text-secondary prose prose-invert max-w-none">
                            {(() => {
                                let goalsText = pageContent?.goals || `**Early Game (Proof of Concept)**

* Test and prove our community-driven development model works.
* Build and refine core cooperation and teamwork mechanics.
* Create a genuinely fun experience that brings players together.
* Establish transparent systems for volunteering, task tracking, and crediting contributors.
* Gather real community feedback to improve future projects.

<small>Success metric: Strong community engagement during development + positive feedback on cooperative gameplay.</small>`;
                                // Normalize: convert literal backslash-n sequences to real newlines, convert <small> to markdown italics, strip other HTML, ensure list markers
                                goalsText = goalsText.split('\\n').join('\n');
                                goalsText = goalsText
                                    .replace(/<small>(.*?)<\/small>/gi, '_$1_')
                                    .replace(/<[^>]*>/g, '');
                                goalsText = goalsText.split('\n').map(line => {
                                    const t = line.trim();
                                    if (!t) return '';
                                    if (t.toLowerCase().startsWith('success metric:')) return `_${t}_`;
                                    if (t.startsWith('- ') || t.startsWith('* ') || t.startsWith('> ') || t.startsWith('**') || t.startsWith('#') || t.startsWith('_')) return t;
                                    return `- ${t}`;
                                }).filter(Boolean).join('\n');
                                return <ReactMarkdown remarkPlugins={[remarkGfm]}>{goalsText}</ReactMarkdown>;
                            })()}
                        </div>

                        <div className="section-header mb-4">Game Overviews</div>
                        <div className="grid md:grid-cols-3 gap-4 mb-4">
                            <Link to="/projects/early/g1" className="cyber-card interactive p-6 hover:border-neon-cyan/40">
                                <div className="font-bold text-white text-lg">Early Game Project 1</div>
                                <div className="text-text-secondary mt-2">In Development</div>
                                <div className="text-sm text-neon-cyan mt-4">View Project →</div>
                            </Link>

                            <Link to="/projects/early/g2" className="cyber-card interactive p-6 hover:border-neon-cyan/40">
                                <div className="font-bold text-white text-lg">Early Game Project 2</div>
                                <div className="text-text-secondary mt-2">Brainstorming</div>
                                <div className="text-sm text-neon-cyan mt-4">View Project →</div>
                            </Link>

                            <Link to="/projects/early/g3" className="cyber-card interactive p-6 hover:border-neon-cyan/40">
                                <div className="font-bold text-white text-lg">Early Game Project 3</div>
                                <div className="text-text-secondary mt-2">Brainstorming</div>
                                <div className="text-sm text-neon-cyan mt-4">View Project →</div>
                            </Link>
                        </div>

                        <div className="mt-6">
                            <div className="section-header">Target Style for Early Game Projects</div>
                            <div className="cyber-card p-4 text-text-secondary prose prose-invert max-w-none">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {pageContent?.targetStyle || `We are looking for small, focused multiplayer games that emphasize cooperation and teamwork.

**Examples of the kind of games we want to make:**
- Cooperative survival challenges (inspired by Lethal Company or PlateUp!)
- Shared vehicle/mech operation or crew-based gameplay
- Simple team-based exploration, building, and defense
- Light resource management with clear role differentiation in short sessions`}
                                </ReactMarkdown>
                            </div>
                        </div>

                        <div className="mt-6">
                            <Link to="/ideas" className="btn-neon">Submit Ideas for Early Game</Link>
                            {isModerator && (
                                <Link to="/projects/early/edit" className="btn-neon ml-4">Edit Page</Link>
                            )}
                        </div>
                    </div>

                    <div className="md:col-span-1">
                        <div className="section-header mb-4">About Early Game</div>
                        <div className="cyber-card p-4 mb-4 text-text-secondary prose prose-invert max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {pageContent?.aboutText || 'Early Game is the foundation of Together Forge. We intentionally start small so we can focus on what matters most: building fun cooperative mechanics and proving that a transparent, community-supported development process can create great games. No flashy graphics. No corporate mandates. Just real teamwork, meaningful systems, and games made by the community, for the community.'}
                            </ReactMarkdown>
                        </div>

                        <div className="section-header mb-2">How to Help</div>
                        <div className="cyber-card p-4 text-text-secondary prose prose-invert max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {pageContent?.howToHelp || `- Submit game concepts, mechanics, or ideas through the Game Ideas page.\n- Volunteer your skills (development, art, design, testing, writing, moderation, etc.).\n- Help test prototypes and give honest feedback on what feels fun.\n- Join discussions on existing ideas to help refine them.\n- Share the project with streamers, communities, and other creators.\n- Support the Forge through donations to help fund development tools and time.`}
                            </ReactMarkdown>
                            <div className="text-text-secondary text-sm mt-3">Every contribution is credited publicly, and we are transparent about how support is used.</div>
                            <div className="mt-4">
                                <Link to="/get-involved" className="btn-primary">Get Involved</Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectsEarly;
