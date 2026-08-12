import { useState } from 'react';
import { money } from './ResearchTerms.js';
import ImageGallery from './ImageGallery.jsx';

const optional = (value) => value === '' ? null : value;

const observedFieldMap = {
  listingTitle: 'title', sellingPrice: 'currentPrice', originalPrice: 'originalPrice',
  currency: 'currency', rating: 'rating', reviewCount: 'reviewCount', sellerBrand: 'seller',
  recentSalesSignal: 'recentSales', bestsellerRankText: 'bestsellerRank',
  fulfillmentBadge: 'noonExpress', modelNumber: 'model', gtin: 'gtin', availability: 'availability',
};

function analyzedValue(field, analysis) {
  if (!analysis) return null;
  if (field === 'sellerBrand') return analysis.values.seller || analysis.values.brand;
  const value = analysis.values[observedFieldMap[field]];
  return value === true ? 'Noon Express' : value;
}

function FieldOrigin({ field, form, analysis }) {
  if (!analysis) return null;
  const extracted = analyzedValue(field, analysis);
  const current = form[field];
  const state = current === '' || current === null ? 'Not found' : String(current) === String(extracted ?? '') ? 'Auto' : 'User edited';
  return <small className={'field-origin ' + state.toLowerCase().replace(' ', '-')}>{state}</small>;
}

export default function MarketplaceWorkspace({ organizationId, candidate, onAnalyze, onAddObservation, onSavePlannedPrice }) {
  const [planned, setPlanned] = useState({
    price: candidate.planned_selling_price || '',
    currency: candidate.planned_price_currency || 'EGP',
  });
  const [form, setForm] = useState({
    marketplace: 'Noon Egypt', listingTitle: '', listingUrl: '', sellerBrand: '',
    sellingPrice: '', originalPrice: '', currency: 'EGP', rating: '', reviewCount: '',
    recentSalesSignal: '', bestsellerRankText: '', fulfillmentBadge: '', notes: '',
    observationDate: new Date().toISOString().slice(0, 10),
    availability: '', modelNumber: '', gtin: '',
  });
  const [analyzerUrl, setAnalyzerUrl] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [selectedImages, setSelectedImages] = useState([]);
  const [analyzerError, setAnalyzerError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);

  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); }
  async function analyze(event) {
    event.preventDefault();
    if (!onAnalyze) return;
    setAnalyzing(true); setAnalyzerError('');
    try {
      const result = await onAnalyze(analyzerUrl);
      setAnalysis(result);
      const values = result.values;
      setForm((current) => ({
        ...current, marketplace: 'Noon Egypt', listingUrl: values.canonicalUrl || analyzerUrl,
        listingTitle: values.title || '', sellerBrand: values.seller || values.brand || '',
        sellingPrice: values.currentPrice ?? '', originalPrice: values.originalPrice ?? '',
        currency: values.currency || 'EGP', rating: values.rating ?? '', reviewCount: values.reviewCount ?? '',
        recentSalesSignal: values.recentSales || '', bestsellerRankText: values.bestsellerRank || '',
        fulfillmentBadge: values.noonExpress ? 'Noon Express' : '', availability: values.availability || '',
        modelNumber: values.model || '', gtin: values.gtin || '',
      }));
      setSelectedImages(values.imageUrls || []);
    } catch (requestError) { setAnalyzerError(requestError.message); setAnalysis(null); }
    finally { setAnalyzing(false); }
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    const saved = await onAddObservation({
      marketplace: form.marketplace,
      listingTitle: optional(form.listingTitle),
      listingUrl: form.listingUrl,
      sellerBrand: optional(form.sellerBrand),
      sellingPrice: optional(form.sellingPrice),
      originalPrice: optional(form.originalPrice),
      currency: form.sellingPrice || form.originalPrice ? form.currency : null,
      rating: form.rating || undefined,
      reviewCount: form.reviewCount || undefined,
      recentSalesSignal: optional(form.recentSalesSignal),
      bestsellerRankText: optional(form.bestsellerRankText),
      fulfillmentBadge: optional(form.fulfillmentBadge),
      availability: optional(form.availability), modelNumber: optional(form.modelNumber), gtin: optional(form.gtin),
      canonicalUrl: analysis?.values.canonicalUrl || null,
      mainImageUrl: analysis?.values.mainImageUrl || null,
      keySpecifications: analysis?.values.specifications || {},
      analyzedAt: analysis?.analyzedAt || null,
      extractionMetadata: analysis ? {
        strategy: analysis.strategy,
        fieldOrigins: Object.fromEntries(Object.keys(observedFieldMap).map((field) => [field,
          String(form[field] ?? '') === String(analyzedValue(field, analysis) ?? '') ? 'auto' : 'user',
        ])),
        notFound: analysis.notFound,
      } : {},
      evidenceNotes: optional(form.notes),
      observedAt: new Date(form.observationDate + 'T12:00:00Z').toISOString(),
    }, selectedImages);
    if (saved) { setAnalysis(null); setSelectedImages([]); setAnalyzerUrl(''); }
    setSaving(false);
  }

  return (
    <div className="workspace-stack">
      <section className="market-price-summary">
        <article><span>Minimum observed</span><strong>{money(candidate.minimum_observed_price, candidate.market_currency || 'EGP')}</strong></article>
        <article><span>Median observed</span><strong>{money(candidate.median_observed_price, candidate.market_currency || 'EGP')}</strong></article>
        <article><span>Maximum observed</span><strong>{money(candidate.maximum_observed_price, candidate.market_currency || 'EGP')}</strong></article>
        <article><span>Suggested observed range</span><strong>{candidate.minimum_observed_price && candidate.maximum_observed_price ? money(candidate.minimum_observed_price, candidate.market_currency || 'EGP') + ' – ' + money(candidate.maximum_observed_price, candidate.market_currency || 'EGP') : 'Add more observations'}</strong></article>
        <article><span>Observations</span><strong>{candidate.observation_count || 0}</strong></article>
        <article><span>Average rating</span><strong>{candidate.average_rating || 'Not found'}</strong><small>{candidate.total_review_evidence || 0} reviews of evidence</small></article>
        <form onSubmit={(event) => { event.preventDefault(); onSavePlannedPrice({ plannedSellingPrice: planned.price || null, plannedPriceCurrency: planned.price ? planned.currency : null }); }}>
          <label>Our planned selling price<div className="input-pair"><input required type="number" min="0.0001" step="0.0001" value={planned.price} onChange={(event) => setPlanned((current) => ({ ...current, price: event.target.value }))} /><input aria-label="Planned price currency" pattern="[A-Za-z]{3}" value={planned.currency} onChange={(event) => setPlanned((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} /></div></label>
          <button className="secondary-button">Save planned price</button>
        </form>
      </section>
      <p className="distinction-note"><strong>Observed marketplace prices are evidence.</strong> Your planned selling price is a separate business decision used by economics.</p>

      <section className="workspace-card analyzer-card">
        <div className="detail-card-heading"><div><p className="eyebrow">User-initiated public page analysis</p><h2>Analyze a Noon link</h2></div><span>No login · No official API</span></div>
        <form className="analyzer-row" onSubmit={analyze}><label>Noon product URL<input required type="url" value={analyzerUrl} onChange={(event) => setAnalyzerUrl(event.target.value)} placeholder="https://www.noon.com/egypt-en/..." /></label><button className="primary-button" disabled={analyzing}>{analyzing ? 'Analyzing…' : 'Analyze URL'}</button></form>
        <p className="form-note">Nothing is saved until you review the preview and choose “Add observation.” Analyze additional links one at a time to build the price range.</p>
        {analyzerError && <p className="form-error" role="alert">{analyzerError}</p>}
        {analysis && <div className="analysis-summary"><strong>Preview ready</strong><span>{analysis.notFound.length} fields not found</span>{analysis.warnings.map((warning) => <small key={warning}>{warning}</small>)}</div>}
      </section>

      <section className="workspace-card">
        <div className="detail-card-heading"><div><p className="eyebrow">{analysis ? 'Review before save' : 'Manual research'}</p><h2>{analysis ? 'Edit analyzed observation' : 'Add Noon observation'}</h2></div><span>{analysis ? 'Auto / user / not found' : 'No API integration'}</span></div>
        <form className="embedded-form" onSubmit={submit}>
          <div className="form-grid two-columns">
            <label>Marketplace<input required value={form.marketplace} onChange={(event) => update('marketplace', event.target.value)} /></label>
            <label>Observation date<input required type="date" value={form.observationDate} onChange={(event) => update('observationDate', event.target.value)} /></label>
            <label className="span-two">Listing title<FieldOrigin field="listingTitle" form={form} analysis={analysis} /><input maxLength="500" value={form.listingTitle} onChange={(event) => update('listingTitle', event.target.value)} /></label>
            <label className="span-two">Listing URL<input required type="url" value={form.listingUrl} onChange={(event) => update('listingUrl', event.target.value)} /></label>
            <label>Selling price<FieldOrigin field="sellingPrice" form={form} analysis={analysis} /><input type="number" min="0" step="0.0001" value={form.sellingPrice} onChange={(event) => update('sellingPrice', event.target.value)} /></label>
            <label>Original price<FieldOrigin field="originalPrice" form={form} analysis={analysis} /><input type="number" min="0" step="0.0001" value={form.originalPrice} onChange={(event) => update('originalPrice', event.target.value)} /></label>
            <label>Seller / brand<FieldOrigin field="sellerBrand" form={form} analysis={analysis} /><input maxLength="200" value={form.sellerBrand} onChange={(event) => update('sellerBrand', event.target.value)} /></label>
            <label>Currency<FieldOrigin field="currency" form={form} analysis={analysis} /><input pattern="[A-Za-z]{3}" value={form.currency} onChange={(event) => update('currency', event.target.value.toUpperCase())} /></label>
          </div>
          <details className="more-details"><summary>More listing signals <span>Optional</span></summary><div className="form-grid two-columns">
            <label>Rating<FieldOrigin field="rating" form={form} analysis={analysis} /><input type="number" min="0" max="5" step="0.1" value={form.rating} onChange={(event) => update('rating', event.target.value)} /></label>
            <label>Review count<FieldOrigin field="reviewCount" form={form} analysis={analysis} /><input type="number" min="0" value={form.reviewCount} onChange={(event) => update('reviewCount', event.target.value)} /></label>
            <label>Recent sales signal<FieldOrigin field="recentSalesSignal" form={form} analysis={analysis} /><input maxLength="240" value={form.recentSalesSignal} onChange={(event) => update('recentSalesSignal', event.target.value)} placeholder="e.g. 50+ sold recently" /></label>
            <label>Best Seller / rank text<FieldOrigin field="bestsellerRankText" form={form} analysis={analysis} /><input maxLength="240" value={form.bestsellerRankText} onChange={(event) => update('bestsellerRankText', event.target.value)} /></label>
            <label>Fulfillment badge<FieldOrigin field="fulfillmentBadge" form={form} analysis={analysis} /><input maxLength="120" value={form.fulfillmentBadge} onChange={(event) => update('fulfillmentBadge', event.target.value)} /></label>
            <label>Availability<FieldOrigin field="availability" form={form} analysis={analysis} /><input maxLength="120" value={form.availability} onChange={(event) => update('availability', event.target.value)} /></label>
            <label>Model number<FieldOrigin field="modelNumber" form={form} analysis={analysis} /><input maxLength="160" value={form.modelNumber} onChange={(event) => update('modelNumber', event.target.value)} /></label>
            <label>GTIN / barcode<FieldOrigin field="gtin" form={form} analysis={analysis} /><input inputMode="numeric" pattern="[0-9]{8,14}" value={form.gtin} onChange={(event) => update('gtin', event.target.value)} /></label>
            <label className="span-two">Notes<textarea rows="3" value={form.notes} onChange={(event) => update('notes', event.target.value)} /></label>
          </div></details>
          {analysis?.values.imageUrls?.length > 0 && <fieldset className="image-choice-list"><legend>Import confirmed images after saving</legend>{analysis.values.imageUrls.map((url, index) => <label key={url}><input type="checkbox" checked={selectedImages.includes(url)} onChange={(event) => setSelectedImages((current) => event.target.checked ? [...current, url] : current.filter((item) => item !== url))} /><img src={url} alt={'Noon preview ' + (index + 1)} /><span>Image {index + 1}{url === analysis.values.mainImageUrl ? ' · main' : ''}</span></label>)}</fieldset>}
          <button className="primary-button" disabled={saving}>{saving ? 'Saving observation…' : 'Add observation'}</button>
        </form>
      </section>

      <section className="observation-list" aria-label="Marketplace observations">
        {candidate.snapshots.length === 0 ? <div className="empty-state compact"><h3>No marketplace observations yet</h3><p>Add several Noon listings to understand the real price range.</p></div> : candidate.snapshots.map((item) => <div className="observation-with-images" key={item.id}><article><div><strong>{item.listing_title || item.marketplace}</strong><small>{item.seller_brand || item.marketplace} · {new Date(item.observed_at).toLocaleDateString()}</small><span>{item.recent_sales_signal || item.bestseller_rank_text || item.fulfillment_badge || 'No sales signal recorded'}</span></div><div><strong>{money(item.selling_price, item.currency || 'EGP')}</strong>{item.original_price && <small>Was {money(item.original_price, item.currency || 'EGP')}</small>}<a href={item.listing_url} target="_blank" rel="noreferrer">Open listing</a></div></article><ImageGallery organizationId={organizationId} entityType="marketplace_observation" entityId={item.id} title="Observation images" /></div>)}
      </section>
    </div>
  );
}
