// Intl formatters are costly to build (each one loads its locale's data and its time zone): building one per call
// in a loop over the squad or the season's matches showed up as whole milliseconds per page change on a phone. One
// per locale and options, built on first use and kept.
const dates = new Map<string, Intl.DateTimeFormat>();
const numbers = new Map<string, Intl.NumberFormat>();

export function dateFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = dates.get(key);
  if (!f) dates.set(key, (f = new Intl.DateTimeFormat(locale, options)));
  return f;
}

export function numberFormat(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = numbers.get(key);
  if (!f) numbers.set(key, (f = new Intl.NumberFormat(locale, options)));
  return f;
}
