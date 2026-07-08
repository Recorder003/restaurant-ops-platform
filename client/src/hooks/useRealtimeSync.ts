import { useEffect, useRef } from 'react';
import { subscribeToRealtimeEvents } from '../api';
import type { User } from '../types';

export function useRealtimeSync(user: User | null, onDataChanged: () => void) {
  const onDataChangedRef = useRef(onDataChanged);

  useEffect(() => {
    onDataChangedRef.current = onDataChanged;
  }, [onDataChanged]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    return subscribeToRealtimeEvents((event) => {
      if (event.action !== 'connected') {
        onDataChangedRef.current();
      }
    });
  }, [user]);
}
