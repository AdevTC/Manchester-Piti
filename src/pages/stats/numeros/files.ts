// «Números»: what «Exportar CSV» and «Exportar la selección en JSON» hand the viewer to save. Pure but download().

const cell = (v: string): string => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
/** A table as CSV for a Spanish spreadsheet: «;» between columns, a BOM so the accents open right. */
export function csvText(head: readonly string[], rows: readonly (readonly string[])[]): string {
  return `﻿${[head, ...rows].map((r) => r.map(cell).join(";")).join("\r\n")}\r\n`;
}
export const jsonText = (data: unknown): string => `${JSON.stringify(data, null, 2)}\n`;

/** Saves a file the page made. */
export function download(name: string, type: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
