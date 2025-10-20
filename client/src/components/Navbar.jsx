import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@/lib/authClient';
import { useTheme } from '@/context/ThemeContext';

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/alerts', label: 'Alerts' },
  { to: '/profile', label: 'Profile' },
];

const Navbar = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <motion.header
      className="fixed inset-x-0 top-0 z-50 border-b border-neutral-600/30 bg-background/80 backdrop-blur"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4">
        <NavLink to="/" className="flex items-center gap-3 text-neutral-100">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20 text-2xl font-bold text-accent">
            Q
          </span>
          <div>
            <p className="text-lg font-semibold">Quantora AI</p>
            <p className="text-xs uppercase tracking-wide text-gold">
              Predict Smarter. Spend Nothing.
            </p>
          </div>
        </NavLink>
        <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `transition hover:text-accent ${isActive ? 'text-accent' : 'text-neutral-300'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-full border border-neutral-600/40 bg-neutral-600/20 p-2 text-sm text-neutral-200 transition hover:border-accent hover:text-accent"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '🌙' : '☀️'}
          </button>
          <SignedOut>
            <SignInButton mode="modal">
              <button
                type="button"
                className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-background shadow-glow transition hover:bg-accent/90"
              >
                Sign In
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <UserButton afterSignOutUrl="/" appearance={{ elements: { userButtonBox: 'shadow-glow' } }} />
          </SignedIn>
        </div>
      </div>
    </motion.header>
  );
};

export default Navbar;
