import React from 'react';
import { WatchRoomClient } from '@/components/room/WatchRoomClient';

export function generateStaticParams() {
  return [{ code: 'NFX-808' }, { code: 'VYB-4K1' }];
}

export default function WatchRoomPage() {
  return <WatchRoomClient />;
}
