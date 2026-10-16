// Invitados en el acta: the contract lives in functions/src/guests.ts so the callables and the web
// validate and name guests the same way.
export {
  GUEST_ID_RE,
  GUEST_NAME_MAX,
  GUEST_PREFIX,
  MAX_GUESTS,
  guestLabel,
  guestOf,
  guestRef,
  guestsProblem,
  isGuestId,
  isUnknownGuest,
  memberIds,
  withGuestNames,
  withoutGuests,
  type MatchGuest,
} from "../../../functions/src/guests";
