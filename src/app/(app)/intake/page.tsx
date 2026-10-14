import { PageHeader } from "@/components/ccms/page-header";
import { SAMPLES } from "@/ccms/demo/samples";
import { CentralisedForm } from "./centralised-form";

export default function IntakePage() {
  return (
    <>
      <PageHeader
        title="Centralised form"
        description="Paste or load the source. Kamios extracts the fields; check them against the source, then log the case."
      />
      <CentralisedForm samples={SAMPLES} />
    </>
  );
}
