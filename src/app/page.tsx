import { Suspense } from "react";
import { LibraryFromUrl, LibraryView } from "@/components/library-view";

export default function LibraryPage() {
  // Filters live in the URL, which is only known in the browser; prerender the unfiltered Library.
  return (
    <Suspense fallback={<LibraryView />}>
      <LibraryFromUrl />
    </Suspense>
  );
}
