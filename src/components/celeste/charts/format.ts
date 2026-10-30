/** Number formats shared by the chart views (Spanish, as the rest of Números). */
export const chartNumber = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
export const chartPercent = (part: number, total: number) => total ? `${whole.format(part / total * 100)} %` : "-";
/** Game-clock minutes as the app writes them: 23′, 0′ 10″. */
export const chartClock = (second: number) => `${Math.floor(second / 60)}′${second % 60 ? ` ${Math.floor(second % 60)}″` : ""}`;
