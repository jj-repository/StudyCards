import { Routes, Route } from "react-router-dom";
import { Sidebar } from "@/components/sidebar";
import { Dashboard } from "@/features/dashboard";
import { Library } from "@/features/library";
import { Generate } from "@/features/generate";
import { Study } from "@/features/study";
import { Settings } from "@/features/settings";
import { Help } from "@/features/help";

export default function App() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/library" element={<Library />} />
          <Route path="/generate" element={<Generate />} />
          <Route path="/study" element={<Study />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/help" element={<Help />} />
        </Routes>
      </main>
    </div>
  );
}
