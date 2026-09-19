import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const session = await requireUser();

  const [profile] = await db
    .select({
      name: users.name,
      email: users.email,
      phone: users.phone,
      addressLine1: users.addressLine1,
      addressLine2: users.addressLine2,
      city: users.city,
      postcode: users.postcode,
      country: users.country,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return (
    <>
      <PortalHeader title="Profile" />
      <PortalBody>
        <ProfileForm profile={profile} />
      </PortalBody>
    </>
  );
}
