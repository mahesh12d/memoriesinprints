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
import { NotificationBell } from "@/components/portal/notification-bell";
import { loadNotifications } from "@/lib/notifications/queries";
import { markNotificationsReadAction } from "@/lib/notifications/actions";

const NAV = [
  { href: "/account", label: "Dashboard", icon: <GridIcon /> },
  { href: "/account/orders", label: "Orders", icon: <BoxIcon /> },
  { href: "/account/quotes", label: "Quotes", icon: <MessageIcon /> },
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
  const { items, unreadCount } = await loadNotifications(session.user.id);

  return (
    <PortalShell
      variant="customer"
      nav={NAV}
      user={{ name: session.user.name, roleLabel: "Customer" }}
      logout={<LogoutButton action={logoutAction} />}
      bell={
        <NotificationBell
          items={items}
          unreadCount={unreadCount}
          markRead={markNotificationsReadAction}
        />
      }
    >
      {children}
    </PortalShell>
  );
}
