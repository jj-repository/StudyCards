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
import { useTheme } from "@/components/theme-provider";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/library", icon: LibraryIcon, label: "Library" },
  { to: "/generate", icon: Sparkles, label: "Generate" },
  { to: "/study", icon: GraduationCap, label: "Study" },
  { to: "/settings", icon: Settings, label: "Settings" },
  { to: "/help", icon: HelpCircle, label: "Help" },
];

export function Sidebar() {
  const { theme, setTheme } = useTheme();

  return (
    <aside className="flex h-full w-56 flex-col border-r border-border bg-sidebar">
      <div className="flex items-center gap-2 px-4 py-5">
        <BookOpen className="h-6 w-6 text-sidebar-primary" />
        <span className="text-lg font-semibold text-sidebar-foreground">
          StudyCards
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <button
          onClick={() =>
            setTheme(
              theme === "dark"
                ? "light"
                : theme === "light"
                  ? "system"
                  : "dark",
            )
          }
          className="w-full rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          Theme:{" "}
          {theme === "system" ? "System" : theme === "dark" ? "Dark" : "Light"}
        </button>
        <div className="mt-1 text-center text-xs text-muted-foreground/50">
          v0.01
        </div>
      </div>
    </aside>
  );
}
