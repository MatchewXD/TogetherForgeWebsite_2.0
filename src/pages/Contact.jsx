import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Button from '../components/ui/Buttons';
import { DISCORD_URL } from '../constants/communityLinks';
import { useReportConcern } from '../context/ReportConcernContext';

const Contact = () => {
  const { openReportConcern } = useReportConcern();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setUser(session?.user || null);
      if (session?.user?.email) {
        setFormData((f) => ({
          ...f,
          email: f.email || session.user.email,
        }));
      }
      setAuthLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null);
    });
    return () => {
      mounted = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!user) {
      setError('Sign in to send a message.');
      return;
    }
    const submissions = JSON.parse(
      localStorage.getItem('tf_contact_messages') || '[]'
    );
    submissions.push({
      ...formData,
      userId: user.id,
      timestamp: Date.now(),
    });
    localStorage.setItem('tf_contact_messages', JSON.stringify(submissions));
    setSubmitted(true);
    setFormData({ name: '', email: user.email || '', message: '' });
  };

  return (
    <div className="pt-20 min-h-screen">
      <div className="border-b border-white/10 bg-cyber-surface py-16">
        <div className="container-custom">
          <div>
            <div className="section-header">CONTACT</div>
            <h1 className="text-5xl font-bold tracking-tight text-white">
              Get in touch with the Forge
            </h1>
          </div>
        </div>
      </div>

      <div className="container-custom py-12 max-w-2xl">
        <div className="cyber-card p-10">
          <div className="text-center mb-10">
            <MessageCircle className="w-16 h-16 mx-auto text-neon-cyan mb-6" />
            <p className="text-text-secondary">
              Have questions, ideas, or want to collaborate? Reach out below or
              join our community on Discord.
            </p>
          </div>

          {authLoading ? (
            <p className="text-center text-sm text-text-muted">
              Checking sign-in…
            </p>
          ) : !user ? (
            <div className="text-center space-y-4 py-6">
              <h2 className="text-xl font-bold text-white">Sign in required</h2>
              <p className="text-sm text-text-secondary max-w-md mx-auto leading-relaxed">
                Only signed-in members can send contact messages. Log in or join
                the forge first.
              </p>
              <Link to="/profile">
                <Button className="mt-2">Log in / Join</Button>
              </Link>
            </div>
          ) : submitted ? (
            <div className="text-center py-10 text-neon-cyan">
              Thank you! Your message has been received.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              {error && (
                <p
                  role="alert"
                  className="text-sm text-red-300 border border-red-400/40 bg-red-400/10 rounded-lg px-3 py-2"
                >
                  {error}
                </p>
              )}
              <div>
                <label className="block text-sm font-mono tracking-widest mb-2 text-neon-cyan">
                  NAME
                </label>
                <input
                  type="text"
                  required
                  className="w-full bg-cyber-surface border border-white/20 p-4 text-white focus:border-neon-cyan outline-none"
                  placeholder="Your name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-mono tracking-widest mb-2 text-neon-cyan">
                  EMAIL
                </label>
                <input
                  type="email"
                  required
                  className="w-full bg-cyber-surface border border-white/20 p-4 text-white focus:border-neon-cyan outline-none"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-mono tracking-widest mb-2 text-neon-cyan">
                  MESSAGE
                </label>
                <textarea
                  rows="8"
                  required
                  className="w-full bg-cyber-surface border border-white/20 p-4 text-white focus:border-neon-cyan outline-none"
                  placeholder="Your message..."
                  value={formData.message}
                  onChange={(e) =>
                    setFormData({ ...formData, message: e.target.value })
                  }
                />
              </div>
              <button
                type="submit"
                className="btn-primary btn-neon w-full py-5 text-lg"
              >
                SEND MESSAGE
              </button>
            </form>
          )}
        </div>

        {/* Quiet secondary path — community / moderation concerns */}
        <div className="mt-10 pt-8 border-t border-white/10 text-center space-y-2">
          <p className="text-xs font-mono tracking-widest text-text-muted uppercase">
            Community concerns
          </p>
          <p className="text-sm text-text-muted max-w-md mx-auto leading-relaxed">
            Need to share a private concern about moderation or community
            behavior? You can do so without using the form above.
          </p>
          <button
            type="button"
            onClick={() => openReportConcern()}
            className="text-sm text-text-secondary hover:text-neon-cyan transition-colors underline-offset-4 hover:underline"
          >
            Report a concern
          </button>
        </div>

        <div className="text-center mt-12 text-text-muted text-sm">
          Prefer real-time chat?{' '}
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neon-cyan hover:underline"
          >
            Join the Discord
          </a>
        </div>
      </div>
    </div>
  );
};

export default Contact;
