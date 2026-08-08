import { useMemo, useState } from 'react';
import BusinessTerm from '../BusinessTerm.jsx';
import SkuHelper from './SkuHelper.jsx';
import { suggestSku } from './skuSuggestion.js';

function emptySku() {
  return {
    skuCode: '',
    manufacturerPartNumber: '',
    serialTrackingEnabled: false,
    barcodeType: 'manufacturer',
    barcodeValue: '',
  };
}

function emptyVariant() {
  return {
    name: '',
    color: '',
    weightGrams: '',
    lengthMm: '',
    widthMm: '',
    heightMm: '',
    skus: [emptySku()],
  };
}

function optionalNumber(value) {
  return value === '' ? null : Number(value);
}

export default function ProductForm({
  brands,
  categories,
  onCreateBrand,
  onSubmit,
  submitting,
  error,
}) {
  const [availableBrands, setAvailableBrands] = useState(brands);
  const [quickBrandName, setQuickBrandName] = useState('');
  const [form, setForm] = useState({
    brandId: '',
    categoryId: '',
    name: '',
    modelNumber: '',
    description: '',
    warrantyMonths: '',
    defaultWeightGrams: '',
    defaultLengthMm: '',
    defaultWidthMm: '',
    defaultHeightMm: '',
    notes: '',
    status: 'draft',
  });
  const [variants, setVariants] = useState([emptyVariant()]);

  const selectedBrand = availableBrands.find((brand) => brand.id === form.brandId);
  const selectedCategory = categories.find((category) => category.id === form.categoryId);

  const review = useMemo(
    () => ({
      variantCount: variants.length,
      skuCount: variants.reduce((total, variant) => total + variant.skus.length, 0),
    }),
    [variants],
  );

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateVariant(variantIndex, field, value) {
    setVariants((current) =>
      current.map((variant, index) =>
        index === variantIndex ? { ...variant, [field]: value } : variant,
      ),
    );
  }

  function updateSku(variantIndex, skuIndex, field, value) {
    setVariants((current) =>
      current.map((variant, index) =>
        index === variantIndex
          ? {
              ...variant,
              skus: variant.skus.map((sku, currentSkuIndex) =>
                currentSkuIndex === skuIndex ? { ...sku, [field]: value } : sku,
              ),
            }
          : variant,
      ),
    );
  }

  async function createQuickBrand() {
    if (!quickBrandName.trim()) return;
    const brand = await onCreateBrand(quickBrandName.trim());
    setAvailableBrands((current) => [...current, brand].sort((a, b) => a.name.localeCompare(b.name)));
    updateForm('brandId', brand.id);
    setQuickBrandName('');
  }

  function submit(event) {
    event.preventDefault();
    onSubmit({
      brandId: form.brandId || null,
      categoryId: form.categoryId,
      name: form.name,
      modelNumber: form.modelNumber || null,
      description: form.description || null,
      warrantyMonths: optionalNumber(form.warrantyMonths),
      defaultWeightGrams: optionalNumber(form.defaultWeightGrams),
      defaultLengthMm: optionalNumber(form.defaultLengthMm),
      defaultWidthMm: optionalNumber(form.defaultWidthMm),
      defaultHeightMm: optionalNumber(form.defaultHeightMm),
      notes: form.notes || null,
      status: form.status,
      variants: variants.map((variant) => ({
        name: variant.name,
        attributes: variant.color ? { color: variant.color } : {},
        weightGrams: optionalNumber(variant.weightGrams),
        lengthMm: optionalNumber(variant.lengthMm),
        widthMm: optionalNumber(variant.widthMm),
        heightMm: optionalNumber(variant.heightMm),
        isActive: true,
        skus: variant.skus.map((sku) => ({
          skuCode: sku.skuCode,
          manufacturerPartNumber: sku.manufacturerPartNumber || null,
          serialTrackingEnabled: sku.serialTrackingEnabled,
          isActive: true,
          barcodes: sku.barcodeValue
            ? [
                {
                  type: sku.barcodeType,
                  value: sku.barcodeValue,
                  isPrimary: true,
                  isActive: true,
                },
              ]
            : [],
        })),
      })),
    });
  }

  return (
    <form className="catalog-form" onSubmit={submit}>
      <section className="form-section">
        <div className="form-section-heading">
          <span>1</span>
          <div>
            <h2>Product identity</h2>
            <p>Select the business context and enter stable product information.</p>
          </div>
        </div>
        <div className="form-grid">
          <label>
            Brand
            <select value={form.brandId} onChange={(event) => updateForm('brandId', event.target.value)}>
              <option value="">No brand</option>
              {availableBrands.map((brand) => (
                <option key={brand.id} value={brand.id}>{brand.name}</option>
              ))}
            </select>
          </label>
          <label>
            Category *
            <select required value={form.categoryId} onChange={(event) => updateForm('categoryId', event.target.value)}>
              <option value="">Select a category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.path || category.name}</option>
              ))}
            </select>
          </label>
          <label className="span-two">
            Product name *
            <input required maxLength="200" value={form.name} onChange={(event) => updateForm('name', event.target.value)} placeholder="G102 Lightsync" />
          </label>
          <label>
            Model number
            <input value={form.modelNumber} onChange={(event) => updateForm('modelNumber', event.target.value)} placeholder="G102" />
          </label>
          <label>
            Status
            <select value={form.status} onChange={(event) => updateForm('status', event.target.value)}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
            </select>
          </label>
        </div>
        <div className="quick-create">
          <input value={quickBrandName} onChange={(event) => setQuickBrandName(event.target.value)} placeholder="Quick-create a brand" />
          <button type="button" className="secondary-button" onClick={createQuickBrand}>Add brand</button>
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-heading">
          <span>2</span>
          <div>
            <h2>Details and defaults</h2>
            <p>Variant-specific measurements can override these product defaults.</p>
          </div>
        </div>
        <div className="form-grid dimensions-grid">
          <label>
            <BusinessTerm term="Warranty" explanation="مدة التغطية التي يحصل عليها العميل لإصلاح أو استبدال المنتج." />
            <input type="number" min="0" max="600" value={form.warrantyMonths} onChange={(event) => updateForm('warrantyMonths', event.target.value)} placeholder="Months" />
          </label>
          <label>
            Weight
            <input type="number" min="1" value={form.defaultWeightGrams} onChange={(event) => updateForm('defaultWeightGrams', event.target.value)} placeholder="Grams" />
          </label>
          <label>
            Length
            <input type="number" min="1" value={form.defaultLengthMm} onChange={(event) => updateForm('defaultLengthMm', event.target.value)} placeholder="mm" />
          </label>
          <label>
            Width
            <input type="number" min="1" value={form.defaultWidthMm} onChange={(event) => updateForm('defaultWidthMm', event.target.value)} placeholder="mm" />
          </label>
          <label>
            Height
            <input type="number" min="1" value={form.defaultHeightMm} onChange={(event) => updateForm('defaultHeightMm', event.target.value)} placeholder="mm" />
          </label>
          <label className="span-two">
            Description
            <textarea rows="4" value={form.description} onChange={(event) => updateForm('description', event.target.value)} />
          </label>
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-heading">
          <span>3</span>
          <div>
            <h2><BusinessTerm term="Variant" explanation="نسخة مختلفة من المنتج مثل لون أو مقاس أو تخطيط مختلف." /> and SKUs</h2>
            <p>Every sellable version needs a reviewed SKU code.</p>
          </div>
        </div>
        <div className="variant-stack">
          {variants.map((variant, variantIndex) => (
            <article className="variant-editor" key={variantIndex}>
              <div className="variant-title">
                <strong>Variant {variantIndex + 1}</strong>
                {variants.length > 1 && (
                  <button type="button" className="text-button danger" onClick={() => setVariants((current) => current.filter((_, index) => index !== variantIndex))}>Remove</button>
                )}
              </div>
              <div className="form-grid">
                <label>
                  Variant name *
                  <input required value={variant.name} onChange={(event) => updateVariant(variantIndex, 'name', event.target.value)} placeholder="Black" />
                </label>
                <label>
                  Color attribute
                  <input value={variant.color} onChange={(event) => updateVariant(variantIndex, 'color', event.target.value)} placeholder="Black" />
                </label>
              </div>

              {variant.skus.map((sku, skuIndex) => {
                const suggestion = suggestSku({
                  category: selectedCategory?.name,
                  brand: selectedBrand?.name,
                  model: form.modelNumber || form.name,
                  variant: variant.name,
                });
                return (
                  <div className="sku-editor" key={skuIndex}>
                    <div className="sku-editor-heading">
                      <strong>SKU {skuIndex + 1}</strong>
                      {variant.skus.length > 1 && (
                        <button type="button" className="text-button danger" onClick={() => updateVariant(variantIndex, 'skus', variant.skus.filter((_, index) => index !== skuIndex))}>Remove</button>
                      )}
                    </div>
                    <SkuHelper suggestion={suggestion} onUse={(value) => updateSku(variantIndex, skuIndex, 'skuCode', value)} />
                    <div className="form-grid">
                      <label>
                        SKU code *
                        <input required value={sku.skuCode} onChange={(event) => updateSku(variantIndex, skuIndex, 'skuCode', event.target.value.toUpperCase())} placeholder="MOU-LOG-G102-BLK" />
                      </label>
                      <label>
                        Manufacturer part number
                        <input value={sku.manufacturerPartNumber} onChange={(event) => updateSku(variantIndex, skuIndex, 'manufacturerPartNumber', event.target.value)} />
                      </label>
                      <label>
                        <BusinessTerm term="Barcode" explanation="رقم أو كود قابل للمسح يعرّف نسخة المنتج بسرعة." />
                        <select value={sku.barcodeType} onChange={(event) => updateSku(variantIndex, skuIndex, 'barcodeType', event.target.value)}>
                          <option value="manufacturer">Manufacturer</option>
                          <option value="internal">Internal</option>
                          <option value="ean">EAN</option>
                          <option value="upc">UPC</option>
                          <option value="gtin">GTIN</option>
                        </select>
                      </label>
                      <label>
                        Identifier value
                        <input value={sku.barcodeValue} onChange={(event) => updateSku(variantIndex, skuIndex, 'barcodeValue', event.target.value)} />
                      </label>
                      <label className="checkbox-label span-two">
                        <input type="checkbox" checked={sku.serialTrackingEnabled} onChange={(event) => updateSku(variantIndex, skuIndex, 'serialTrackingEnabled', event.target.checked)} />
                        Track every physical unit by serial number in future inventory workflows
                      </label>
                    </div>
                  </div>
                );
              })}
              <button type="button" className="secondary-button" onClick={() => updateVariant(variantIndex, 'skus', [...variant.skus, emptySku()])}>Add another SKU</button>
            </article>
          ))}
        </div>
        <button type="button" className="secondary-button" onClick={() => setVariants((current) => [...current, emptyVariant()])}>Add another variant</button>
      </section>

      <section className="form-section image-placeholder">
        <div className="form-section-heading">
          <span>4</span>
          <div>
            <h2>Product images</h2>
            <p>Image metadata is prepared. File upload and cloud storage will be added through the attachment architecture later.</p>
          </div>
        </div>
      </section>

      <section className="form-section review-section">
        <div className="form-section-heading">
          <span>5</span>
          <div>
            <h2>Review and save</h2>
            <p>The final SKU values remain fully editable until you save.</p>
          </div>
        </div>
        <dl className="review-grid">
          <div><dt>Product</dt><dd>{form.name || 'Not entered'}</dd></div>
          <div><dt>Brand</dt><dd>{selectedBrand?.name || 'No brand'}</dd></div>
          <div><dt>Category</dt><dd>{selectedCategory?.path || selectedCategory?.name || 'Not selected'}</dd></div>
          <div><dt>Structure</dt><dd>{review.variantCount} variants · {review.skuCount} SKUs</dd></div>
        </dl>
        {error && <div className="form-error" role="alert">{error.message}</div>}
        <div className="form-actions">
          <a className="secondary-button" href="#products">Cancel</a>
          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? 'Saving product…' : 'Review complete — save product'}
          </button>
        </div>
      </section>
    </form>
  );
}
