import React from 'react';
import { WatchRoomClient } from '@/components/room/WatchRoomClient';

export function generateStaticParams() {
  return [{ code: 'VYB-4K1' }, { code: 'NFX-808' }];
}

export default function WatchRoomPage() {
  return <WatchRoomClient />;
}
