// Each member's Google email lives apart from the vestuario profile every member lists: memberEmails/{uid},
// read only by the member and the captains (firestore.rules), written at the door (functions/src/door.ts).
// Profiles from before the move still carry users/{uid}.email until the migration
// (functions/scripts/migrate-member-emails.mjs) takes it out: that copy is the fallback.

export interface MemberEmail {
  uid: string;
  email: string;
}

/** The people with their email from memberEmails (when there is one), the profile's own copy otherwise. */
export function withEmails<T extends { uid: string; email: string }>(people: T[], emails: readonly MemberEmail[]): T[] {
  if (emails.length === 0) return people;
  const byUid = new Map(emails.filter((e) => e.email).map((e) => [e.uid, e.email]));
  return people.map((p) => {
    const email = byUid.get(p.uid);
    return email && email !== p.email ? { ...p, email } : p;
  });
}
