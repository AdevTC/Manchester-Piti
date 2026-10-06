// "14° · Nubes y claros · 10 % lluvia" for a match in the next 7 days (lib/weather.ts).
import { useMatchWeather } from "../../lib/weather";
import { Icon } from "./icons";

export function WeatherChip({ match, now }: { match: { venue?: string | null; date?: unknown }; now: number }) {
  const w = useMatchWeather(match, now);
  if (!w) return null;
  const icon = w.sky === "sun" ? "sun" : w.sky === "rain" || w.sky === "storm" ? "rain" : "cloud";
  return (
    <span className="pt-chip" title={w.approx ? "Previsión en Madrid: no se ha encontrado el campo" : `Previsión en ${w.place}`}>
      <Icon name={icon} size={14} /> {w.temp}° · {w.label}
      {w.rain != null && w.rain >= 10 ? ` · ${w.rain} % lluvia` : ""}
      {w.approx ? " (Madrid)" : ""}
    </span>
  );
}
