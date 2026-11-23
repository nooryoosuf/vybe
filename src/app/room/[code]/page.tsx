import React from 'react';
import { WatchRoomClient } from '@/components/room/WatchRoomClient';

export function generateStaticParams() {
  return [{ code: 'NFX-808' }];
}

export default function WatchRoomPage() {
  return <WatchRoomClient />;
}
