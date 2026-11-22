import { ReactionDefinition, SiteMovieItem } from '@/types/vybe';

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

export interface CuratedYouTubeMedia {
  videoId: string;
  title: string;
  directorOrChannel: string;
  durationLabel: string;
  genre: string;
  thumbnailUrl: string;
  description: string;
}

export const CURATED_YOUTUBE_VIDEOS: CuratedYouTubeMedia[] = [
  {
    videoId: 'aqz-KE-bpKQ',
    title: 'Big Buck Bunny — 4K 60fps Open Film',
    directorOrChannel: 'Blender Foundation',
    durationLabel: '10:35',
    genre: 'Animation • Comedy',
    thumbnailUrl: 'https://i.ytimg.com/vi/aqz-KE-bpKQ/maxresdefault.jpg',
    description: 'High-frame-rate 4K remaster of the classic Blender open-source animated short.',
  },
  {
    videoId: 'eRsGyueVLvQ',
    title: 'Sintel — Fantasy Animated Short Film',
    directorOrChannel: 'Blender Studio',
    durationLabel: '14:48',
    genre: 'Fantasy • Adventure',
    thumbnailUrl: 'https://i.ytimg.com/vi/eRsGyueVLvQ/maxresdefault.jpg',
    description: 'A lone warrior searches across treacherous lands for her companion dragon Scales.',
  },
  {
    videoId: 'R6MlUcmOul8',
    title: 'Tears of Steel — Sci-Fi Live Action VFX Film',
    directorOrChannel: 'Blender Institute',
    durationLabel: '12:14',
    genre: 'Sci-Fi • Cyberpunk',
    thumbnailUrl: 'https://i.ytimg.com/vi/R6MlUcmOul8/maxresdefault.jpg',
    description: 'In a future Amsterdam, a crew of scientists and soldiers attempt to rewrite a catastrophic memory.',
  },
  {
    videoId: 'mN0zPOpADL4',
    title: 'Agent 327: Operation Barbershop',
    directorOrChannel: 'Blender Animation Studio',
    durationLabel: '03:51',
    genre: 'Action • Spy Thriller',
    thumbnailUrl: 'https://i.ytimg.com/vi/mN0zPOpADL4/maxresdefault.jpg',
    description: 'Secret agent Hendrik IJzerbroot uncovers a covert underground villain headquarters in Amsterdam.',
  },
  {
    videoId: 'WhWc3b3KhnY',
    title: 'Spring — Poetic Fantasy Cinema Short',
    directorOrChannel: 'Blender Studio',
    durationLabel: '07:44',
    genre: 'Fantasy • Drama',
    thumbnailUrl: 'https://i.ytimg.com/vi/WhWc3b3KhnY/maxresdefault.jpg',
    description: 'A young shepherdess and her dog confront ancient spirits to usher in the cycle of spring.',
  },
  {
    videoId: '_cMxraX_5RE',
    title: 'Charge — Cyberpunk Open Movie',
    directorOrChannel: 'Blender Studio',
    durationLabel: '03:58',
    genre: 'Cyberpunk • Action',
    thumbnailUrl: 'https://i.ytimg.com/vi/_cMxraX_5RE/maxresdefault.jpg',
    description: 'In a dark arctic wasteland, an elderly outlaw breaks into a high-voltage battery facility.',
  },
  {
    videoId: 'Y-rmzh0PI3c',
    title: 'Cosmos Laundromat — First Cycle',
    directorOrChannel: 'Blender Foundation',
    durationLabel: '12:10',
    genre: 'Sci-Fi • Comedy Drama',
    thumbnailUrl: 'https://i.ytimg.com/vi/Y-rmzh0PI3c/maxresdefault.jpg',
    description: 'On a desolate island, a suicidal sheep named Franck meets a quirky salesman who offers him the gift of many lifetimes.',
  },
  {
    videoId: 'L1bbN08o6Y4',
    title: 'Wing It! — Sci-Fi Space Comedy',
    directorOrChannel: 'Blender Studio',
    durationLabel: '03:42',
    genre: 'Animation • Space',
    thumbnailUrl: 'https://i.ytimg.com/vi/L1bbN08o6Y4/maxresdefault.jpg',
    description: 'An astronaut mechanic and a stray dog accidentally launch an experimental rocket.',
  },
];

export const INITIAL_SITE_MOVIES: SiteMovieItem[] = [
  {
    id: 'mov-tears-of-steel',
    title: 'Tears of Steel',
    genre: 'Sci-Fi • Cyberpunk',
    durationLabel: '12m • 4K',
    year: '2024 Remaster',
    platform: 'youtube',
    videoId: 'R6MlUcmOul8',
    thumbnailUrl: 'https://i.ytimg.com/vi/R6MlUcmOul8/maxresdefault.jpg',
    description: 'In a future Amsterdam, a crew of scientists and soldiers attempt to rewrite a catastrophic robotic memory.',
  },
  {
    id: 'mov-sintel',
    title: 'Sintel',
    genre: 'Fantasy • Adventure',
    durationLabel: '15m • 4K',
    year: '4K Edition',
    platform: 'youtube',
    videoId: 'eRsGyueVLvQ',
    thumbnailUrl: 'https://i.ytimg.com/vi/eRsGyueVLvQ/maxresdefault.jpg',
    description: 'A lone warrior searches across treacherous mountain lands for her companion dragon Scales.',
  },
  {
    id: 'mov-cosmos',
    title: 'Cosmos Laundromat',
    genre: 'Sci-Fi • Surreal',
    durationLabel: '12m • HD',
    year: 'Award Winner',
    platform: 'youtube',
    videoId: 'Y-rmzh0PI3c',
    thumbnailUrl: 'https://i.ytimg.com/vi/Y-rmzh0PI3c/maxresdefault.jpg',
    description: 'On a windswept island, a mysterious stranger offers a sheep the chance to travel across parallel worlds.',
  },
  {
    id: 'mov-charge',
    title: 'Charge',
    genre: 'Cyberpunk • Action',
    durationLabel: '4m • 4K',
    year: '2023',
    platform: 'youtube',
    videoId: '_cMxraX_5RE',
    thumbnailUrl: 'https://i.ytimg.com/vi/_cMxraX_5RE/maxresdefault.jpg',
    description: 'In a dark arctic wasteland, a cybernetic outlaw breaks into a high-voltage battery facility.',
  },
  {
    id: 'mov-agent-327',
    title: 'Agent 327: Operation Barbershop',
    genre: 'Spy Action • Comedy',
    durationLabel: '4m • 4K',
    year: '4K HDR',
    platform: 'youtube',
    videoId: 'mN0zPOpADL4',
    thumbnailUrl: 'https://i.ytimg.com/vi/mN0zPOpADL4/maxresdefault.jpg',
    description: 'Secret agent Hendrik uncovers a covert underground villain headquarters hidden beneath a barbershop.',
  },
  {
    id: 'mov-spring',
    title: 'Spring',
    genre: 'Fantasy • Drama',
    durationLabel: '8m • 4K',
    year: '4K Edition',
    platform: 'youtube',
    videoId: 'WhWc3b3KhnY',
    thumbnailUrl: 'https://i.ytimg.com/vi/WhWc3b3KhnY/maxresdefault.jpg',
    description: 'A young shepherdess and her loyal dog confront ancient forest spirits to bring the cycle of spring.',
  },
  {
    id: 'mov-stranger-things',
    title: 'Stranger Things',
    genre: 'Sci-Fi • Mystery',
    durationLabel: '49m • Netflix',
    year: 'Season 1',
    platform: 'netflix',
    videoId: '80057281',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=900&q=80',
    description: 'Stream via Netflix Tab Cast or Extension: A young boy vanishes near a top-secret government laboratory.',
  },
  {
    id: 'mov-dark',
    title: 'Dark',
    genre: 'Time Travel • Thriller',
    durationLabel: '52m • Netflix',
    year: 'Season 1',
    platform: 'netflix',
    videoId: '80100172',
    thumbnailUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=900&q=80',
    description: 'Stream via Netflix Tab Cast or Extension: A missing child sets four families on a frantic hunt for answers across time.',
  },
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
    watchId: '80057281',
    title: 'Stranger Things — S1:E1 Chapter One',
    year: '2016',
    maturity: 'TV-14',
    durationLabel: '49m',
    genre: 'Sci-Fi Horror • Mystery',
    synopsis: 'On his way home from a friend’s house, young Will sees something terrifying. Nearby, a sinister secret lurks in the depths of a government lab.',
    posterUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=900&q=80',
  },
  {
    watchId: '80100172',
    title: 'Dark — S1:E1 Secrets',
    year: '2017',
    maturity: 'TV-MA',
    durationLabel: '52m',
    genre: 'Time Travel • Thriller',
    synopsis: 'In 2019, a local boy’s disappearance stokes fear in the residents of Winden, a small German town with a strange and tragic history.',
    posterUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=900&q=80',
  },
  {
    watchId: '81040344',
    title: 'Squid Game — S1:E1 Red Light, Green Light',
    year: '2021',
    maturity: 'TV-MA',
    durationLabel: '60m',
    genre: 'Survival • Thriller',
    synopsis: 'Hoping to win easy money, a broke and desperate Gi-hun agrees to take part in an enigmatic game.',
    posterUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=900&q=80',
  },
  {
    watchId: '80200575',
    title: 'Alice in Borderland — Episode 1',
    year: '2020',
    maturity: 'TV-MA',
    durationLabel: '49m',
    genre: 'Sci-Fi • Action',
    synopsis: 'Arisu and his friends run into a public restroom to hide from the police, but when they reemerge, the streets of Tokyo are suddenly completely empty.',
    posterUrl: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=900&q=80',
  },
  {
    watchId: '81231974',
    title: 'Wednesday — S1:E1 Wednesday’s Child Is Full of Woe',
    year: '2022',
    maturity: 'TV-14',
    durationLabel: '59m',
    genre: 'Supernatural • Mystery',
    synopsis: 'When a deliciously wicked prank gets Wednesday expelled, her parents ship her off to Nevermore Academy.',
    posterUrl: 'https://images.unsplash.com/photo-1514539079130-25950c84af65?auto=format&fit=crop&w=900&q=80',
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
