// What the admin tests' module mocks return (kept apart from adminKit.tsx, which imports AdminLayout and
// so the very modules being mocked). setAdminData(adminFixture()) before mounting.
import type { AdminData } from "../pages/admin/data/useAdminData";

let current: AdminData | null = null;
/** What the mocked useAdminData returns. */
export function setAdminData(d: AdminData) {
  current = d;
}
export function currentAdminData(): AdminData {
  if (!current) throw new Error("setAdminData(adminFixture()) before mounting the admin.");
  return current;
}
/** A signed-in super admin for the mocked AuthContext. */
export function fakeAuth() {
  return { user: { uid: "a1" }, profile: { nickname: "adrian_tc", role: "superadmin", email: "capitan.adrian.tc@gmail.com", playerId: "adrian", createdAt: new Date(0) }, loading: false };
}
