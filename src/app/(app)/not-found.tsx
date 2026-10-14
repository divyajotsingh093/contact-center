import Link from "next/link";
import { Icon, Search01Icon } from "@/components/ccms/icons";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export default function NotFound() {
  return (
    <Empty className="py-24">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon icon={Search01Icon} />
        </EmptyMedia>
        <EmptyTitle>We couldn&apos;t find that page or case</EmptyTitle>
        <EmptyDescription>Check the case number, or search by customer or policy number.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild size="sm" variant="outline">
          <Link href="/inbox">Back to cases</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
