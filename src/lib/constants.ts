import { ReactionDefinition } from '@/types/vybe';

export const VYBE_REACTIONS: ReactionDefinition[] = [
  { id: 'love', emoji: '❤️', label: 'Love', shortcut: '1', isSpecial: true, glowColor: 'rgba(244, 63, 94, 0.55)' },
  { id: 'laugh', emoji: '😂', label: 'Laugh', shortcut: '2', isSpecial: false, glowColor: 'rgba(250, 204, 21, 0.45)' },
  { id: 'cry', emoji: '😭', label: 'Cry', shortcut: '3', isSpecial: false, glowColor: 'rgba(56, 189, 248, 0.45)' },
  { id: 'shock', emoji: '😱', label: 'Shock', shortcut: '4', isSpecial: false, glowColor: 'rgba(168, 85, 247, 0.45)' },
  { id: 'fire', emoji: '🔥', label: 'Fire', shortcut: '5', isSpecial: true, glowColor: 'rgba(249, 115, 22, 0.6)' },
  { id: 'clap', emoji: '👏', label: 'Clap', shortcut: '6', isSpecial: false, glowColor: 'rgba(52, 211, 153, 0.45)' },
  { id: 'mindblown', emoji: '🤯', label: 'Mind blown', shortcut: '7', isSpecial: true, glowColor: 'rgba(139, 92, 246, 0.65)' },
  { id: 'dead', emoji: '💀', label: 'Dead', shortcut: '8', isSpecial: false, glowColor: 'rgba(226, 232, 240, 0.4)' },
  { id: 'emotional', emoji: '🥹', label: 'Emotional', shortcut: '9', isSpecial: false, glowColor: 'rgba(244, 114, 182, 0.45)' },
];

export interface SupportedNetflixTitle {
  watchId: string;
  title: string;
  year: string;
  maturity: string;
  durationLabel: string;
  genre: string;
  synopsis: string;
  posterUrl: string;
}

export const SUPPORTED_NETFLIX_TITLES: SupportedNetflixTitle[] = [
  {
    watchId: '81446667',
    title: 'Arcane — S1:E1 Welcome to the Playground',
    year: 'Act I • Ep 1',
    maturity: 'TV-14',
    durationLabel: '43m',
    genre: 'Arcane • Act I',
    synopsis: 'Orphaned sisters Vi and Powder bring trouble to Zaun’s underground streets in the wake of a heist in posh Piltover.',
    posterUrl: 'https://i.ytimg.com/vi/3jfI-z__GY0/maxresdefault.jpg',
  },
  {
    watchId: '81446668',
    title: 'Arcane — S1:E2 Some Mysteries Are Better Left Unsolved',
    year: 'Act I • Ep 2',
    maturity: 'TV-14',
    durationLabel: '40m',
    genre: 'Arcane • Act I',
    synopsis: 'Idealistic inventor Jayce attempts to harness magic through science despite his mentor’s warnings. Criminal kingpin Silco tests a powerful substance.',
    posterUrl: 'https://i.ytimg.com/vi/fXmAurh012s/maxresdefault.jpg',
  },
  {
    watchId: '81446669',
    title: 'Arcane — S1:E3 The Base Violence Necessary for Change',
    year: 'Act I • Ep 3',
    maturity: 'TV-14',
    durationLabel: '44m',
    genre: 'Arcane • Act I Finale',
    synopsis: 'An epic showdown between old rivals results in a fateful moment for Zaun. Jayce and Viktor risk it all for their Hextech research.',
    posterUrl: 'https://i.ytimg.com/vi/F5tOuijpFD0/maxresdefault.jpg',
  },
  {
    watchId: '81446670',
    title: 'Arcane — S1:E4 Happy Progress Day!',
    year: 'Act II • Ep 4',
    maturity: 'TV-14',
    durationLabel: '40m',
    genre: 'Arcane • Act II',
    synopsis: 'With Piltover prospering from their technology, Jayce and Viktor weigh their next move. A familiar face re-emerges from Zaun to wreak havoc as Jinx.',
    posterUrl: 'https://i.ytimg.com/vi/Mz4-38d3-AE/maxresdefault.jpg',
  },
  {
    watchId: '81446671',
    title: 'Arcane — S1:E5 Everybody Wants to Be My Enemy',
    year: 'Act II • Ep 5',
    maturity: 'TV-14',
    durationLabel: '40m',
    genre: 'Arcane • Act II',
    synopsis: 'Rogue enforcer Caitlyn tours the undercity to track down Silco. Jayce puts a target on his back trying to root out Piltover corruption.',
    posterUrl: 'https://i.ytimg.com/vi/F5tOuijpFD0/maxresdefault.jpg',
  },
  {
    watchId: '81446672',
    title: 'Arcane — S1:E6 When These Walls Come Tumbling Down',
    year: 'Act II • Ep 6',
    maturity: 'TV-14',
    durationLabel: '42m',
    genre: 'Arcane • Act II Finale',
    synopsis: 'An eager protégé undermines his mentor on the council as a magical tech rapidly evolves. With authorities after her, Jinx must face her past.',
    posterUrl: 'https://i.ytimg.com/vi/fXmAurh012s/maxresdefault.jpg',
  },
  {
    watchId: '81446673',
    title: 'Arcane — S1:E7 The Boy Savior',
    year: 'Act III • Ep 7',
    maturity: 'TV-14',
    durationLabel: '40m',
    genre: 'Arcane • Act III',
    synopsis: 'Caitlyn and Vi meet an ally in Zaun’s streets and head into a frenzied battle with a common foe. Viktor makes a dire decision.',
    posterUrl: 'https://i.ytimg.com/vi/3jfI-z__GY0/maxresdefault.jpg',
  },
  {
    watchId: '81446674',
    title: 'Arcane — S1:E8 Oil and Water',
    year: 'Act III • Ep 8',
    maturity: 'TV-14',
    durationLabel: '40m',
    genre: 'Arcane • Act III',
    synopsis: 'Disowned heir Mel and her visiting mother trade combat tactics. Caitlyn and Vi forge an unlikely alliance. Jinx undergoes a startling change.',
    posterUrl: 'https://i.ytimg.com/vi/Mz4-38d3-AE/maxresdefault.jpg',
  },
  {
    watchId: '81446675',
    title: 'Arcane — S1:E9 The Monster You Created',
    year: 'Act III • Ep 9',
    maturity: 'TV-14',
    durationLabel: '41m',
    genre: 'Arcane • Season Finale',
    synopsis: 'Perilously close to war, the leaders of Piltover and Zaun reach an ultimatum — until a fateful standoff changes both cities forever.',
    posterUrl: 'https://i.ytimg.com/vi/fXmAurh012s/maxresdefault.jpg',
  },
];

export interface CinemaGifItem {
  id: string;
  title: string;
  tags: string[];
  url: string;
}

export const CURATED_CINEMA_GIFS: CinemaGifItem[] = [
  {
    id: 'gif-popcorn',
    title: 'Grabbing Popcorn',
    tags: ['popcorn', 'watch', 'drama', 'cinema', 'ready'],
    url: 'https://media.tenor.com/images/54451401552c0d397577667028191529/tenor.gif',
  },
  {
    id: 'gif-mindblown',
    title: 'Cosmic Mind Blown',
    tags: ['mindblown', 'shock', 'whoa', 'plot twist', 'insane'],
    url: 'https://media.tenor.com/images/998e1b698a5f78998d68b7a5eb7ea0f0/tenor.gif',
  },
  {
    id: 'gif-applause',
    title: 'Standing Ovation',
    tags: ['clap', 'applause', 'cinema', 'masterpiece', 'bravo'],
    url: 'https://media.tenor.com/images/395a0b3a05964191305c025fb4426067/tenor.gif',
  },
  {
    id: 'gif-laugh',
    title: 'Hysterical Laugh',
    tags: ['laugh', 'lol', 'funny', 'comedy', 'dead'],
    url: 'https://media.tenor.com/images/c6021c970b6c61372d95627b6a154d9c/tenor.gif',
  },
  {
    id: 'gif-tears',
    title: 'Emotional Tears',
    tags: ['cry', 'sad', 'tears', 'emotional', 'heartbreak'],
    url: 'https://media.tenor.com/images/09b085a6b0b33a9a9c8529a3d2ee1914/tenor.gif',
  },
  {
    id: 'gif-hype',
    title: 'Pure Fire Hype',
    tags: ['fire', 'hype', 'lets go', 'party', 'excited'],
    url: 'https://media.tenor.com/images/a742721ea2075bc3956a2ff62c9bfeef/tenor.gif',
  },
];

export const AVATAR_PRESETS = [
  'https://api.dicebear.com/9.x/glass/svg?seed=Nova&backgroundColor=6d5dfb',
  'https://api.dicebear.com/9.x/glass/svg?seed=Orion&backgroundColor=4f46e5',
  'https://api.dicebear.com/9.x/glass/svg?seed=Lyra&backgroundColor=7c3aed',
  'https://api.dicebear.com/9.x/glass/svg?seed=Vega&backgroundColor=ec4899',
  'https://api.dicebear.com/9.x/glass/svg?seed=Atlas&backgroundColor=0ea5e9',
  'https://api.dicebear.com/9.x/glass/svg?seed=Sora&backgroundColor=10b981',
  'https://api.dicebear.com/9.x/glass/svg?seed=Kael&backgroundColor=f59e0b',
  'https://api.dicebear.com/9.x/glass/svg?seed=Zuri&backgroundColor=e11d48',
];

export const ACCENT_COLORS = [
  { name: 'Electric Violet', hex: '#6D5DFB' },
  { name: 'Royal Indigo', hex: '#4F46E5' },
  { name: 'Amethyst Glow', hex: '#9333EA' },
  { name: 'Crimson Cinema', hex: '#E50914' },
  { name: 'Cyber Emerald', hex: '#10B981' },
  { name: 'Sky Neon', hex: '#0EA5E9' },
];
