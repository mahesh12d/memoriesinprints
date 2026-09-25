import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/guards";
import { logoutAction } from "@/lib/auth/actions";
import { LogoutButton, PortalShell } from "@/components/portal/portal-shell";
import {
  BoxIcon,
  GridIcon,
  HeartIcon,
  MessageIcon,
  ShieldIcon,
  UserIcon,
} from "@/components/portal/icons";
import { Bell } from "@/components/portal/bell";

const NAV = [
  { href: "/account", label: "Dashboard", icon: <GridIcon /> },
  { href: "/account/orders", label: "Orders", icon: <BoxIcon /> },
  {
    href: "/account/order-forms",
    label: "Order forms",
    icon: <MessageIcon />,
  },
  { href: "/account/saved", label: "Saved items", icon: <HeartIcon /> },
  { href: "/account/profile", label: "Profile", icon: <UserIcon /> },
  { href: "/account/security", label: "Security", icon: <ShieldIcon /> },
];

export default async function AccountLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireUser();

  return (
    <PortalShell
      variant="customer"
      nav={NAV}
      user={{ name: session.user.name, roleLabel: "Customer" }}
      logout={<LogoutButton action={logoutAction} />}
      bell={<Bell userId={session.user.id} />}
    >
      {children}
    </PortalShell>
  );
}
