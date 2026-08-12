import { useCallback, useEffect, useMemo, useState } from 'react';
import { catalogApi } from '../../api/catalogApi.js';
import { purchasingApi } from '../../api/purchasingApi.js';
import { researchApi } from '../../api/researchApi.js';
import BusinessTerm from '../../components/BusinessTerm.jsx';
import { ErrorState, LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';
import MarketplaceWorkspace from '../../components/research/MarketplaceWorkspace.jsx';
import ResearchWorkflow from '../../components/research/ResearchWorkflow.jsx';
import SampleEvaluationForm from '../../components/research/SampleEvaluationForm.jsx';
import SupplierOptionForm from '../../components/research/SupplierOptionForm.jsx';
import UnitEconomicsCalculator from '../../components/research/UnitEconomicsCalculator.jsx';
import { money, percent, researchTerms } from '../../components/research/ResearchTerms.js';

const tabs = ['Overview', 'Suppliers', 'Marketplace', 'Economics', 'Samples', 'Decision'];
const statusLabels = {
  research: 'Researching', shortlisted: 'Shortlisted', sourcing: 'Researching',
  sampling: 'Sample Required', approved: 'Approved', rejected: 'Rejected', launched: 'Launched / Converted',
};
const sampleLabels = {
  not_requested: 'Not requested', requested: 'Requested', purchased: 'Purchased',
  testing: 'Testing', passed: 'Passed', failed: 'Failed',
};
const sampleNext = {
  not_requested: ['requested'], requested: ['purchased', 'not_requested'],
  purchased: ['testing', 'requested'], testing: ['passed', 'failed'],
  passed: ['testing'], failed: ['testing', 'requested'],
};
const quantities = [1, 5, 10, 20, 50, 100];

function optional(value) { return value === '' ? null : value; }
function yesNo(value) { return value === null || value === undefined ? 'Unknown' : value ? 'Yes' : 'No'; }

function OverviewTab({ candidate, categories, onSave }) {
  const [form, setForm] = useState({
    name: candidate.name, categoryId: candidate.category_id || '', brandName: candidate.brand_name || '',
    modelNumber: candidate.model_number || '', gtin: candidate.gtin || '',
    description: candidate.description || '', notes: candidate.notes || '',
  });
  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); }
  return <div className="workspace-stack">
    <section className="workspace-card overview-card">
      <div className="detail-card-heading"><div><p className="eyebrow">Candidate overview</p><h2>Product idea</h2></div><span className={'status-pill ' + candidate.status}>{statusLabels[candidate.status]}</span></div>
      <form className="embedded-form" onSubmit={(event) => { event.preventDefault(); onSave({ name: form.name, categoryId: optional(form.categoryId), brandName: optional(form.brandName), modelNumber: optional(form.modelNumber), gtin: optional(form.gtin), description: optional(form.description), notes: optional(form.notes) }); }}>
        <div className="form-grid two-columns">
          <label>Product name<input required maxLength="200" value={form.name} onChange={(event) => update('name', event.target.value)} /></label>
          <label>Category<select value={form.categoryId} onChange={(event) => update('categoryId', event.target.value)}><option value="">Uncategorized</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label>Brand<input maxLength="160" value={form.brandName} onChange={(event) => update('brandName', event.target.value)} /></label>
          <label>Model number<input maxLength="120" value={form.modelNumber} onChange={(event) => update('modelNumber', event.target.value)} /></label>
          <label>Barcode / GTIN<input inputMode="numeric" pattern="[0-9]{8,14}" value={form.gtin} onChange={(event) => update('gtin', event.target.value)} /></label>
          <label className="span-two">Description<textarea rows="3" value={form.description} onChange={(event) => update('description', event.target.value)} /></label>
          <label className="span-two">Notes<textarea rows="4" value={form.notes} onChange={(event) => update('notes', event.target.value)} /></label>
        </div>
        <button className="primary-button">Save overview</button>
      </form>
      <dl className="metadata-grid"><div><dt>Created</dt><dd>{new Date(candidate.created_at).toLocaleString()}</dd></div><div><dt>Last updated</dt><dd>{new Date(candidate.updated_at).toLocaleString()}</dd></div></dl>
    </section>
    <section className="workspace-card"><div className="detail-card-heading"><div><p className="eyebrow">References</p><h2>Photos and evidence</h2></div><span>{candidate.evidence.length}</span></div>{candidate.evidence.length === 0 ? <div className="empty-state compact"><h3>No photo references yet</h3><p>Quick Capture can save an external photo URL without storing binary data in PostgreSQL.</p></div> : <div className="evidence-grid">{candidate.evidence.map((item) => <a key={item.id} href={item.source_url || '#'} target="_blank" rel="noreferrer"><strong>{item.title}</strong><small>{item.evidence_type}</small></a>)}</div>}</section>
  </div>;
}

function SuppliersTab({ candidate, suppliers, onAdd, onChoose }) {
  const selected = candidate.suppliers.find((option) => option.preferred);
  const cheapest = [...candidate.suppliers].sort((a, b) => Number(a.quoted_unit_cost) - Number(b.quoted_unit_cost))[0];
  const effectivePrice = (option, quantity) => option.same_price_all_quantities ? option.quoted_unit_cost : option['price_qty_' + quantity] ?? option.quoted_unit_cost;
  return <div className="workspace-stack">
    <section className="supplier-highlights">
      <article><span>Selected best supplier</span><strong>{selected?.supplier_name || selected?.lead_name || 'Not selected'}</strong><small>{selected ? money(selected.quoted_unit_cost, selected.currency) : 'Choose based on price and terms'}</small></article>
      <article><span>Cheapest quote</span><strong>{cheapest?.supplier_name || cheapest?.lead_name || 'No quote'}</strong><small>{cheapest ? money(cheapest.quoted_unit_cost, cheapest.currency) : 'Add a supplier quote'}</small></article>
    </section>
    <p className="distinction-note"><strong>Cheapest is not automatically “best.”</strong> Compare warranty, sample availability, replacement terms, lead time, and invoices before choosing.</p>
    <section className="supplier-comparison-grid">{candidate.suppliers.length === 0 ? <div className="empty-state compact"><h3>No supplier quotes yet</h3><p>Add the first quote below. Quantity tiers are optional.</p></div> : candidate.suppliers.map((option) => <article className={option.preferred ? 'preferred' : ''} key={option.id}>
      <div className="supplier-card-heading"><div><strong>{option.supplier_name || option.lead_name}</strong><small>{option.model_variant || 'Model / variant not recorded'}</small></div><div>{option.preferred && <span className="status-pill approved">Best option</span>}{option.id === cheapest?.id && <span className="price-badge">Cheapest</span>}</div></div>
      <strong className="supplier-main-price">{money(option.quoted_unit_cost, option.currency)}</strong>
      <div className="quantity-price-row">{quantities.map((quantity) => <div key={quantity}><span>Qty {quantity}</span><strong>{money(effectivePrice(option, quantity), option.currency)}</strong></div>)}</div>
      <dl className="supplier-terms"><div><dt><BusinessTerm term="MOQ" explanation={researchTerms.MOQ} /></dt><dd>{Number(option.moq)}</dd></div><div><dt>Lead time</dt><dd>{option.lead_time_days} days</dd></div><div><dt>Warranty</dt><dd>{option.warranty_text || 'Not recorded'}</dd></div><div><dt>Defect replacement</dt><dd>{yesNo(option.defective_unit_replacement)}</dd></div><div><dt>Invoice</dt><dd>{yesNo(option.invoice_available)}</dd></div><div><dt>Sample</dt><dd>{yesNo(option.sample_available)}</dd></div></dl>
      {option.notes && <p>{option.notes}</p>}
      {!option.preferred && <button className="secondary-button" onClick={() => onChoose(option.id)}>Choose as best</button>}
    </article>)}</section>
    <section className="workspace-card"><div className="detail-card-heading"><div><p className="eyebrow">Supplier quote</p><h2>Add another option</h2></div></div><SupplierOptionForm suppliers={suppliers} onSubmit={onAdd} /></section>
  </div>;
}

function EconomicsTab({ candidate, onCalculate }) {
  const latest = candidate.economics[0];
  return <div className="workspace-stack">
    {latest && <section className="economics-glance"><article><span>Purchase cost</span><strong>{money(latest.supplier_unit_cost, latest.currency)}</strong></article><article><span>Planned price</span><strong>{money(latest.selling_price, latest.currency)}</strong></article><article><span>Contribution profit</span><strong>{money(latest.net_contribution, latest.currency)}</strong></article><article><span>Net margin</span><strong>{percent(latest.net_margin_percentage)}</strong></article><article><span>ROI</span><strong>{percent(latest.roi_percentage)}</strong></article><article><span>Break-even</span><strong>{money(latest.break_even_price, latest.currency)}</strong></article></section>}
    <UnitEconomicsCalculator supplierOptions={candidate.suppliers} plannedSellingPrice={candidate.planned_selling_price} plannedPriceCurrency={candidate.planned_price_currency} onCalculate={onCalculate} />
    {candidate.economics.length > 1 && <section className="workspace-card"><h2>Calculation history</h2><div className="history-list compact-history">{candidate.economics.map((item) => <article key={item.id}><div><strong>{money(item.selling_price, item.currency)} planned</strong><small>{new Date(item.created_at).toLocaleString()}</small></div><div><strong>{percent(item.net_margin_percentage)}</strong><small>{percent(item.roi_percentage)} ROI</small></div></article>)}</div></section>}
  </div>;
}

function SamplesTab({ candidate, onAdd, onMove }) {
  return <div className="workspace-stack">
    <section className="workspace-card"><div className="detail-card-heading"><div><p className="eyebrow">Flexible for any product</p><h2>Start a sample</h2></div><span>{candidate.samples.length} records</span></div><p className="form-note">Checklist items are optional. Add only what is relevant for this product.</p><SampleEvaluationForm supplierOptions={candidate.suppliers} onSubmit={onAdd} /></section>
    <section className="sample-timeline">{candidate.samples.length === 0 ? <div className="empty-state compact"><h3>Sample not requested</h3><p>Use “Buy/Test Sample” in Decision, or start a sample above.</p></div> : candidate.samples.map((sample) => <article key={sample.id}><div><span className={'status-pill ' + sample.workflow_state}>{sampleLabels[sample.workflow_state]}</span><div><strong>{sample.reference_code || 'Sample'}</strong><small>{sample.sample_cost ? money(sample.sample_cost, sample.currency || 'EGP') : 'Cost not recorded'} · {sample.checklist.length} checks</small></div></div>{sample.notes && <p>{sample.notes}</p>}<div className="sample-actions">{sampleNext[sample.workflow_state].map((state) => <button className={state === 'failed' ? 'danger-button' : 'secondary-button'} key={state} onClick={() => onMove(sample.id, state)}>Mark {sampleLabels[state]}</button>)}</div></article>)}</section>
  </div>;
}

function ConversionForm({ candidate, categories, onConvert }) {
  const [form, setForm] = useState({
    categoryId: candidate.category_id || '', productName: candidate.name,
    modelNumber: candidate.model_number || '', description: candidate.description || '',
    variantName: 'Standard', skuCode: candidate.name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) + '-01',
    manufacturerPartNumber: candidate.model_number || '', serialTrackingEnabled: false,
  });
  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); }
  return <section className="conversion-panel"><div><p className="eyebrow">Explicit conversion</p><h2>Create Draft Product / Variant / SKU</h2><p>This creates no inventory, purchase order, inventory movement, or supplier link.</p></div><form onSubmit={(event) => { event.preventDefault(); onConvert({ ...form, modelNumber: optional(form.modelNumber), description: optional(form.description), manufacturerPartNumber: optional(form.manufacturerPartNumber) }); }}><div className="form-grid two-columns"><label>Product name<input required value={form.productName} onChange={(event) => update('productName', event.target.value)} /></label><label>Category<select required value={form.categoryId} onChange={(event) => update('categoryId', event.target.value)}><option value="">Choose category</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Variant name<input required value={form.variantName} onChange={(event) => update('variantName', event.target.value)} /></label><label>SKU code<input required value={form.skuCode} onChange={(event) => update('skuCode', event.target.value.toUpperCase())} /></label><label>Model number<input value={form.modelNumber} onChange={(event) => update('modelNumber', event.target.value)} /></label><label className="checkbox-field"><input type="checkbox" checked={form.serialTrackingEnabled} onChange={(event) => update('serialTrackingEnabled', event.target.checked)} />Enable serial tracking foundation</label></div><button className="primary-button">Create Draft Product / Variant / SKU</button></form></section>;
}

function DecisionTab({ candidate, categories, onStatus, onRequestSample, onApprove, onConvert }) {
  const latestEconomics = candidate.economics[0];
  const latestEvaluation = candidate.evaluations[0];
  const latestSample = candidate.samples[0];
  const best = candidate.suppliers.find((option) => option.preferred);
  const [decision, setDecision] = useState({ riskLevel: latestEvaluation?.risk_level || 'medium', rationale: latestEvaluation?.rationale || '', launchQuantity: latestEvaluation?.launch_quantity || '1' });
  const canApprove = candidate.status === 'sampling' && latestEconomics && latestSample?.workflow_state === 'passed' && decision.rationale.trim().length >= 3;
  return <div className="workspace-stack">
    <section className="decision-glance"><article><span>Best supplier</span><strong>{best?.supplier_name || best?.lead_name || 'Not selected'}</strong><small>{best ? money(best.quoted_unit_cost, best.currency) : 'Choose in Suppliers'}</small></article><article><span>Planned price</span><strong>{money(candidate.planned_selling_price, candidate.planned_price_currency || 'EGP')}</strong></article><article><span>Net margin</span><strong>{percent(latestEconomics?.net_margin_percentage)}</strong></article><article><span>ROI</span><strong>{percent(latestEconomics?.roi_percentage)}</strong></article><article><span>Risk</span><strong>{latestEvaluation?.risk_level || 'Not assessed'}</strong></article><article><span>Sample result</span><strong>{sampleLabels[latestSample?.workflow_state || 'not_requested']}</strong></article></section>
    {candidate.status !== 'launched' && <section className="workspace-card decision-actions-card"><div><p className="eyebrow">Current status</p><h2>{statusLabels[candidate.status]}</h2><p>Choose the next real-world action. Destructive confirmation is used only for rejection.</p></div><div className="form-grid two-columns"><label>Risk<select value={decision.riskLevel} onChange={(event) => setDecision((current) => ({ ...current, riskLevel: event.target.value }))}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label>Planned launch quantity<input type="number" min="0.0001" step="0.0001" value={decision.launchQuantity} onChange={(event) => setDecision((current) => ({ ...current, launchQuantity: event.target.value }))} /></label><label className="span-two">Decision rationale<textarea rows="3" value={decision.rationale} onChange={(event) => setDecision((current) => ({ ...current, rationale: event.target.value }))} placeholder="Why is this the right decision?" /></label></div><div className="decision-button-row">
      {candidate.status !== 'rejected' && <button className="danger-button" onClick={() => { if (window.confirm('Reject this candidate? Research history will remain available.')) onStatus('rejected'); }}>Reject</button>}
      {candidate.status === 'rejected' && <button className="secondary-button" onClick={() => onStatus('research')}>Reopen Research</button>}
      {candidate.status === 'research' && <button className="secondary-button" onClick={() => onStatus('shortlisted')}>Shortlist</button>}
      {['shortlisted', 'sourcing'].includes(candidate.status) && <button className="secondary-button" onClick={onRequestSample}>Buy/Test Sample</button>}
      {candidate.status === 'sampling' && <button className="primary-button" disabled={!canApprove} onClick={() => onApprove(decision)}>Approve for Launch</button>}
    </div>{candidate.status === 'sampling' && !canApprove && <p className="form-note">To approve: save economics, pass a sample, and add a short rationale.</p>}</section>}
    {candidate.status === 'approved' && <ConversionForm candidate={candidate} categories={categories} onConvert={onConvert} />}
    {candidate.status === 'launched' && <section className="conversion-panel"><div><p className="eyebrow">Converted</p><h2>Draft SKU created</h2><p>The complete research history remains linked and conversion cannot be repeated.</p></div><a className="primary-button" href={'#products/' + candidate.catalog_product_id}>Open draft product</a></section>}
  </div>;
}

export default function ResearchCandidateDetailPage({ organizationId, candidateId }) {
  const [candidate, setCandidate] = useState(null);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [activeTab, setActiveTab] = useState('Overview');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    try {
      const [candidateResult, categoryResult, supplierResult] = await Promise.all([
        researchApi.getCandidate(organizationId, candidateId),
        catalogApi.listCategories(organizationId),
        purchasingApi.listSuppliers(organizationId, { limit: 100, isActive: true }),
      ]);
      setCandidate(candidateResult.data);
      setCategories(categoryResult.data);
      setSuppliers(supplierResult.data);
      setError(null);
    } catch (requestError) { setError(requestError); }
  }, [organizationId, candidateId]);

  useEffect(() => { const timer = setTimeout(load, 0); return () => clearTimeout(timer); }, [load]);

  async function action(operation, success) {
    setError(null); setNotice(null);
    try {
      const result = await operation();
      setNotice(success);
      await load();
      return result;
    } catch (requestError) {
      setError(requestError);
      return null;
    }
  }

  const nextAction = useMemo(() => {
    if (!candidate) return '';
    if (candidate.status === 'launched') return 'Open the linked draft product when you are ready to continue catalog setup.';
    if (candidate.status === 'approved') return 'Review and explicitly create the draft Product, Variant, and SKU.';
    if (candidate.status === 'rejected') return 'The decision is complete. Reopen research only if new evidence changes the case.';
    if (candidate.status === 'sampling') return 'Finish the sample test, then approve or reject the candidate.';
    if (!candidate.suppliers.length) return 'Add the first supplier quote.';
    if (!candidate.snapshots.length) return 'Record several Noon Egypt listings.';
    if (!candidate.planned_selling_price) return 'Choose your planned selling price in Marketplace.';
    if (!candidate.economics.length) return 'Calculate unit economics from the chosen supplier and planned price.';
    return 'Shortlist the candidate or buy a sample from Decision.';
  }, [candidate]);

  if (error && !candidate) return <ErrorState error={error} />;
  if (!candidate) return <LoadingState label="Loading candidate workspace…" />;
  const latestEconomics = candidate.economics[0];

  async function requestSample() {
    return action(async () => {
      if (candidate.status === 'shortlisted') await researchApi.patchCandidate(organizationId, candidateId, { status: 'sourcing' });
      await researchApi.patchCandidate(organizationId, candidateId, { status: 'sampling' });
      if (!candidate.samples.length) await researchApi.createSample(organizationId, candidateId, { workflowState: 'requested', result: 'pending', checklist: [] });
    }, 'Sample workflow started.');
  }

  async function approve(decision) {
    return action(async () => {
      const quantity = Number(decision.launchQuantity);
      await researchApi.createEvaluation(organizationId, candidateId, {
        unitEconomicsId: latestEconomics.id,
        recommendation: 'buy', riskLevel: decision.riskLevel,
        targetSellingPrice: latestEconomics.selling_price,
        targetUnitCost: latestEconomics.supplier_unit_cost,
        targetMarginPercentage: latestEconomics.net_margin_percentage,
        targetRoiPercentage: latestEconomics.roi_percentage,
        launchQuantity: decision.launchQuantity,
        plannedCapital: String(Number(latestEconomics.supplier_unit_cost) * quantity),
        projectedProfit: String(Number(latestEconomics.net_contribution) * quantity),
        rationale: decision.rationale,
      });
      await researchApi.patchCandidate(organizationId, candidateId, { status: 'approved' });
    }, 'Candidate approved. Review the explicit draft SKU conversion below.');
  }

  const tabContent = {
    Overview: <OverviewTab candidate={candidate} categories={categories} onSave={(body) => action(() => researchApi.patchCandidate(organizationId, candidateId, body), 'Overview saved.')} />,
    Suppliers: <SuppliersTab candidate={candidate} suppliers={suppliers} onAdd={(body) => action(() => researchApi.createSupplierOption(organizationId, candidateId, body), 'Supplier quote added.')} onChoose={(id) => action(() => researchApi.patchSupplierOption(organizationId, id, { preferred: true }), 'Best supplier selected.')} />,
    Marketplace: <MarketplaceWorkspace candidate={candidate} onAddObservation={(body) => action(() => researchApi.createSnapshot(organizationId, candidateId, body), 'Marketplace observation added.')} onSavePlannedPrice={(body) => action(() => researchApi.patchCandidate(organizationId, candidateId, body), 'Planned selling price saved.')} />,
    Economics: <EconomicsTab candidate={candidate} onCalculate={async (body) => { const result = await action(() => researchApi.calculateEconomics(organizationId, candidateId, body), 'Economics recalculated from the selected supplier and planned price.'); if (!result) throw new Error('Economics could not be calculated.'); return result.data; }} />,
    Samples: <SamplesTab candidate={candidate} onAdd={(body) => action(() => researchApi.createSample(organizationId, candidateId, body), 'Sample saved.')} onMove={(id, state) => action(() => researchApi.patchSample(organizationId, id, { workflowState: state }), 'Sample state updated.')} />,
    Decision: <DecisionTab candidate={candidate} categories={categories} onStatus={(status) => action(() => researchApi.patchCandidate(organizationId, candidateId, { status }), 'Candidate status updated.')} onRequestSample={requestSample} onApprove={approve} onConvert={(body) => action(() => researchApi.createProduct(organizationId, candidateId, body), 'Draft Product, Variant, and SKU created.')} />,
  };

  return <>
    <PageHeader eyebrow="Product Research" title={candidate.name} description={candidate.description || candidate.notes || 'Complete the next useful step, then come back when you have more evidence.'} action={<a className="secondary-button" href="#research">All candidates</a>} />
    <ResearchWorkflow currentStage={candidate.current_stage} />
    <section className="next-action-banner"><div><span>Next action</span><strong>{nextAction}</strong></div><span className={'status-pill ' + candidate.status}>{statusLabels[candidate.status]}</span></section>
    {notice && <div className="success-banner">{notice}</div>}{error && <div className="form-error" role="alert">{error.message}</div>}
    <nav className="workspace-tabs" aria-label="Candidate sections">{tabs.map((tab) => <button className={activeTab === tab ? 'active' : ''} aria-current={activeTab === tab ? 'page' : undefined} key={tab} onClick={() => setActiveTab(tab)}>{tab}</button>)}</nav>
    {tabContent[activeTab]}
  </>;
}
