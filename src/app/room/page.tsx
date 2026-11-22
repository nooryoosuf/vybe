import React, { Suspense } from 'react';
import { WatchRoomClient } from '@/components/room/WatchRoomClient';

export default function RoomQueryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#07080D] flex items-center justify-center text-sm text-slate-300">
          Loading Watch Party Room...
        </div>
      }
    >
      <WatchRoomClient />
    </Suspense>
  );
}
