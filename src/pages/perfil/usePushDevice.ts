// /profile › Avisos (and Capitanía's «Aviso de la puerta»): this device's notices — the state from
// push.ts, the browser's permission, the topics saved here and whether the service worker really holds
// a subscription (saved topics without one are off). Re-checked when the permission changes or the
// member comes back to the tab (from the settings app).
import { useCallback, useEffect, useState } from "react";
import { pushState, savedTopics, setTopics, toggleTopic, type PushState, type Topic } from "../../lib/push";
import { notificationPermission, pushSubscribed, watchPermission, type Permission } from "./device";

export interface PushDevice {
  state: PushState;
  permission: Permission;
  /** The topics this device really gets now. */
  topics: Topic[];
  refresh: () => void;
  /** Turns one topic on/off here (the first one asks the browser for permission: call it from the tap). */
  toggle: (topic: Topic, on: boolean) => Promise<Topic[]>;
}

export function usePushDevice(): PushDevice {
  const [state, setState] = useState<PushState>(pushState);
  const [permission, setPermission] = useState<Permission>(notificationPermission);
  const [saved, setSaved] = useState<Topic[]>(savedTopics);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);

  const refresh = useCallback(() => {
    setState(pushState());
    setPermission(notificationPermission());
    setSaved(savedTopics());
    void pushSubscribed().then(setSubscribed);
  }, []);
  useEffect(() => {
    let alive = true;
    void pushSubscribed().then((s) => alive && setSubscribed(s));
    const stop = watchPermission(refresh);
    return () => {
      alive = false;
      stop();
    };
  }, [refresh]);

  const ready = state === "ready";
  const topics = ready && subscribed !== false ? saved : [];
  const toggle = async (topic: Topic, on: boolean) => {
    try {
      // Topics saved here but no live subscription (the browser dropped it): start again from this one.
      const next = subscribed === false && saved.length ? await setTopics(on ? [topic] : []) : await toggleTopic(topic, on);
      setSaved(next);
      setSubscribed(next.length > 0);
      return next;
    } finally {
      setState(pushState());
      setPermission(notificationPermission());
    }
  };
  return { state, permission, topics, refresh, toggle };
}
