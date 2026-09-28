"use client";

import { ToastProvider } from "@/components/toast";
import { AuthProvider } from "@/components/auth";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>{children}</AuthProvider>
    </ToastProvider>
  );
}
