import { Suspense } from "react";
import { QuotesView } from "@/components/views/QuotesView";
import { Loading } from "@/components/ui";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <QuotesView />
    </Suspense>
  );
}
