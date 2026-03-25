import { cache } from "react";
import { getOptionalUser, getRequiredUser } from "@/lib/auth";
import { getBillingEnv } from "@/lib/env";

export class AuthorizationError extends Error {
  constructor(message = "You do not have access to this area.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

function getAdminEmailSet() {
  const env = getBillingEnv();
  const raw = env.ADMIN_EMAILS ?? "";

  return new Set(
    raw
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
}

export const isAdminEmail = cache((email: string | null | undefined) => {
  if (!email) {
    return false;
  }

  return getAdminEmailSet().has(email.trim().toLowerCase());
});

export const isCurrentUserAdmin = cache(async () => {
  const user = await getOptionalUser();
  return isAdminEmail(user?.email);
});

export const getRequiredAdminUser = cache(async () => {
  const user = await getRequiredUser();

  if (!isAdminEmail(user.email)) {
    throw new AuthorizationError();
  }

  return user;
});
