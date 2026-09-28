"use client";

import { Gerbang } from "@/components/auth";
import AppShell from "@/components/AppShell";

export default function LayoutAplikasi({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Gerbang>
      <AppShell>{children}</AppShell>
    </Gerbang>
  );
}
