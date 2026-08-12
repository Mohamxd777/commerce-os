import { useState } from 'react';
import { money } from './ResearchTerms.js';

const optional = (value) => value === '' ? null : value;

export default function MarketplaceWorkspace({ candidate, onAddObservation, onSavePlannedPrice }) {
  const [planned, setPlanned] = useState({
    price: candidate.planned_selling_price || '',
    currency: candidate.planned_price_currency || 'EGP',
  });
  const [form, setForm] = useState({
    marketplace: 'Noon Egypt', listingTitle: '', listingUrl: '', sellerBrand: '',
    sellingPrice: '', originalPrice: '', currency: 'EGP', rating: '', reviewCount: '',
    recentSalesSignal: '', bestsellerRankText: '', fulfillmentBadge: '', notes: '',
    observationDate: new Date().toISOString().slice(0, 10),
  });

  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); }
  function submit(event) {
    event.preventDefault();
    onAddObservation({
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
      evidenceNotes: optional(form.notes),
      observedAt: new Date(form.observationDate + 'T12:00:00Z').toISOString(),
    });
  }

  return (
    <div className="workspace-stack">
      <section className="market-price-summary">
        <article><span>Minimum observed</span><strong>{money(candidate.minimum_observed_price, candidate.market_currency || 'EGP')}</strong></article>
        <article><span>Median observed</span><strong>{money(candidate.median_observed_price, candidate.market_currency || 'EGP')}</strong></article>
        <article><span>Observations</span><strong>{candidate.observation_count || 0}</strong></article>
        <form onSubmit={(event) => { event.preventDefault(); onSavePlannedPrice({ plannedSellingPrice: planned.price || null, plannedPriceCurrency: planned.price ? planned.currency : null }); }}>
          <label>Our planned selling price<div className="input-pair"><input required type="number" min="0.0001" step="0.0001" value={planned.price} onChange={(event) => setPlanned((current) => ({ ...current, price: event.target.value }))} /><input aria-label="Planned price currency" pattern="[A-Za-z]{3}" value={planned.currency} onChange={(event) => setPlanned((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} /></div></label>
          <button className="secondary-button">Save planned price</button>
        </form>
      </section>
      <p className="distinction-note"><strong>Observed marketplace prices are evidence.</strong> Your planned selling price is a separate business decision used by economics.</p>

      <section className="workspace-card">
        <div className="detail-card-heading"><div><p className="eyebrow">Manual research</p><h2>Add Noon observation</h2></div><span>No API integration</span></div>
        <form className="embedded-form" onSubmit={submit}>
          <div className="form-grid two-columns">
            <label>Marketplace<input required value={form.marketplace} onChange={(event) => update('marketplace', event.target.value)} /></label>
            <label>Observation date<input required type="date" value={form.observationDate} onChange={(event) => update('observationDate', event.target.value)} /></label>
            <label className="span-two">Listing title<input maxLength="500" value={form.listingTitle} onChange={(event) => update('listingTitle', event.target.value)} /></label>
            <label className="span-two">Listing URL<input required type="url" value={form.listingUrl} onChange={(event) => update('listingUrl', event.target.value)} /></label>
            <label>Selling price<input type="number" min="0" step="0.0001" value={form.sellingPrice} onChange={(event) => update('sellingPrice', event.target.value)} /></label>
            <label>Original price<input type="number" min="0" step="0.0001" value={form.originalPrice} onChange={(event) => update('originalPrice', event.target.value)} /></label>
            <label>Seller / brand<input maxLength="200" value={form.sellerBrand} onChange={(event) => update('sellerBrand', event.target.value)} /></label>
            <label>Currency<input pattern="[A-Za-z]{3}" value={form.currency} onChange={(event) => update('currency', event.target.value.toUpperCase())} /></label>
          </div>
          <details className="more-details"><summary>More listing signals <span>Optional</span></summary><div className="form-grid two-columns">
            <label>Rating<input type="number" min="0" max="5" step="0.1" value={form.rating} onChange={(event) => update('rating', event.target.value)} /></label>
            <label>Review count<input type="number" min="0" value={form.reviewCount} onChange={(event) => update('reviewCount', event.target.value)} /></label>
            <label>Recent sales signal<input maxLength="240" value={form.recentSalesSignal} onChange={(event) => update('recentSalesSignal', event.target.value)} placeholder="e.g. 50+ sold recently" /></label>
            <label>Best Seller / rank text<input maxLength="240" value={form.bestsellerRankText} onChange={(event) => update('bestsellerRankText', event.target.value)} /></label>
            <label>Fulfillment badge<input maxLength="120" value={form.fulfillmentBadge} onChange={(event) => update('fulfillmentBadge', event.target.value)} /></label>
            <label className="span-two">Notes<textarea rows="3" value={form.notes} onChange={(event) => update('notes', event.target.value)} /></label>
          </div></details>
          <button className="primary-button">Add observation</button>
        </form>
      </section>

      <section className="observation-list" aria-label="Marketplace observations">
        {candidate.snapshots.length === 0 ? <div className="empty-state compact"><h3>No marketplace observations yet</h3><p>Add several Noon listings to understand the real price range.</p></div> : candidate.snapshots.map((item) => <article key={item.id}><div><strong>{item.listing_title || item.marketplace}</strong><small>{item.seller_brand || item.marketplace} · {new Date(item.observed_at).toLocaleDateString()}</small><span>{item.recent_sales_signal || item.bestseller_rank_text || item.fulfillment_badge || 'No sales signal recorded'}</span></div><div><strong>{money(item.selling_price, item.currency || 'EGP')}</strong>{item.original_price && <small>Was {money(item.original_price, item.currency || 'EGP')}</small>}<a href={item.listing_url} target="_blank" rel="noreferrer">Open listing</a></div></article>)}
      </section>
    </div>
  );
}
