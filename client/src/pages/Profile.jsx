import { useEffect, useMemo, useState } from 'react';
import { SignedIn, SignedOut, SignInButton, SignOutButton, useUser } from '@/lib/authClient';

const profileDefaults = {
  displayName: '',
  role: 'AI Crypto Investor',
  phone: '',
  location: '',
  contactEmail: '',
  riskStyle: 'Balanced',
  tradingHorizon: 'Swing 7-30D',
  preferredMarket: 'Large-cap crypto',
  bio: '',
};

const riskOptions = ['Conservative', 'Balanced', 'Aggressive'];
const horizonOptions = ['Intraday', 'Swing 7-30D', 'Position 30-180D', 'Long-term 1Y+'];
const marketOptions = ['Large-cap crypto', 'AI tokens', 'Layer 1 assets', 'Meme/high beta', 'DeFi'];

const storageKey = (userId) => `quantora-profile:${userId || 'guest'}`;

const getUserEmail = (user) =>
  user?.primaryEmailAddress?.emailAddress ||
  user?.emailAddresses?.[0]?.emailAddress ||
  user?.externalAccounts?.[0]?.emailAddress ||
  '';

const readProfile = (user) => {
  const base = {
    ...profileDefaults,
    displayName: user?.fullName || user?.username || 'Quantora user',
    contactEmail: getUserEmail(user),
  };

  try {
    return {
      ...base,
      ...JSON.parse(window.localStorage.getItem(storageKey(user?.id)) || '{}'),
    };
  } catch {
    return base;
  }
};

const Profile = () => {
  const { user } = useUser();
  const [profile, setProfile] = useState(() => readProfile(user));
  const [savedAt, setSavedAt] = useState('');
  const [saving, setSaving] = useState(false);
  const primaryEmail = getUserEmail(user) || 'No sign-in email connected';
  const initials = useMemo(
    () =>
      (profile.displayName || 'Quantora user')
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
    [profile.displayName]
  );

  useEffect(() => {
    setProfile(readProfile(user));
    setSavedAt('');
  }, [user]);

  const update = (key, value) => {
    setProfile((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    const cleanProfile = {
      ...profile,
      displayName: profile.displayName.trim() || 'Quantora user',
      contactEmail: profile.contactEmail.trim(),
    };

    window.localStorage.setItem(storageKey(user?.id), JSON.stringify(cleanProfile));

    try {
      if (user?.update && cleanProfile.displayName) {
        const [firstName, ...rest] = cleanProfile.displayName.split(' ');
        await user.update({
          firstName,
          lastName: rest.join(' ') || undefined,
        });
      }
    } catch {
      // Local profile data still saves even if the auth provider rejects a name update.
    } finally {
      setProfile(cleanProfile);
      setSavedAt(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-2xl border border-accent/25 bg-neutral-950/80 p-6 shadow-glow">
        <div className="profile-aurora absolute inset-0 opacity-70" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Quantora Account</p>
            <h1 className="mt-2 text-3xl font-semibold text-neutral-100">Profile Command Center</h1>
            <p className="mt-2 max-w-2xl text-sm text-neutral-400">
              Manage your investor profile, market preferences, contact route, and Quantora personalization.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <ProfileStat label="Risk" value={profile.riskStyle} />
            <ProfileStat label="Horizon" value={profile.tradingHorizon} />
            <ProfileStat label="Market" value={profile.preferredMarket} />
          </div>
        </div>
      </header>

      <SignedIn>
        <form onSubmit={handleSave} className="grid gap-5 xl:grid-cols-[0.9fr_1.3fr]">
          <section className="relative overflow-hidden rounded-2xl border border-accent/25 bg-neutral-900/80 p-6 shadow-glow backdrop-blur">
            <div className="profile-card-grid absolute inset-0 opacity-30" />
            <div className="relative">
              <div className="mx-auto grid h-28 w-28 place-items-center rounded-[2rem] border border-accent/40 bg-accent/15 text-4xl font-bold text-accent shadow-glow">
                {initials || 'Q'}
              </div>
              <div className="mt-5 text-center">
                <h2 className="text-2xl font-semibold text-neutral-50">{profile.displayName}</h2>
                <p className="mt-1 text-sm text-neutral-400">{profile.role}</p>
                <p className="mt-2 text-xs text-neutral-500">{primaryEmail}</p>
              </div>

              <div className="mt-6 grid gap-3">
                <StatusPill label="Account" value="Signed in" tone="accent" />
                <StatusPill label="Profile Sync" value={savedAt ? `Saved ${savedAt}` : 'Ready'} tone="gold" />
                <StatusPill label="Security" value="Managed by auth provider" tone="neutral" />
              </div>

              <SignOutButton>
                <button
                  type="button"
                  className="mt-6 w-full rounded-full border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/15"
                >
                  Logout
                </button>
              </SignOutButton>
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-600/30 bg-neutral-900/80 p-6 shadow-glow backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Editable Details</p>
                <h2 className="mt-2 text-2xl font-semibold text-neutral-50">Personal profile</h2>
                <p className="mt-1 text-sm text-neutral-400">
                  These details personalize AI Expert, portfolio summaries, and notification wording.
                </p>
              </div>
              {savedAt && <p className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs text-accent">Saved {savedAt}</p>}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Field label="Display name">
                <input
                  className={inputClass}
                  value={profile.displayName}
                  onChange={(event) => update('displayName', event.target.value)}
                  placeholder="Your name"
                />
              </Field>
              <Field label="Profile role">
                <input
                  className={inputClass}
                  value={profile.role}
                  onChange={(event) => update('role', event.target.value)}
                  placeholder="AI Crypto Investor"
                />
              </Field>
              <Field label="Contact email">
                <input
                  className={inputClass}
                  type="email"
                  value={profile.contactEmail}
                  onChange={(event) => update('contactEmail', event.target.value)}
                  placeholder="email@example.com"
                />
              </Field>
              <Field label="Phone">
                <input
                  className={inputClass}
                  value={profile.phone}
                  onChange={(event) => update('phone', event.target.value)}
                  placeholder="+1 000 000 0000"
                />
              </Field>
              <Field label="Location">
                <input
                  className={inputClass}
                  value={profile.location}
                  onChange={(event) => update('location', event.target.value)}
                  placeholder="City, country"
                />
              </Field>
              <Field label="Risk style">
                <select
                  className={inputClass}
                  value={profile.riskStyle}
                  onChange={(event) => update('riskStyle', event.target.value)}
                >
                  {riskOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </Field>
              <Field label="Trading horizon">
                <select
                  className={inputClass}
                  value={profile.tradingHorizon}
                  onChange={(event) => update('tradingHorizon', event.target.value)}
                >
                  {horizonOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </Field>
              <Field label="Preferred market">
                <select
                  className={inputClass}
                  value={profile.preferredMarket}
                  onChange={(event) => update('preferredMarket', event.target.value)}
                >
                  {marketOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </Field>
              <Field label="Investor note" wide>
                <textarea
                  className={`${inputClass} min-h-28 resize-none`}
                  value={profile.bio}
                  onChange={(event) => update('bio', event.target.value)}
                  placeholder="What should Quantora remember about your trading style, risk limits, or market focus?"
                />
              </Field>
            </div>

            <div className="mt-6 flex flex-col gap-3 border-t border-neutral-700/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-relaxed text-neutral-500">
                Sign-in email stays protected by your auth provider. Custom profile fields are stored for this Quantora account on this app.
              </p>
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-background shadow-glow transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save profile'}
              </button>
            </div>
          </section>
        </form>
      </SignedIn>

      <SignedOut>
        <div className="rounded-2xl border border-neutral-600/30 bg-neutral-900/70 p-6 text-sm text-neutral-200 shadow-glow">
          <p>Sign in to create and edit your Quantora profile.</p>
          <SignInButton mode="modal">
            <button
              type="button"
              className="mt-4 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-background"
            >
              Sign In
            </button>
          </SignInButton>
        </div>
      </SignedOut>
    </div>
  );
};

const inputClass =
  'w-full rounded-xl border border-neutral-700 bg-neutral-950/70 px-4 py-3 text-sm text-neutral-100 outline-none transition focus:border-accent/70 focus:shadow-[0_0_0_3px_rgba(0,255,136,0.12)]';

const Field = ({ label, children, wide = false }) => (
  <label className={wide ? 'md:col-span-2' : ''}>
    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{label}</span>
    <div className="mt-2">{children}</div>
  </label>
);

const ProfileStat = ({ label, value }) => (
  <div className="min-w-24 rounded-xl border border-neutral-700/70 bg-neutral-950/70 px-3 py-2">
    <p className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</p>
    <p className="mt-1 truncate text-xs font-semibold text-neutral-100">{value}</p>
  </div>
);

const StatusPill = ({ label, value, tone }) => {
  const styles = {
    accent: 'border-accent/30 bg-accent/10 text-accent',
    gold: 'border-gold/30 bg-gold/10 text-gold',
    neutral: 'border-neutral-700 bg-neutral-950/70 text-neutral-300',
  };

  return (
    <div className={`flex items-center justify-between rounded-xl border px-3 py-3 text-sm ${styles[tone]}`}>
      <span className="text-neutral-400">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
};

export default Profile;
