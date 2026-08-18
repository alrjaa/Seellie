/**
 * One Realtime channel per blob key, many local listeners.
 * Handlers.start() must attach postgres_changes and subscribe() once.
 */

export type KeyedChannelHub<TChannel> = {
  subscribe: (key: string, onChange: () => void) => () => void;
  listenerCount: (key: string) => number;
  activeKeyCount: () => number;
};

export function createKeyedChannelHub<TChannel>(handlers: {
  start: (key: string, dispatch: () => void) => TChannel;
  stop: (key: string, channel: TChannel) => void;
}): KeyedChannelHub<TChannel> {
  type Entry = { channel: TChannel; listeners: Set<() => void> };
  const entries = new Map<string, Entry>();

  return {
    subscribe(key, onChange) {
      let entry = entries.get(key);
      if (!entry) {
        const listeners = new Set<() => void>();
        const dispatch = () => {
          for (const fn of Array.from(listeners)) fn();
        };
        const channel = handlers.start(key, dispatch);
        entry = { channel, listeners };
        entries.set(key, entry);
      }
      entry.listeners.add(onChange);
      return () => {
        const current = entries.get(key);
        if (!current) return;
        current.listeners.delete(onChange);
        if (current.listeners.size === 0) {
          entries.delete(key);
          handlers.stop(key, current.channel);
        }
      };
    },
    listenerCount(key) {
      return entries.get(key)?.listeners.size ?? 0;
    },
    activeKeyCount() {
      return entries.size;
    },
  };
}
