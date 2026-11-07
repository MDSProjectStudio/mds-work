import type { Metadata } from "next";
import { PortalForm } from "./PortalForm";

export const metadata: Metadata = { title: "Portale clienti · MDS Work", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PortalForm token={token} />;
}
