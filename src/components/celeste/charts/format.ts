/** Number formats shared by the chart views (Spanish, as the rest of Números). */
export const chartNumber = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
/** A count with its word in the right number: «1 pase», «3 pases». */
export const counted = (n: number, one: string, many: string) => `${chartNumber.format(n)} ${n === 1 ? one : many}`;
export const chartPercent = (part: number, total: number) => total ? `${whole.format(part / total * 100)} %` : "-";
/** Game-clock minutes as the app writes them: 23′, 0′ 10″. */
export const chartClock = (second: number) => `${Math.floor(second / 60)}′${second % 60 ? ` ${Math.floor(second % 60)}″` : ""}`;
