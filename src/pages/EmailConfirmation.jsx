import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Mail } from 'lucide-react';

const EmailConfirmation = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');

    useEffect(() => {
        // Capture email from localStorage if stored during registration
        const pendingEmail = localStorage.getItem('pending_confirmation_email');
        if (pendingEmail) setEmail(pendingEmail);

        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                // Only redirect if still on this confirmation page
                navigate('/dashboard', { replace: true });
                localStorage.removeItem('pending_confirmation_email');
            }
        });

        return () => listener.subscription.unsubscribe();
    }, [navigate]);

    return (
        <div className="pt-20 min-h-screen flex items-center justify-center">
            <div className="container-custom max-w-md text-center">
                <Link to="/" className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" /> BACK TO HOME
                </Link>

                <div className="cyber-card p-10">
                    <div className="flex justify-center mb-6">
                        <div className="w-16 h-16 rounded-full bg-neon-cyan/10 flex items-center justify-center">
                            <Mail className="w-8 h-8 text-neon-cyan" />
                        </div>
                    </div>

                    <h1 className="text-3xl font-bold mb-4">Check Your Email</h1>
                    <p className="text-text-secondary mb-6">
                        We've sent a confirmation link to{' '}
                        <span className="text-white font-mono">{email || 'your email address'}</span>.
                        <br />Please click the link in the email to activate your account.
                    </p>

                    <p className="text-sm text-text-muted">
                        Once confirmed, you will be automatically redirected to your profile.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default EmailConfirmation;