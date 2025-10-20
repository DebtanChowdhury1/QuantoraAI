import { SignedIn, SignedOut, SignInButton, UserProfile } from "@/lib/authClient";

const Profile = () => (
  <div className="space-y-8">
    <header className="rounded-3xl border border-neutral-600/30 bg-neutral-600/10 p-6 shadow-glow">
      <h1 className="text-3xl font-semibold text-neutral-100">Your Quantora Profile</h1>
      <p className="text-sm text-neutral-400">
        Manage Clerk authentication, email routing, and display preferences.
      </p>
    </header>
    <SignedIn>
      <div className="rounded-3xl border border-neutral-600/30 bg-neutral-600/10 p-6 shadow-glow">
        <UserProfile />
      </div>
    </SignedIn>
    <SignedOut>
      <div className="rounded-3xl border border-neutral-600/30 bg-neutral-600/10 p-6 text-sm text-neutral-200">
        <p>Sign in to view and manage your Quantora AI account.</p>
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

export default Profile;
