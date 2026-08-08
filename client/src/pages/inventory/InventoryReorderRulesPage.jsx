import { useCallback, useEffect, useMemo, useState } from 'react';
import { catalogApi } from '../../api/catalogApi.js';
import { inventoryApi } from '../../api/inventoryApi.js';
import { purchasingApi } from '../../api/purchasingApi.js';
import BusinessTerm from '../../components/BusinessTerm.jsx';
import { EmptyState, LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';
import { inventoryTerms, quantity } from '../../components/inventory/InventoryTerms.js';

const initial = { skuId: '', locationId: '', reorderPoint: '0', safetyStock: '0', targetStock: '', preferredSupplierProductId: '', isActive: true };

export default function InventoryReorderRulesPage({ organizationId }) {
  const [rules, setRules] = useState([]);
  const [options, setOptions] = useState({ skus: [], locations: [], supplierProducts: [] });
  const [form, setForm] = useState(initial);
  const [state, setState] = useState({ loading: true, error: null, submitting: false });
  const supplierOptions = useMemo(() => options.supplierProducts.filter((item) => item.sku_id === form.skuId), [options.supplierProducts, form.skuId]);

  const load = useCallback(async () => {
    try {
      const [ruleResult, skuResult, locationResult, supplierResult] = await Promise.all([
        inventoryApi.listReorderRules(organizationId, { limit: 100 }),
        catalogApi.listSkus(organizationId, { limit: 100, isActive: true }),
        purchasingApi.listLocations(organizationId),
        purchasingApi.listSupplierProducts(organizationId, { limit: 100, isActive: true }),
      ]);
      setRules(ruleResult.data);
      setOptions({ skus: skuResult.data, locations: locationResult.data, supplierProducts: supplierResult.data });
      setState({ loading: false, error: null, submitting: false });
    } catch (error) {
      setState({ loading: false, error, submitting: false });
    }
  }, [organizationId]);
  useEffect(() => { load(); }, [load]);

  async function submit(event) {
    event.preventDefault();
    setState((current) => ({ ...current, submitting: true, error: null }));
    try {
      await inventoryApi.createReorderRule(organizationId, {
        ...form,
        targetStock: form.targetStock || null,
        preferredSupplierProductId: form.preferredSupplierProductId || null,
      });
      setForm(initial);
      await load();
    } catch (error) {
      setState({ loading: false, error, submitting: false });
    }
  }

  async function toggle(rule) {
    try {
      await inventoryApi.patchReorderRule(organizationId, rule.id, { isActive: !rule.is_active });
      await load();
    } catch (error) {
      setState((current) => ({ ...current, error }));
    }
  }

  if (state.loading) return <LoadingState label="Loading reorder rules…" />;
  return (
    <>
      <PageHeader eyebrow="Inventory planning" title="Reorder rules" description="Low stock is calculated per SKU and location from configured thresholds; no purchase order is created automatically." />
      {state.error && <div className="form-error" role="alert">{state.error.message}</div>}
      <form className="inline-create-form reorder-rule-form" onSubmit={submit}>
        <label>SKU<select required value={form.skuId} onChange={(event) => setForm({ ...form, skuId: event.target.value, preferredSupplierProductId: '' })}><option value="">Choose SKU</option>{options.skus.map((sku) => <option key={sku.id} value={sku.id}>{sku.sku_code}</option>)}</select></label>
        <label>Location<select required value={form.locationId} onChange={(event) => setForm({ ...form, locationId: event.target.value })}><option value="">Choose location</option>{options.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
        <label><BusinessTerm term="Reorder point" explanation={inventoryTerms['ROP / Reorder Point']} /><input required type="number" min="0" step="0.0001" value={form.reorderPoint} onChange={(event) => setForm({ ...form, reorderPoint: event.target.value })} /></label>
        <label><BusinessTerm term="Safety stock" explanation={inventoryTerms['Safety Stock']} /><input required type="number" min="0" step="0.0001" value={form.safetyStock} onChange={(event) => setForm({ ...form, safetyStock: event.target.value })} /></label>
        <label>Target stock<input type="number" min="0" step="0.0001" value={form.targetStock} onChange={(event) => setForm({ ...form, targetStock: event.target.value })} /></label>
        <label>Preferred supplier<select value={form.preferredSupplierProductId} onChange={(event) => setForm({ ...form, preferredSupplierProductId: event.target.value })}><option value="">None</option>{supplierOptions.map((item) => <option key={item.id} value={item.id}>{item.supplier_name} · {item.lead_time_days} days</option>)}</select></label>
        <button className="primary-button" disabled={state.submitting}>{state.submitting ? 'Saving…' : 'Add rule'}</button>
      </form>
      {rules.length === 0 ? <EmptyState title="No reorder rules" message="Add a per-location threshold to enable low-stock detection." /> : <div className="catalog-table-wrap"><table className="catalog-table"><thead><tr><th>SKU / Product</th><th>Location</th><th>Available</th><th>Reorder point</th><th>Safety stock</th><th>Target</th><th>Preferred supplier</th><th>Status</th><th /></tr></thead><tbody>{rules.map((rule) => <tr key={rule.id}><td><a className="table-link" href={'#inventory/skus/' + rule.sku_id}>{rule.sku_code}</a><small>{rule.product_name}</small></td><td>{rule.location_name}</td><td>{quantity(rule.available)}</td><td>{quantity(rule.reorder_point)}</td><td>{quantity(rule.safety_stock)}</td><td>{rule.target_stock == null ? '—' : quantity(rule.target_stock)}</td><td>{rule.preferred_supplier_name || '—'}<small>{rule.supplier_lead_time_days == null ? '' : rule.supplier_lead_time_days + ' days lead time'}</small></td><td><span className={'status-pill ' + (rule.is_active ? 'active' : 'archived')}>{rule.is_active ? (Number(rule.available) <= Number(rule.reorder_point) ? 'low stock' : 'active') : 'inactive'}</span></td><td><button className="text-button" onClick={() => toggle(rule)}>{rule.is_active ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table></div>}
    </>
  );
}
