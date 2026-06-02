"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/common/Navbar";
import { MobileSidebar } from "@/components/common/MobileSidebar";
import { Sidebar } from "@/components/common/Sidebar";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileOpen) {
        setMobileOpen(false);
      }
    };

    if (mobileOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [mobileOpen]);

  const closeMobileMenu = () => {
    setMobileOpen(false);
  };

  return (
    <ProtectedRoute>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Desktop Sidebar */}
        <div className="hidden md:block">
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </div>

        {/* Mobile Drawer */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="p-0 w-60 z-50">
            <MobileSidebar onNavigate={closeMobileMenu} />
          </SheetContent>
        </Sheet>

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col overflow-hidden w-full">
          <Navbar onMenuClick={() => setMobileOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-muted/30">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
