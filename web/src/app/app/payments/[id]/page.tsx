export default async function PaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold mb-2">Payment {id}</h1>
      <p className="text-sm text-neutral-400">Detail view coming in Phase 1.4.</p>
    </div>
  );
}
