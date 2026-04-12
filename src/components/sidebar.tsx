import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Library as LibraryIcon,
  Sparkles,
  GraduationCap,
  Settings,
  HelpCircle,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/library", icon: LibraryIcon, label: "Library" },
  { to: "/generate", icon: Sparkles, label: "Generate" },
  { to: "/study", icon: GraduationCap, label: "Study" },
  { to: "/settings", icon: Settings, label: "Settings" },
  { to: "/help", icon: HelpCircle, label: "Help" },
];

export function Sidebar() {
  return (
    <aside className="flex h-full w-52 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2.5 px-4 py-5">
        <BookOpen className="h-5 w-5 text-primary" />
        <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
          StudyCards
        </span>
      </div>

      <nav className="flex-1 space-y-0.5 px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-4 py-3">
        <span className="text-[11px] text-muted-foreground/40">v0.01</span>
      </div>
    </aside>
  );
}
