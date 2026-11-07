import { DBProvider } from "@/lib/client";
import { Shell } from "@/components/Shell";
import { VaultProvider } from "@/components/vault/VaultContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <DBProvider>
      <VaultProvider>
        <Shell>{children}</Shell>
      </VaultProvider>
    </DBProvider>
  );
}
