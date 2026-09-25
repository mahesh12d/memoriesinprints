import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth/guards";
import { adminLogoutAction } from "@/lib/auth/actions";
import { LogoutButton, PortalShell } from "@/components/portal/portal-shell";
import {
  BoxIcon,
  GridIcon,
  ImageIcon,
  MessageIcon,
  PoundIcon,
  TagIcon,
  UsersIcon,
} from "@/components/portal/icons";
import { Bell } from "@/components/portal/bell";

/**
 * This layout wraps every admin page except /admin/login, which sits outside
 * the (portal) route group so it can render without a session.
 */
const NAV = [
  { href: "/admin", label: "Dashboard", icon: <GridIcon /> },
  { href: "/admin/enquiries", label: "Enquiries", icon: <MessageIcon /> },
  { href: "/admin/orders", label: "Orders", icon: <BoxIcon /> },
  { href: "/admin/portfolio", label: "Portfolio", icon: <ImageIcon /> },
  { href: "/admin/products", label: "Products", icon: <TagIcon /> },
  { href: "/admin/users", label: "Users", icon: <UsersIcon /> },
  { href: "/admin/pricing", label: "Pricing", icon: <PoundIcon /> },
];

export default async function AdminPortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireAdmin();

  return (
    <PortalShell
      variant="admin"
      nav={NAV}
      user={{ name: session.user.name, roleLabel: "Administrator" }}
      logout={<LogoutButton action={adminLogoutAction} />}
      bell={<Bell userId={session.user.id} />}
    >
      {children}
    </PortalShell>
  );
}
