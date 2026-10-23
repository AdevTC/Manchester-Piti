// «El partido» · Vestuario: the one write the shared vestuario writes lack. «Deshacer el aviso» of la caja takes
// back his «Ya la he pagado» while no captain has answered it (firestore.rules cajaClaims: the member deletes
// his own claim only while it is «pendiente»).
import { viaFirebase } from "../../../lib/fb";

export const unclaimPayment = (claimId: string) => viaFirebase((fb) => fb.deleteDoc(fb.doc(fb.db, "cajaClaims", claimId)));
