import { requireSignedIn } from "@/lib/auth";
import { BottomNav } from "@/components/BottomNav";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const me = await requireSignedIn();
  return (
    <div className="mx-auto min-h-dvh max-w-2xl pb-28 md:pb-10">
      <BottomNav role={me.role === "tutor" ? "tutor" : "viewer"} />
      <main className="px-4 pt-5 md:pt-24">{children}</main>
    </div>
  );
}
