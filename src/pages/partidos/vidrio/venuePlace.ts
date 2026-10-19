// Where a venue is (the Previa's map and its place line). The venue is free text, so it is looked up once
// (Open-Meteo's geocoder, no key, cached for the session; the name without its «CDM» / «Campo de» when the
// full one is not found) for its spot and its district («En casa, en Puente de Vallecas»).
import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";

export interface VenuePlace {
  lat: number;
  lng: number;
  /** The district or the town («Puente de Vallecas», «Leganés»); null when the geocoder has none. */
  district: string | null;
}

interface GeoHit {
  latitude: number;
  longitude: number;
  name: string;
  admin3?: string;
  admin4?: string;
}

const PREFIX = /^(CDM|C\.D\.M\.|Polideportivo|Instalación deportiva|Campo de fútbol|Campo de|Campo|Estadio)\s+/i;

async function geocode(name: string): Promise<GeoHit | null> {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=es&countryCode=ES`);
  if (!r.ok) return null;
  const hit = ((await r.json()) as { results?: GeoHit[] }).results?.[0];
  return hit && typeof hit.latitude === "number" && typeof hit.longitude === "number" ? hit : null;
}

/** Where a venue is (null while unknown). */
export async function locateVenue(venue: string): Promise<VenuePlace | null> {
  const full = venue.trim();
  const short = full.replace(PREFIX, "").trim();
  const hit = (await geocode(full)) ?? (short && short !== full ? await geocode(short) : null);
  if (!hit) return null;
  const district = hit.admin4 && hit.admin4 !== hit.name ? hit.admin4 : hit.admin3 && hit.admin3 !== "Madrid" ? hit.admin3 : hit.admin4 ?? null;
  return { lat: hit.latitude, lng: hit.longitude, district };
}

const subscribeNothing = () => () => {};

/** The venue's spot and district, looked up once in the browser (null on the server and until it answers). */
export function useVenuePlace(venue: string | null): VenuePlace | null {
  const browser = useSyncExternalStore(subscribeNothing, () => true, () => false);
  return (
    useQuery({
      queryKey: ["venue-place", venue ?? ""],
      queryFn: () => locateVenue(venue ?? ""),
      enabled: browser && !!venue?.trim(),
      staleTime: Infinity,
      gcTime: Infinity,
      retry: false,
    }).data ?? null
  );
}

const Z = 15;
const TILE = 256;

/** The tile grid (3 × 3 at zoom 15) around a spot, and where the spot falls in it (px). */
export function tilesAround(lat: number, lng: number): { tiles: { x: number; y: number; left: number; top: number }[]; px: number; py: number } {
  const n = 2 ** Z;
  const fx = ((lng + 180) / 360) * n;
  const r = (lat * Math.PI) / 180;
  const fy = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  const x0 = Math.floor(fx) - 1;
  const y0 = Math.floor(fy) - 1;
  const tiles = [];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) tiles.push({ x: x0 + i, y: y0 + j, left: i * TILE, top: j * TILE });
  return { tiles, px: (fx - x0) * TILE, py: (fy - y0) * TILE };
}
