import BusinessTerm from '../BusinessTerm.jsx';

export default function SkuHelper({ suggestion, onUse }) {
  return (
    <div className="sku-helper">
      <div>
        <BusinessTerm
          term="SKU"
          explanation="كود داخلي مميز لكل نسخة قابلة للبيع من المنتج. مثال: MOU-LOG-G102-BLK."
        />
        <p>The suggestion is optional. Review and approve the final code before saving.</p>
      </div>
      {suggestion && (
        <button type="button" className="suggestion-button" onClick={() => onUse(suggestion)}>
          Use suggestion: <strong>{suggestion}</strong>
        </button>
      )}
    </div>
  );
}
