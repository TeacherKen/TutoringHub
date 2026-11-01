import { requireSignedIn } from "@/lib/auth";
import { BottomNav } from "@/components/BottomNav";
import { AppMain } from "@/components/AppMain";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const me = await requireSignedIn();
  return (
    <div className="min-h-dvh pb-28 md:pb-12">
      <BottomNav role={me.role === "tutor" ? "tutor" : "viewer"} />
      <AppMain>{children}</AppMain>
    </div>
  );
}
