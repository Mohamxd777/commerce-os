import { useEffect, useState } from 'react';
import { purchasingApi } from '../../api/purchasingApi.js';
import BusinessTerm from '../../components/BusinessTerm.jsx';
import { ErrorState, LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';
import { purchasingTerms } from '../../components/purchasing/PurchasingTerms.js';

function money(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

export default function PurchasingOverviewPage({ organizationId }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    purchasingApi.getSummary(organizationId).then((result) => setSummary(result.data)).catch(setError);
  }, [organizationId]);

  if (error) return <ErrorState error={error} />;
  if (!summary) return <LoadingState label="Loading purchasing summary…" />;

  const cards = [
    ['Open POs', summary.open_purchase_orders, 'Approved, ordered, or partially received'],
    ['Draft POs', summary.draft_purchase_orders, 'Commercial terms can still be edited'],
    ['Expected deliveries', summary.expected_deliveries, 'Open POs with a delivery date'],
    ['Partially received', summary.partially_received, 'Orders waiting for remaining units'],
    ['PO value', money(summary.total_purchase_order_value), 'Non-cancelled value in the selected period'],
    ['Active suppliers', summary.active_suppliers, 'Available supplier relationships'],
  ];

  return (
    <>
      <PageHeader
        eyebrow="Purchasing"
        title="Purchasing control center"
        description="Monitor suppliers, open commitments, expected deliveries, and receiving progress without changing inventory."
        action={<a className="primary-button" href="#purchase-orders/new">Create purchase order</a>}
      />
      <div className="summary-grid">
        {cards.map(([label, value, description]) => (
          <article className="summary-card" key={label}>
            <span>{label === 'Open POs' ? <BusinessTerm term={label} explanation={purchasingTerms.PO} /> : label}</span>
            <strong>{value}</strong>
            <small>{description}</small>
          </article>
        ))}
      </div>
      <section className="purchasing-callout">
        <div><p className="eyebrow">Workflow boundary</p><h2>Receipts preserve evidence; inventory comes next.</h2></div>
        <p>Task 3 records exactly what was accepted or rejected at each location. Task 4 can reference those immutable receipt items when posting ledger movements.</p>
      </section>
    </>
  );
}
