// The porra counter's rule (porraCount.ts), pure: a porra created or deleted changes how many there are; an edit
// doesn't.
export const porraCountChanges = (before: boolean, after: boolean): boolean => before !== after;
