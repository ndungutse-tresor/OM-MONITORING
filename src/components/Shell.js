"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, Boxes, Settings, LogOut } from "lucide-react";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", Icon: Activity },
  { href: "/inventory", label: "Assets", Icon: Boxes },
  { href: "/settings", label: "Alert settings", Icon: Settings },
];

export default function Shell({ children }) {
  const path = usePathname();
  const router = useRouter();
  if (path === "/login") return children;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <b>Old Mutual</b>
          <span>Infrastructure monitor</span>
        </div>
        <nav className="nav">
          {LINKS.map(({ href, label, Icon }) => (
            <Link key={href} href={href} className={path.startsWith(href) ? "active" : ""}>
              <Icon size={17} /> {label}
            </Link>
          ))}
        </nav>
        <div className="spacer" />
        <div className="nav">
          <button onClick={logout}><LogOut size={17} /> Sign out</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
