import type { ReactNode } from "react";
import { requireStaff } from "@/lib/auth/guards";
import { logoutAction } from "@/lib/auth/actions";
import { LogoutButton, PortalShell } from "@/components/portal/portal-shell";
import { FileIcon, GridIcon, ListIcon } from "@/components/portal/icons";

const NAV = [
  { href: "/staff", label: "Dashboard", icon: <GridIcon /> },
  { href: "/staff/queue", label: "Work queue", icon: <ListIcon /> },
  { href: "/staff/orders", label: "Orders", icon: <FileIcon /> },
];

const ROLE_LABEL = {
  designer: "Designer",
  proofreader: "Proofreader",
} as const;

export default async function StaffLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireStaff();

  return (
    <PortalShell
      variant="staff"
      nav={NAV}
      user={{
        name: session.user.name,
        roleLabel:
          ROLE_LABEL[session.user.role as keyof typeof ROLE_LABEL] ?? "Staff",
      }}
      logout={<LogoutButton action={logoutAction} />}
    >
      {children}
    </PortalShell>
  );
}
