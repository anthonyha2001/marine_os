import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { getProduct, listSuppliers } from "@/lib/data/inventory";
import { deleteProduct } from "@/lib/actions/products";
import { DeleteButton } from "@/components/delete-button";
import { PageHeader } from "@/components/ui";
import { ProductForm } from "../product-form";

async function EditProduct({ params }: { params: Promise<{ company: string; productId: string }> }) {
  const { company, productId } = await params;
  const { user, slug } = await requireModule(company, "inventory");
  const [product, suppliers] = await Promise.all([getProduct(productId), listSuppliers()]);
  if (!product) notFound();

  return (
    <>
      <PageHeader
        eyebrow="Stock"
        title={product.name}
        description={`Product #${product.code}`}
        action={
          isAdmin(user) && (
            <DeleteButton
              bordered
              action={deleteProduct.bind(null, slug, product.id)}
              confirmText={`Delete product #${product.code} “${product.name}”? It goes to the recycle bin and can be restored.`}
              title="Delete product"
            />
          )
        }
      />
      <ProductForm
        companySlug={slug}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        product={{
          id: product.id,
          code: product.code,
          name: product.name,
          description: product.description,
          supplierId: product.supplierId,
          priceHT: product.priceHT,
          minQuantity: product.minQuantity,
          imageUrl: product.imageUrl,
          barcodes: product.barcodes,
        }}
      />
    </>
  );
}

export default function EditProductPage({ params }: PageProps<"/c/[company]/inventory/[productId]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <EditProduct params={params} />
    </Suspense>
  );
}
