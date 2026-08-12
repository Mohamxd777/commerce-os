import { useState } from 'react';

const accessoryChecks = [
  'Physical build quality', 'Packaging quality', 'Functionality', 'Compatibility',
  'Performance', 'Defect observed', 'USB-C power delivery', 'HDMI output',
];

export default function SampleEvaluationForm({ supplierOptions = [], onSubmit }) {
  const [form, setForm] = useState({ supplierOptionId: '', referenceCode: '', orderedAt: '', receivedAt: '', sampleCost: '', currency: 'EGP', workflowState: 'requested', notes: '' });
  const [checklist, setChecklist] = useState([]);
  const [customLabel, setCustomLabel] = useState('');

  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); }
  function addCheck(label) {
    if (!label.trim() || checklist.some((item) => item.label === label.trim())) return;
    setChecklist((items) => [...items, { label: label.trim(), passed: null, notes: null }]);
    setCustomLabel('');
  }
  function patchCheck(index, changes) {
    setChecklist((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item));
  }
  function submit(event) {
    event.preventDefault();
    onSubmit({
      supplierOptionId: form.supplierOptionId || null,
      referenceCode: form.referenceCode || null,
      orderedAt: form.orderedAt || null, receivedAt: form.receivedAt || null,
      sampleCost: form.sampleCost || null, currency: form.sampleCost ? form.currency : null,
      workflowState: form.workflowState,
      result: form.workflowState === 'passed' ? 'pass' : form.workflowState === 'failed' ? 'fail' : 'pending',
      checklist, notes: form.notes || null,
    });
  }

  return (
    <form className="embedded-form" onSubmit={submit}>
      <div className="form-grid three-columns">
        <label>Supplier option<select value={form.supplierOptionId} onChange={(event) => update('supplierOptionId', event.target.value)}><option value="">Not linked</option>{supplierOptions.map((option) => <option key={option.id} value={option.id}>{option.supplier_name || option.lead_name}</option>)}</select></label>
        <label>Sample reference<input value={form.referenceCode} onChange={(event) => update('referenceCode', event.target.value)} /></label>
        <label>Sample state<select value={form.workflowState} onChange={(event) => update('workflowState', event.target.value)}><option value="not_requested">Not requested</option><option value="requested">Requested</option><option value="purchased">Purchased</option><option value="testing">Testing</option><option value="passed">Passed</option><option value="failed">Failed</option></select></label>
        <label>Ordered<input type="date" value={form.orderedAt} onChange={(event) => update('orderedAt', event.target.value)} /></label>
        <label>Received<input type="date" value={form.receivedAt} onChange={(event) => update('receivedAt', event.target.value)} /></label>
        <label>Sample cost<input type="number" min="0" step="0.0001" value={form.sampleCost} onChange={(event) => update('sampleCost', event.target.value)} /></label>
      </div>
      <div className="checklist-builder">
        <div className="check-presets">{accessoryChecks.map((label) => <button type="button" className="tag-button" key={label} onClick={() => addCheck(label)}>+ {label}</button>)}</div>
        <div className="inline-field"><input aria-label="Custom checklist item" value={customLabel} onChange={(event) => setCustomLabel(event.target.value)} placeholder="Any product-specific check" /><button type="button" className="secondary-button" onClick={() => addCheck(customLabel)}>Add check</button></div>
        {checklist.map((item, index) => <div className="sample-check" key={item.label}><strong>{item.label}</strong><select aria-label={item.label + ' result'} value={item.passed === null ? '' : String(item.passed)} onChange={(event) => patchCheck(index, { passed: event.target.value === '' ? null : event.target.value === 'true' })}><option value="">Not checked</option><option value="true">Pass</option><option value="false">Fail</option></select><input aria-label={item.label + ' notes'} placeholder="Notes" value={item.notes || ''} onChange={(event) => patchCheck(index, { notes: event.target.value || null })} /></div>)}
      </div>
      <label>Sample notes<textarea rows="3" value={form.notes} onChange={(event) => update('notes', event.target.value)} /></label>
      <button className="primary-button">Save sample evaluation</button>
    </form>
  );
}
