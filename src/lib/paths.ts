/** `pathname` is `base` or a path inside it: "/admin" and "/admin/partidos", never "/adminx". */
export const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(base + "/");
