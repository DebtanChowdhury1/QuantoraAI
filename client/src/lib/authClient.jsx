import {
  ClerkProvider as RealClerkProvider,
  SignedIn as RealSignedIn,
  SignedOut as RealSignedOut,
  SignInButton as RealSignInButton,
  UserButton as RealUserButton,
  UserProfile as RealUserProfile,
  useUser as realUseUser,
} from '@clerk/clerk-react';

export const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
export const isAuthEnabled = Boolean(clerkPublishableKey);

export const ClerkProvider = ({ children, ...providerProps }) => {
  if (!isAuthEnabled) {
    return <>{children}</>;
  }
  return (
    <RealClerkProvider publishableKey={clerkPublishableKey} {...providerProps}>
      {children}
    </RealClerkProvider>
  );
};

export const SignedIn = ({ children }) => {
  if (!isAuthEnabled) {
    return null;
  }
  return <RealSignedIn>{children}</RealSignedIn>;
};

export const SignedOut = ({ children }) => {
  if (!isAuthEnabled) {
    return <>{children}</>;
  }
  return <RealSignedOut>{children}</RealSignedOut>;
};

export const SignInButton = (props) => {
  if (!isAuthEnabled) {
    return props.children || null;
  }
  return <RealSignInButton {...props} />;
};

export const UserButton = (props) => {
  if (!isAuthEnabled) {
    return null;
  }
  return <RealUserButton {...props} />;
};

export const UserProfile = (props) => {
  if (!isAuthEnabled) {
    return (
      <div className="text-sm text-neutral-300">
        Clerk profile UI unavailable. Configure VITE_CLERK_PUBLISHABLE_KEY to enable account
        management.
      </div>
    );
  }
  return <RealUserProfile {...props} />;
};

export const useUser = () => {
  if (!isAuthEnabled) {
    return { isSignedIn: false, user: null };
  }
  return realUseUser();
};
