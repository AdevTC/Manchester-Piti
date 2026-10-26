// Publishing a narrated match holds the current sheet, its previous version and the audit
// snapshots in memory. A real 870-observation import exceeded the default 256 MiB. A finished acta
// also rates its notas with the season's earlier actas (publishSheet), which grows every jornada.
// One publication per instance prevents parallel imports from sharing that memory budget;
// the global maxInstances limit still allows separate admins to publish concurrently.
export const PUBLICATION_RESOURCES = {
  memory: "1GiB",
  concurrency: 1,
  timeoutSeconds: 120,
} as const;
