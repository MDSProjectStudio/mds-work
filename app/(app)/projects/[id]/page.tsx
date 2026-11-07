import { Suspense } from "react";
import { ProjectView } from "@/components/views/ProjectView";
import { Loading } from "@/components/ui";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<Loading />}>
      <ProjectView id={id} />
    </Suspense>
  );
}
