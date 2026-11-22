'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { UserPreferences, UserProfile } from '@/types/vybe';
import { AVATAR_PRESETS } from '@/lib/constants';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'warning' | 'error';
}

interface VybeContextValue {
  user: UserProfile | null;
  isLoadingAuth: boolean;
  isSupabaseConnected: boolean;
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  dismissToast: (id: string) => void;
  signInWithEmail: (email: string, password: string) => Promise<UserProfile>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<UserProfile>;
  signInWithGoogle: () => Promise<void>;
  continueAsGuest: (customName?: string) => Promise<UserProfile>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  signOut: () => Promise<void>;
  isAuthModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  isProfileModalOpen: boolean;
  setProfileModalOpen: (open: boolean) => void;
}

const VybeContext = createContext<VybeContextValue | undefined>(undefined);

const STORAGE_KEY = 'vybe_active_user_v1';

const DEFAULT_PREFERENCES: UserPreferences = {
  reducedMotion: false,
  reactionSounds: false,
  autoSyncThresholdSec: 2.0,
  floatingChatDefault: false,
  showPresenceToFriends: true,
  defaultRoomPrivacy: 'public',
};

export function VybeProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);
  const [isProfileModalOpen, setProfileModalOpen] = useState(false);
  const supabaseConfigured = isSupabaseConfigured();

  const addToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-4), { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const syncUserToServer = useCallback(async (profile: UserProfile) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'UPSERT_USER', user: profile }),
      });
    } catch {
      // Ignore network hiccup
    }
  }, []);

  // Hydrate initial session from localStorage or Supabase Auth
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as UserProfile;
          if (parsed && parsed.id && mounted) {
            setUser(parsed);
            syncUserToServer(parsed);
          }
        }

        const supabase = getSupabaseBrowserClient();
        if (supabase) {
          const { data } = await supabase.auth.getSession();
          if (data.session?.user && mounted) {
            const sbUser = data.session.user;
            const profile: UserProfile = {
              id: sbUser.id,
              email: sbUser.email || '',
              displayName:
                sbUser.user_metadata?.full_name ||
                sbUser.user_metadata?.display_name ||
                sbUser.email?.split('@')[0] ||
                'VYBE Member',
              username: (sbUser.email?.split('@')[0] || 'member').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase(),
              avatarUrl: sbUser.user_metadata?.avatar_url || AVATAR_PRESETS[0],
              bio: 'Cinema enthusiast on VYBE.',
              presenceStatus: 'online',
              accentColor: '#6D5DFB',
              isGuest: false,
              preferences: DEFAULT_PREFERENCES,
              createdAt: sbUser.created_at || new Date().toISOString(),
            };
            setUser(profile);
            await syncUserToServer(profile);
          }
        }
      } finally {
        if (mounted) setIsLoadingAuth(false);
      }
    }

    initAuth();
    return () => {
      mounted = false;
    };
  }, [syncUserToServer]);

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<UserProfile> => {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !password) {
        throw new Error('Please enter both email and password.');
      }

      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (error) throw new Error(error.message);
        if (data.user) {
          const profile: UserProfile = {
            id: data.user.id,
            email: data.user.email || cleanEmail,
            displayName:
              data.user.user_metadata?.display_name ||
              cleanEmail.split('@')[0],
            username: cleanEmail.split('@')[0].replace(/[^a-z0-9_]/g, ''),
            avatarUrl: data.user.user_metadata?.avatar_url || AVATAR_PRESETS[0],
            bio: 'Cinema enthusiast on VYBE.',
            presenceStatus: 'online',
            accentColor: '#6D5DFB',
            isGuest: false,
            preferences: DEFAULT_PREFERENCES,
            createdAt: new Date().toISOString(),
          };
          setUser(profile);
          await syncUserToServer(profile);
          addToast({
            title: `Welcome back, ${profile.displayName}`,
            description: 'Signed in via Supabase Auth.',
            variant: 'success',
          });
          return profile;
        }
      }

      // Check server store for existing user or create authenticated session
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'LOGIN_EMAIL', email: cleanEmail }),
      });
      const data = await res.json();
      if (data.user) {
        const existing: UserProfile = {
          ...data.user,
          presenceStatus: 'online',
        };
        setUser(existing);
        await syncUserToServer(existing);
        addToast({
          title: `Welcome back, ${existing.displayName}`,
          description: 'Your watchlists and rooms are ready.',
          variant: 'success',
        });
        return existing;
      }

      const namePart = cleanEmail.split('@')[0];
      const displayName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
      const newProfile: UserProfile = {
        id: `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        email: cleanEmail,
        displayName,
        username: namePart.replace(/[^a-z0-9_]/g, '') || 'viewer',
        avatarUrl: AVATAR_PRESETS[Math.floor(Math.random() * AVATAR_PRESETS.length)],
        bio: 'Cinema lover & late-night watch party host.',
        presenceStatus: 'online',
        accentColor: '#6D5DFB',
        isGuest: false,
        preferences: DEFAULT_PREFERENCES,
        createdAt: new Date().toISOString(),
      };
      setUser(newProfile);
      await syncUserToServer(newProfile);
      addToast({
        title: `Signed in as ${newProfile.displayName}`,
        description: 'Ready to host or join a watch party.',
        variant: 'success',
      });
      return newProfile;
    },
    [addToast, syncUserToServer]
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string, displayName: string): Promise<UserProfile> => {
      const cleanEmail = email.trim().toLowerCase();
      const cleanName = displayName.trim() || cleanEmail.split('@')[0];
      if (!cleanEmail || password.length < 6) {
        throw new Error('Please provide a valid email and a password of at least 6 characters.');
      }

      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              display_name: cleanName,
              full_name: cleanName,
              avatar_url: AVATAR_PRESETS[0],
            },
          },
        });
        if (error) throw new Error(error.message);
        if (data.user) {
          const profile: UserProfile = {
            id: data.user.id,
            email: cleanEmail,
            displayName: cleanName,
            username: cleanName.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
            avatarUrl: AVATAR_PRESETS[0],
            bio: 'Cinema lover & watch party host.',
            presenceStatus: 'online',
            accentColor: '#6D5DFB',
            isGuest: false,
            preferences: DEFAULT_PREFERENCES,
            createdAt: new Date().toISOString(),
          };
          setUser(profile);
          await syncUserToServer(profile);
          addToast({
            title: 'Account created!',
            description: `Welcome to VYBE, ${cleanName}.`,
            variant: 'success',
          });
          return profile;
        }
      }

      const newProfile: UserProfile = {
        id: `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        email: cleanEmail,
        displayName: cleanName,
        username: cleanName.toLowerCase().replace(/[^a-z0-9_]/g, '_') || 'vybe_user',
        avatarUrl: AVATAR_PRESETS[Math.floor(Math.random() * AVATAR_PRESETS.length)],
        bio: 'Cinema lover & late-night watch party host.',
        presenceStatus: 'online',
        accentColor: '#6D5DFB',
        isGuest: false,
        preferences: DEFAULT_PREFERENCES,
        createdAt: new Date().toISOString(),
      };
      setUser(newProfile);
      await syncUserToServer(newProfile);
      addToast({
        title: 'Welcome to VYBE!',
        description: `Profile created for ${cleanName}.`,
        variant: 'success',
      });
      return newProfile;
    },
    [addToast, syncUserToServer]
  );

  const signInWithGoogle = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) {
        addToast({
          title: 'Google OAuth Error',
          description: error.message,
          variant: 'error',
        });
      }
      return;
    }

    // Local development Google account sign-in simulation when Supabase OAuth redirect is not configured
    const googleProfile: UserProfile = {
      id: `usr-google-${Date.now().toString(36)}`,
      email: 'alex.rivera@gmail.com',
      displayName: 'Alex Rivera',
      username: 'alex_rivera',
      avatarUrl: AVATAR_PRESETS[4],
      bio: 'Signed in with Google • 4K Cinema Host',
      presenceStatus: 'online',
      accentColor: '#6D5DFB',
      isGuest: false,
      preferences: DEFAULT_PREFERENCES,
      createdAt: new Date().toISOString(),
    };
    setUser(googleProfile);
    await syncUserToServer(googleProfile);
    addToast({
      title: 'Connected with Google',
      description: `Signed in as ${googleProfile.displayName} (${googleProfile.email})`,
      variant: 'success',
    });
  }, [addToast, syncUserToServer]);

  const continueAsGuest = useCallback(
    async (customName?: string): Promise<UserProfile> => {
      const suffix = Math.floor(100 + Math.random() * 899);
      const displayName = (customName && customName.trim()) || `Guest Viewer #${suffix}`;
      const guestProfile: UserProfile = {
        id: `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        email: `guest_${suffix}@vybe.local`,
        displayName,
        username: `guest_${suffix}`,
        avatarUrl: AVATAR_PRESETS[suffix % AVATAR_PRESETS.length],
        bio: 'Joining watch party as a guest.',
        presenceStatus: 'online',
        accentColor: '#6D5DFB',
        isGuest: true,
        preferences: DEFAULT_PREFERENCES,
        createdAt: new Date().toISOString(),
      };
      setUser(guestProfile);
      await syncUserToServer(guestProfile);
      addToast({
        title: `Joined as ${guestProfile.displayName}`,
        description: 'You can customize your avatar or upgrade to a full account anytime.',
      });
      return guestProfile;
    },
    [addToast, syncUserToServer]
  );

  const updateProfile = useCallback(
    async (updates: Partial<UserProfile>) => {
      if (!user) return;
      const updated: UserProfile = {
        ...user,
        ...updates,
      };
      setUser(updated);
      await syncUserToServer(updated);

      const supabase = getSupabaseBrowserClient();
      if (supabase && !updated.isGuest) {
        await supabase.from('profiles').upsert({
          id: updated.id,
          display_name: updated.displayName,
          username: updated.username,
          avatar_url: updated.avatarUrl,
          bio: updated.bio,
          presence_status: updated.presenceStatus,
          accent_color: updated.accentColor,
        });
      }

      addToast({
        title: 'Profile updated',
        description: 'Your changes have been saved.',
        variant: 'success',
      });
    },
    [addToast, syncUserToServer, user]
  );

  const updatePreferences = useCallback(
    async (updates: Partial<UserPreferences>) => {
      if (!user) return;
      const updated: UserProfile = {
        ...user,
        preferences: {
          ...user.preferences,
          ...updates,
        },
      };
      setUser(updated);
      await syncUserToServer(updated);
      addToast({
        title: 'Preferences saved',
        variant: 'success',
      });
    },
    [addToast, syncUserToServer, user]
  );

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    addToast({
      title: 'Signed out',
      description: 'See you at the next screening!',
    });
  }, [addToast]);

  return (
    <VybeContext.Provider
      value={{
        user,
        isLoadingAuth,
        isSupabaseConnected: supabaseConfigured,
        toasts,
        addToast,
        dismissToast,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        continueAsGuest,
        updateProfile,
        updatePreferences,
        signOut,
        isAuthModalOpen,
        setAuthModalOpen,
        isProfileModalOpen,
        setProfileModalOpen,
      }}
    >
      {children}
    </VybeContext.Provider>
  );
}

export function useVybe() {
  const ctx = useContext(VybeContext);
  if (!ctx) {
    throw new Error('useVybe must be used within a VybeProvider');
  }
  return ctx;
}
