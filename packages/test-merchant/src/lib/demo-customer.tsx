// Fixed demo customer persona shown across every test-merchant flow.
// Not editable on the pages — the merchant dashboard should always show the
// same identity, so anyone running the demo sees a consistent "Jerry Rig".
export const DEMO_CUSTOMER = { name: "Jerry Rig", email: "jerryrig@gmail.com" };

/** Read-only "Customer" card rendered on checkout/subscribe pages. */
export function DemoCustomerCard() {
  return (
    <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, padding: "12px 14px", background: "#fafaf9" }}>
      <p style={{ fontSize: 11, color: "#a8a29e", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px", fontWeight: 600 }}>
        Customer
      </p>
      <p style={{ fontSize: 14, color: "#1c1917", margin: 0, fontWeight: 600 }}>{DEMO_CUSTOMER.name}</p>
      <p style={{ fontSize: 13, color: "#78716c", margin: "2px 0 0" }}>{DEMO_CUSTOMER.email}</p>
    </div>
  );
}
