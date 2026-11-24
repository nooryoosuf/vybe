import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { VybeProvider } from '@/context/VybeContext';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { AuthModal } from '@/components/modals/AuthModal';
import { ProfileSettingsModal } from '@/components/modals/ProfileSettingsModal';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'VYBE — Watch Together. Feel Closer. | Social Watch Party Platform',
  description:
    'Synchronized Netflix watch parties with real-time animated scene reactions, live chat, and a shared room experience.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon.png', sizes: '512x512', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${jakarta.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-[#07080D] font-sans text-slate-100 antialiased selection:bg-vybe-accent/30 selection:text-white">
        <VybeProvider>
          {children}
          <AuthModal />
          <ProfileSettingsModal />
          <ToastContainer />
        </VybeProvider>
      </body>
    </html>
  );
}
