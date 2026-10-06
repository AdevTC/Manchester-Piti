// Reads the public data bundle (functions/src/bundle.ts) on the server, without a Firestore client:
// the format is a sequence of `<byte length><JSON element>`; documents carry their values in
// Firestore's typed JSON. Decoded to what the SDK's snapshot.data() returns (Timestamp included),
// so the app's own mappers turn them into exactly the cache the browser builds.
import { Timestamp } from "firebase/firestore";

type Json = Record<string, unknown>;
export interface BundleDoc {
  id: string;
  path: string;
  data: Record<string, unknown>;
}
export interface PublicBundle {
  /** Documents of each named query (matches, players, seasons, mvpResults). */
  queries: Record<string, BundleDoc[]>;
  /** Every document in the bundle by its path (e.g. "clubContent/main"). */
  docs: Map<string, BundleDoc>;
}

const seconds = (v: unknown) => Number(typeof v === "object" && v ? (v as Json).seconds : 0);

function timestamp(v: unknown): Timestamp {
  if (typeof v === "string") return Timestamp.fromDate(new Date(v));
  const o = v as Json;
  return new Timestamp(seconds(o), Number(o.nanos ?? 0));
}

export function decodeValue(v: Json): unknown {
  if ("nullValue" in v) return null;
  if ("booleanValue" in v) return Boolean(v.booleanValue);
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("timestampValue" in v) return timestamp(v.timestampValue);
  if ("stringValue" in v) return v.stringValue;
  if ("arrayValue" in v) return (((v.arrayValue as Json).values as Json[] | undefined) ?? []).map(decodeValue);
  if ("mapValue" in v) return decodeFields((v.mapValue as Json).fields as Record<string, Json> | undefined);
  if ("geoPointValue" in v) return v.geoPointValue;
  if ("referenceValue" in v) return v.referenceValue;
  if ("bytesValue" in v) return v.bytesValue;
  return undefined;
}

function decodeFields(fields: Record<string, Json> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields ?? {})) out[k] = decodeValue(v);
  return out;
}

export function parseBundle(bytes: Uint8Array): PublicBundle {
  const text = new TextDecoder();
  const queries: Record<string, BundleDoc[]> = {};
  const docs = new Map<string, BundleDoc>();
  let pendingQueries: string[] = [];
  let i = 0;
  while (i < bytes.length) {
    let j = i;
    while (j < bytes.length && bytes[j] >= 48 && bytes[j] <= 57) j++;
    const length = Number(text.decode(bytes.subarray(i, j)));
    if (!length) break;
    const element = JSON.parse(text.decode(bytes.subarray(j, j + length))) as Json;
    i = j + length;
    if (element.documentMetadata) {
      pendingQueries = ((element.documentMetadata as Json).queries as string[] | undefined) ?? [];
    } else if (element.document) {
      const d = element.document as Json;
      const path = String(d.name).split("/documents/")[1] ?? "";
      const doc: BundleDoc = { id: path.split("/").pop() ?? "", path, data: decodeFields(d.fields as Record<string, Json>) };
      docs.set(path, doc);
      for (const q of pendingQueries) (queries[q] ??= []).push(doc);
      pendingQueries = [];
    }
  }
  return { queries, docs };
}

const millis = (v: unknown) => (v instanceof Timestamp ? v.toMillis() : 0);

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The order each query has in the browser: Firestore sorts by the orderBy field, then by document
 * id in the direction of the last orderBy (strings compared by code unit, not by locale).
 */
export function inQueryOrder(bundle: PublicBundle) {
  const byId = (a: BundleDoc, b: BundleDoc) => compare(a.id, b.id);
  const matches = [...(bundle.queries.matches ?? [])].sort((a, b) => millis(b.data.date) - millis(a.data.date) || byId(b, a));
  const players = [...(bundle.queries.players ?? [])].sort(byId);
  const seasons = [...(bundle.queries.seasons ?? [])].sort(
    (a, b) => compare(String(a.data.name ?? ""), String(b.data.name ?? "")) || byId(a, b),
  );
  return { matches, players, seasons, content: bundle.docs.get("clubContent/main") };
}
