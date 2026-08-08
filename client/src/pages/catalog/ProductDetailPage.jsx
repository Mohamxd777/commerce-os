import { useEffect, useState } from 'react';
import { catalogApi } from '../../api/catalogApi.js';
import BusinessTerm from '../../components/BusinessTerm.jsx';
import { ErrorState, LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';

function measurement(value, unit) {
  return value ? value + ' ' + unit : 'Not set';
}

export default function ProductDetailPage({ organizationId, productId }) {
  const [product, setProduct] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    catalogApi.getProduct(organizationId, productId).then((result) => setProduct(result.data)).catch(setError);
  }, [organizationId, productId]);

  if (error) return <ErrorState error={error} />;
  if (!product) return <LoadingState label="Loading product detail…" />;

  return (
    <>
      <PageHeader
        eyebrow="Product detail"
        title={product.name}
        description={product.model_number ? 'Model ' + product.model_number : 'No model number'}
        action={<a className="secondary-button" href={'#products/' + product.id + '/edit'}>Edit product</a>}
      />
      <div className="detail-grid">
        <section className="detail-card span-two">
          <div className="detail-card-heading"><h2>Product information</h2><span className={'status-pill ' + product.status}>{product.status}</span></div>
          <dl className="definition-grid">
            <div><dt>Brand</dt><dd>{product.brand_name || 'No brand'}</dd></div>
            <div><dt>Category</dt><dd>{product.category_name}</dd></div>
            <div><dt><BusinessTerm term="Warranty" explanation="مدة التغطية المتاحة لإصلاح أو استبدال المنتج." /></dt><dd>{product.warranty_months === null ? 'Not set' : product.warranty_months + ' months'}</dd></div>
            <div><dt>Weight</dt><dd>{measurement(product.default_weight_grams, 'g')}</dd></div>
            <div><dt>Dimensions</dt><dd>{[product.default_length_mm, product.default_width_mm, product.default_height_mm].every(Boolean) ? product.default_length_mm + ' × ' + product.default_width_mm + ' × ' + product.default_height_mm + ' mm' : 'Not set'}</dd></div>
          </dl>
          <p className="detail-description">{product.description || 'No description has been added.'}</p>
        </section>

        <section className="detail-card span-two">
          <div className="detail-card-heading"><h2>Variants and SKUs</h2><span>{product.variants.length} variants</span></div>
          <div className="variant-detail-list">
            {product.variants.map((variant) => (
              <article className="variant-detail" key={variant.id}>
                <div><h3>{variant.name}</h3><span>{Object.entries(variant.attributes).map(([key, value]) => key + ': ' + value).join(' · ') || 'No flexible attributes'}</span></div>
                <div className="sku-detail-list">
                  {variant.skus.map((sku) => (
                    <div className="sku-detail" key={sku.id}>
                      <div><BusinessTerm term={sku.sku_code} explanation="هذا هو كود SKU الداخلي المعتمد لهذه النسخة." /><small>{sku.manufacturer_part_number || 'No manufacturer part number'}</small></div>
                      <span className={sku.serial_tracking_enabled ? 'serial-on' : 'serial-off'}>{sku.serial_tracking_enabled ? 'Serial tracking' : 'No serial tracking'}</span>
                      {sku.barcodes.length > 0 && (
                        <ul>{sku.barcodes.map((barcode) => <li key={barcode.id}><BusinessTerm term={barcode.type.toUpperCase()} explanation="معرّف قابل للمسح أو الاستخدام عبر أنظمة البيع." /> {barcode.value}</li>)}</ul>
                      )}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="detail-card span-two image-placeholder">
          <h2>Product images</h2>
          <p>{product.images.length ? product.images.length + ' image references' : 'No image references yet. Binary uploads are intentionally deferred.'}</p>
        </section>
      </div>
    </>
  );
}
