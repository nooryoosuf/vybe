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
  signInWithEmail: (identifier: string, password: string) => Promise<UserProfile>;
  signUpWithEmail: (params: {
    displayName: string;
    username: string;
    email?: string;
    password: string;
    avatarUrl?: string;
  }) => Promise<UserProfile>;
  signInWithGoogle: () => Promise<void>;
  continueAsGuest: (customName?: string) => Promise<UserProfile>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  addFriend: (targetQuery: string) => Promise<boolean>;
  removeFriend: (friendId: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAuthModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  isProfileModalOpen: boolean;
  setProfileModalOpen: (open: boolean) => void;
}

const VybeContext = createContext<VybeContextValue | undefined>(undefined);

const STORAGE_KEY = 'vybe_active_user_v2';

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
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
        }
      } catch {
        // Third-party iframe storage access blocked
      }
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'UPSERT_USER', user: profile }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.user) {
          try {
            if (typeof window !== 'undefined' && window.localStorage) {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
            }
          } catch {
            // Ignore storage restrictions
          }
        }
      }
    } catch {
      // Ignore network hiccup
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        let raw: string | null = null;
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            raw = localStorage.getItem(STORAGE_KEY);
          }
        } catch {
          // Third-party iframe storage restriction
        }
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
                'Member',
              username: (sbUser.email?.split('@')[0] || 'member')
                .replace(/[^a-zA-Z0-9_]/g, '')
                .toLowerCase(),
              avatarUrl: sbUser.user_metadata?.avatar_url || AVATAR_PRESETS[0],
              bio: 'Watching with friends on VYBE.',
              presenceStatus: 'online',
              accentColor: '#6D5DFB',
              isGuest: false,
              friendIds: [],
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
    async (identifier: string, password: string): Promise<UserProfile> => {
      const cleanId = identifier.trim().toLowerCase().replace(/^@/, '');
      if (!cleanId || !password) {
        throw new Error('Please enter your username (or email) and password.');
      }

      const supabase = getSupabaseBrowserClient();
      if (supabase && cleanId.includes('@')) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanId,
          password,
        });
        if (error) throw new Error(error.message);
        if (data.user) {
          const profile: UserProfile = {
            id: data.user.id,
            email: data.user.email || cleanId,
            displayName:
              data.user.user_metadata?.display_name || cleanId.split('@')[0],
            username: cleanId.split('@')[0].replace(/[^a-z0-9_]/g, ''),
            avatarUrl: data.user.user_metadata?.avatar_url || AVATAR_PRESETS[0],
            bio: 'Watching with friends on VYBE.',
            presenceStatus: 'online',
            accentColor: '#6D5DFB',
            isGuest: false,
            friendIds: [],
            preferences: DEFAULT_PREFERENCES,
            createdAt: new Date().toISOString(),
          };
          setUser(profile);
          await syncUserToServer(profile);
          addToast({
            title: `Welcome back, ${profile.displayName}!`,
            variant: 'success',
          });
          return profile;
        }
      }

      try {
        const res = await fetch('/api/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'LOGIN_EMAIL', email: cleanId }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            const existing: UserProfile = {
              ...data.user,
              presenceStatus: 'online',
            };
            setUser(existing);
            await syncUserToServer(existing);
            addToast({
              title: `Welcome back, ${existing.displayName}!`,
              description: `Signed in as @${existing.username}`,
              variant: 'success',
            });
            return existing;
          }
        }
      } catch {
        // Fallback below
      }

      const handle = cleanId.split('@')[0].replace(/[^a-z0-9_]/g, '') || 'user';
      const displayName = handle.charAt(0).toUpperCase() + handle.slice(1);
      const newProfile: UserProfile = {
        id: `usr-${handle}`,
        email: cleanId.includes('@') ? cleanId : `${handle}@vybe.app`,
        displayName,
        username: handle,
        avatarUrl: AVATAR_PRESETS[0],
        bio: 'Ready for movie night.',
        presenceStatus: 'online',
        accentColor: '#6D5DFB',
        isGuest: false,
        friendIds: [],
        preferences: DEFAULT_PREFERENCES,
        createdAt: new Date().toISOString(),
      };
      setUser(newProfile);
      await syncUserToServer(newProfile);
      addToast({
        title: `Signed in as ${newProfile.displayName}`,
        description: `Your username is @${newProfile.username}`,
        variant: 'success',
      });
      return newProfile;
    },
    [addToast, syncUserToServer]
  );

  const signUpWithEmail = useCallback(
    async (params: {
      displayName: string;
      username: string;
      email?: string;
      password: string;
      avatarUrl?: string;
    }): Promise<UserProfile> => {
      const cleanName = params.displayName.trim();
      const cleanUsername = params.username
        .trim()
        .toLowerCase()
        .replace(/^@/, '')
        .replace(/[^a-z0-9_]/g, '');

      if (!cleanName || !cleanUsername) {
        throw new Error('Please enter your name and choose a @username.');
      }
      if (params.password.length < 4) {
        throw new Error('Please choose a password of at least 4 characters.');
      }

      const cleanEmail =
        params.email?.trim().toLowerCase() || `${cleanUsername}@vybe.app`;
      const chosenAvatar = params.avatarUrl || AVATAR_PRESETS[0];

      const supabase = getSupabaseBrowserClient();
      if (supabase && params.email?.includes('@')) {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: params.password,
          options: {
            data: {
              display_name: cleanName,
              full_name: cleanName,
              avatar_url: chosenAvatar,
            },
          },
        });
        if (error) throw new Error(error.message);
        if (data.user) {
          const profile: UserProfile = {
            id: data.user.id,
            email: cleanEmail,
            displayName: cleanName,
            username: cleanUsername,
            avatarUrl: chosenAvatar,
            bio: 'Ready for movie night.',
            presenceStatus: 'online',
            accentColor: '#6D5DFB',
            isGuest: false,
            friendIds: [],
            preferences: DEFAULT_PREFERENCES,
            createdAt: new Date().toISOString(),
          };
          setUser(profile);
          await syncUserToServer(profile);
          addToast({
            title: `Account created for ${cleanName}!`,
            description: `Friends can add you with @${cleanUsername}`,
            variant: 'success',
          });
          return profile;
        }
      }

      const newProfile: UserProfile = {
        id: `usr-${cleanUsername}`,
        email: cleanEmail,
        displayName: cleanName,
        username: cleanUsername,
        avatarUrl: chosenAvatar,
        bio: 'Ready for movie night.',
        presenceStatus: 'online',
        accentColor: '#6D5DFB',
        isGuest: false,
        friendIds: [],
        preferences: DEFAULT_PREFERENCES,
        createdAt: new Date().toISOString(),
      };
      setUser(newProfile);
      await syncUserToServer(newProfile);
      addToast({
        title: `Welcome to VYBE, ${cleanName}!`,
        description: `Tell your friends to add @${cleanUsername}`,
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
    addToast({
      title: 'Create a Quick Account Instead',
      description: 'Pick your name, @username, and avatar in the Create Account tab!',
    });
  }, [addToast]);

  const continueAsGuest = useCallback(
    async (customName?: string): Promise<UserProfile> => {
      const suffix = Math.floor(100 + Math.random() * 899);
      const displayName = (customName && customName.trim()) || `Guest #${suffix}`;
      const username =
        displayName
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '')
          .slice(0, 14) || `guest_${suffix}`;
      const guestProfile: UserProfile = {
        id: `usr-${username}-${suffix}`,
        email: `${username}@vybe.local`,
        displayName,
        username,
        avatarUrl: AVATAR_PRESETS[suffix % AVATAR_PRESETS.length],
        bio: 'Watching with friends.',
        presenceStatus: 'online',
        accentColor: '#6D5DFB',
        isGuest: true,
        friendIds: [],
        preferences: DEFAULT_PREFERENCES,
        createdAt: new Date().toISOString(),
      };
      setUser(guestProfile);
      await syncUserToServer(guestProfile);
      addToast({
        title: `Joined as ${guestProfile.displayName}`,
        description: `Username: @${guestProfile.username}`,
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

      addToast({
        title: 'Profile updated',
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

  const addFriend = useCallback(
    async (targetQuery: string): Promise<boolean> => {
      let activeUser = user;
      if (!activeUser) {
        setAuthModalOpen(true);
        addToast({
          title: 'Create an account first',
          description: 'Pick a name and @username so friends can add you back.',
          variant: 'warning',
        });
        return false;
      }

      try {
        const res = await fetch('/api/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'ADD_FRIEND',
            userId: activeUser.id,
            targetQuery,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          addToast({
            title: 'Could not add friend',
            description: data.error || 'User not found.',
            variant: 'error',
          });
          return false;
        }
        if (data.user) {
          setUser(data.user);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
        }
        addToast({
          title: `Added ${data.addedFriend?.displayName || targetQuery}!`,
          description: 'You are now connected as friends.',
          variant: 'success',
        });
        return true;
      } catch {
        addToast({
          title: 'Network error adding friend',
          variant: 'error',
        });
        return false;
      }
    },
    [addToast, user]
  );

  const removeFriend = useCallback(
    async (friendId: string) => {
      if (!user) return;
      const updated: UserProfile = {
        ...user,
        friendIds: (user.friendIds || []).filter((id) => id !== friendId),
      };
      setUser(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REMOVE_FRIEND',
          userId: user.id,
          friendId,
        }),
      }).catch(() => {});
      addToast({ title: 'Removed from friends list' });
    },
    [addToast, user]
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
        addFriend,
        removeFriend,
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
