import { participantDoc } from "@/services/firestore";
import type { AuthenticatedRequest } from "@/types/firestore";

type AdminCapableUser = AuthenticatedRequest["user"] & {
  admin?: boolean;
  role?: string;
};

const ADMIN_ROLES = new Set(["admin", "superadmin"]);

export const isAdminUser = (user: AdminCapableUser): boolean =>
  user.admin === true || (typeof user.role === "string" && ADMIN_ROLES.has(user.role));

export const canAccessParticipant = async (
  requester: AuthenticatedRequest["user"],
  participantId: string
): Promise<boolean> => {
  if (isAdminUser(requester) || requester.uid === participantId) {
    return true;
  }

  if (!requester.email) {
    return false;
  }

  const participantSnapshot = await participantDoc(participantId).get();
  const participant = participantSnapshot.data();
  if (!participant?.email) {
    return false;
  }

  return participant.email.toLowerCase() === requester.email.toLowerCase();
};
