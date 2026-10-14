// The connection chip: «Reconectando…» while the phone is offline, «Sin conexión · marcador de hace N
// min» when a live score has gone over a minute without the server confirming it. The same words on the
// live island, the match boards and the admin LED (lib/derived/syncChip). Text and an icon, never colour
// alone. The visible text counts the minutes; screen readers hear one line when it appears or changes
// kind (`announce`), never every minute.
import { syncChipAnnouncement, type SyncChip as Chip } from "../../lib/derived/syncChip";
import "./sync-chip.css";

export function SyncChip({ chip, variant, announce = false }: { chip: Chip | null; variant: "isle" | "board" | "led"; announce?: boolean }) {
  return (
    <>
      {announce && (
        <span className="mp-sync-sr" role="status">
          {syncChipAnnouncement(chip)}
        </span>
      )}
      {chip && (
        <span className={`mp-sync ${variant} ${chip.kind}`} data-sync={chip.kind}>
          <svg className="ic" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {chip.kind === "offline" ? (
              // a turning arc: still under reduced motion
              <path d="M21 12a9 9 0 1 1-3.2-6.9M21 4v5h-5" />
            ) : (
              // the signal, crossed out
              <>
                <path d="M2 8.8a15 15 0 0 1 4.2-2.6M10.7 5.1A15 15 0 0 1 22 8.8M5 12.6a10 10 0 0 1 3.4-2M15.6 10.6A10 10 0 0 1 19 12.6M8.5 16.1a5 5 0 0 1 7 0" />
                <path d="M12 20h.01M3 3l18 18" />
              </>
            )}
          </svg>
          <span>{chip.text}</span>
        </span>
      )}
    </>
  );
}
