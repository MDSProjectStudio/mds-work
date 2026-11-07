import { DBProvider } from "@/lib/client";
import { QuotePrint } from "./QuotePrint";

export const metadata = { title: "Preventivo · MDS Work" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <DBProvider>
      <QuotePrint id={id} />
    </DBProvider>
  );
}
