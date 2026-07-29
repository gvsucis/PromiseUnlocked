import { participantDoc } from "@/services/firestore";
import type { AuthenticatedRequest } from "@/types/firestore";

type AdminCapableUser = AuthenticatedRequest["user"] & {
  admin?: boolean;
  role?: string;
};

export const VALID_ROLES = ["user", "admin", "superadmin"] as const;
export type UserRole = (typeof VALID_ROLES)[number];

/** Role assigned by the role-update endpoint when the request omits one. */
export const DEFAULT_ROLE: UserRole = "user";

const ADMIN_ROLES = new Set<string>(["admin", "superadmin"]);

export const isAdminUser = (user: AdminCapableUser): boolean =>
  user.admin === true || (typeof user.role === "string" && ADMIN_ROLES.has(user.role));

export const isSuperAdmin = (user: AdminCapableUser): boolean => user.role === "superadmin";

export const isValidRole = (value: unknown): value is UserRole =>
  typeof value === "string" && (VALID_ROLES as readonly string[]).includes(value);

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
