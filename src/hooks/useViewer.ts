// Who is looking at a public page, for the shortcuts only some can follow: a fan sees none, a member
// (inside the vestuario: teamMembers + a profile) the pizarra's, an admin the Sala de control's too, and
// the member linked to a player «Editar tu carta» on his own page. The same rule RootLayout uses to
// let someone into /admin (a member with the admin role), so a shortcut never leads to the door.
import { useAuth, type UserProfile } from "../context/AuthContext";
import { useTeam } from "../context/TeamContext";

export interface Viewer {
  /** Inside the vestuario (a team member with a profile): the pizarra and the profile are his. */
  member: boolean;
  /** A member with the admin role: the Sala de control is his. */
  admin: boolean;
  /** The player file a member is linked to (null for a fan or an unlinked member). */
  playerId: string | null;
}

export function viewerOf(member: boolean, profile: Pick<UserProfile, "role" | "playerId"> | null | undefined): Viewer {
  const inside = member && !!profile;
  return {
    member: inside,
    admin: inside && (profile.role === "admin" || profile.role === "superadmin"),
    playerId: inside ? (profile.playerId ?? null) : null,
  };
}

export function useViewer(): Viewer {
  const { profile } = useAuth();
  const { member } = useTeam();
  return viewerOf(member, profile);
}
