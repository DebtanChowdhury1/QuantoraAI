import { NavLink } from "react-router-dom";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@/lib/authClient";
import CurrencySelector from '@/components/CurrencySelector';
import { useNotifications } from '@/context/NotificationContext';

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/expert', label: 'AI Expert' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/alerts', label: 'Notifications' },
  { to: '/profile', label: 'Profile' },
];

const Navbar = () => {
  const { unreadCount } = useNotifications();

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 border-b border-neutral-600/30 bg-background/80 backdrop-blur"
    >
    <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4">
      <NavLink to="/" className="flex items-center gap-3 text-neutral-100">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20 text-2xl font-bold text-accent">
          Q
        </span>
        <div>
          <p className="text-lg font-semibold">Quantora AI</p>
          <p className="hidden text-xs uppercase tracking-wide text-gold sm:block">
            AI Crypto Intelligence
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
            <span className="relative">
              {item.label}
              {item.to === '/alerts' && unreadCount > 0 && (
                <span className="absolute -right-5 -top-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] leading-none text-white">
                  {Math.min(unreadCount, 99)}
                </span>
              )}
            </span>
          </NavLink>
        ))}
      </nav>
      <div className="flex items-center gap-3">
        <CurrencySelector />
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
    <nav className="mx-auto flex w-full max-w-7xl gap-2 overflow-x-auto px-4 pb-3 text-xs font-medium md:hidden">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `rounded-full border px-3 py-1.5 transition ${
              isActive
                ? 'border-accent/50 bg-accent/15 text-accent'
                : 'border-neutral-700 bg-neutral-900 text-neutral-300'
            }`
          }
        >
          {item.label}
          {item.to === '/alerts' && unreadCount > 0 && (
            <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] leading-none text-white">
              {Math.min(unreadCount, 99)}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  </header>
  );
};

export default Navbar;
