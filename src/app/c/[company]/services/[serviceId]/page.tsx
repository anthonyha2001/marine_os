import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { getService } from "@/lib/data/inventory";
import { deleteService } from "@/lib/actions/services";
import { DeleteButton } from "@/components/delete-button";
import { PageHeader } from "@/components/ui";
import { ServiceForm } from "../service-form";

async function EditService({ params }: { params: Promise<{ company: string; serviceId: string }> }) {
  const { company, serviceId } = await params;
  const { user, slug } = await requireModule(company, "services");
  const service = await getService(serviceId);
  if (!service) notFound();

  return (
    <>
      <PageHeader
        eyebrow="Services"
        title={service.name}
        description={`Service #${service.code}`}
        action={
          isAdmin(user) && (
            <DeleteButton
              bordered
              action={deleteService.bind(null, slug, service.id)}
              confirmText={`Delete service #${service.code} “${service.name}”? Offers that already include it keep their lines.`}
              title="Delete service"
            />
          )
        }
      />
      <ServiceForm
        companySlug={slug}
        service={{
          id: service.id,
          code: service.code,
          name: service.name,
          description: service.description,
          unit: service.unit,
          priceHT: service.priceHT,
        }}
      />
    </>
  );
}

export default function EditServicePage({ params }: PageProps<"/c/[company]/services/[serviceId]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <EditService params={params} />
    </Suspense>
  );
}
