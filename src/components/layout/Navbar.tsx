'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Tv,
  LayoutDashboard,
  Sparkles,
  User,
  Radio,
  Plus,
} from 'lucide-react';
import { useVybe } from '@/context/VybeContext';
import { GlowButton } from '@/components/ui/AceternityPrimitives';

export function Navbar({
  onQuickCreateRoom,
}: {
  onQuickCreateRoom?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    user,
    setAuthModalOpen,
    setProfileModalOpen,
  } = useVybe();

  const handleStartWatchParty = () => {
    if (onQuickCreateRoom) {
      onQuickCreateRoom();
      return;
    }
    router.push('/dashboard?action=create');
  };

  return (
    <header className="sticky top-2.5 z-40 w-full px-2.5 sm:px-6">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 rounded-full vybe-glass px-3 sm:px-5">
        {/* Brand Identity */}
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          <Link href="/" className="flex items-center gap-2 group pl-0.5 shrink-0">
            <div className="relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-gradient-to-b from-[#8576FF] to-[#5645E8] shadow-[0_0_20px_rgba(109,93,251,0.55),inset_0_1px_0_0_rgba(255,255,255,0.4)] transition-transform duration-200 group-hover:scale-105">
              <Tv className="h-4 w-4 text-white" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
              </span>
            </div>
            <span className="font-display text-sm sm:text-base font-extrabold tracking-tight text-white">
              VYBE
            </span>
          </Link>

          {/* Navigation Pill Dock */}
          <nav className="flex items-center gap-0.5 sm:gap-1 rounded-full bg-black/30 border border-white/[0.07] p-0.5 sm:p-1">
            <Link
              href="/"
              className={`rounded-full px-3 sm:px-4 py-1 sm:py-1.5 text-[11px] sm:text-xs font-medium transition-all ${
                pathname === '/'
                  ? 'bg-white/[0.12] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Home
            </Link>
            <Link
              href="/dashboard"
              className={`flex items-center gap-1 rounded-full px-3 sm:px-4 py-1 sm:py-1.5 text-[11px] sm:text-xs font-medium transition-all ${
                pathname?.startsWith('/dashboard')
                  ? 'bg-white/[0.12] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutDashboard className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-vybe-accentLight" />
              <span>Movies & Lobby</span>
            </Link>
          </nav>
        </div>

        {/* Right Pill Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {user ? (
            <>
              <GlowButton
                variant="primary"
                onClick={handleStartWatchParty}
                className="py-1.5 px-3 sm:px-4 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">New Party</span>
              </GlowButton>

              <button
                type="button"
                onClick={() => setProfileModalOpen(true)}
                className="flex items-center gap-2 rounded-full vybe-glass-pill hover:bg-white/[0.1] p-1 sm:pl-1.5 sm:pr-3.5 sm:py-1 transition-all"
                title="Customize Profile & Preferences"
              >
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={user.avatarUrl}
                    alt={user.displayName}
                    className="h-7 w-7 rounded-full object-cover"
                  />
                  <span
                    className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[#0D0F18]"
                    style={{
                      backgroundColor:
                        user.presenceStatus === 'watching'
                          ? '#6D5DFB'
                          : user.presenceStatus === 'online'
                          ? '#10B981'
                          : '#F59E0B',
                    }}
                  />
                </div>
                <span className="hidden md:inline text-xs font-semibold text-white max-w-[100px] truncate">
                  {user.displayName}
                </span>
              </button>
            </>
          ) : (
            <>
              <GlowButton
                variant="secondary"
                onClick={() => setAuthModalOpen(true)}
                className="py-1.5 px-3 sm:px-4 text-xs"
              >
                <User className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign In</span>
              </GlowButton>
              <GlowButton
                variant="primary"
                onClick={handleStartWatchParty}
                className="py-1.5 px-3 sm:px-4 text-xs"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Start</span>
                <span className="hidden sm:inline">Party</span>
              </GlowButton>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
