"use client";

import { VaultIntro, VaultPanel } from "../vault/VaultPanel";
import { PageHeader } from "../ui";

export function VaultView() {
  return (
    <>
      <PageHeader kicker="credenziali" title="Cassaforte" subtitle="Account GitHub, Supabase, Vercel, email e domini di ogni progetto, cifrati e sempre a portata di mano." />
      <VaultIntro />
      <VaultPanel />
    </>
  );
}
