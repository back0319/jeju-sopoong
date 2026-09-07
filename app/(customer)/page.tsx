import { getCatalog } from "@/lib/catalog";
import CustomerFlow from "@/components/customer-flow";
export const dynamic = "force-dynamic";
export default async function Page() {
  return <CustomerFlow initialCatalog={await getCatalog()} />;
}
