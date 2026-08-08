import { useEffect, useState } from 'react';
import { catalogApi } from '../../api/catalogApi.js';
import { ErrorState, LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';

export default function ProductEditPage({ organizationId, productId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      catalogApi.getProduct(organizationId, productId),
      catalogApi.listBrands(organizationId),
      catalogApi.listCategories(organizationId),
    ])
      .then(([product, brands, categories]) => {
        setData({
          product: product.data,
          brands: brands.data,
          categories: categories.data,
          form: {
            name: product.data.name,
            modelNumber: product.data.model_number || '',
            brandId: product.data.brand_id || '',
            categoryId: product.data.category_id,
            warrantyMonths: product.data.warranty_months ?? '',
            description: product.data.description || '',
            status: product.data.status,
          },
        });
      })
      .catch(setError);
  }, [organizationId, productId]);

  function update(field, value) {
    setData((current) => ({ ...current, form: { ...current.form, [field]: value } }));
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await catalogApi.patchProduct(organizationId, productId, {
        name: data.form.name,
        modelNumber: data.form.modelNumber || null,
        brandId: data.form.brandId || null,
        categoryId: data.form.categoryId,
        warrantyMonths: data.form.warrantyMonths === '' ? null : Number(data.form.warrantyMonths),
        description: data.form.description || null,
        status: data.form.status,
      });
      window.location.hash = 'products/' + productId;
    } catch (saveError) {
      setError(saveError);
    } finally {
      setSaving(false);
    }
  }

  if (!data && error) return <ErrorState error={error} />;
  if (!data) return <LoadingState label="Loading product editor…" />;

  return (
    <>
      <PageHeader title="Edit product" description="Update stable product information and archival status. SKU codes remain immutable here." />
      <form className="catalog-form" onSubmit={save}>
        <section className="form-section">
          <div className="form-grid">
            <label className="span-two">Product name *<input required value={data.form.name} onChange={(event) => update('name', event.target.value)} /></label>
            <label>Model number<input value={data.form.modelNumber} onChange={(event) => update('modelNumber', event.target.value)} /></label>
            <label>Brand<select value={data.form.brandId} onChange={(event) => update('brandId', event.target.value)}><option value="">No brand</option>{data.brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
            <label>Category *<select required value={data.form.categoryId} onChange={(event) => update('categoryId', event.target.value)}>{data.categories.map((category) => <option key={category.id} value={category.id}>{category.path || category.name}</option>)}</select></label>
            <label>Warranty months<input type="number" min="0" max="600" value={data.form.warrantyMonths} onChange={(event) => update('warrantyMonths', event.target.value)} /></label>
            <label>Status<select value={data.form.status} onChange={(event) => update('status', event.target.value)}><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select></label>
            <label className="span-two">Description<textarea rows="5" value={data.form.description} onChange={(event) => update('description', event.target.value)} /></label>
          </div>
          <div className="immutable-note"><strong>SKU codes are immutable in normal catalog editing.</strong><span>Use the SKU page to change serial tracking, identifiers, or active status.</span></div>
          {error && <div className="form-error" role="alert">{error.message}</div>}
          <div className="form-actions"><a className="secondary-button" href={'#products/' + productId}>Cancel</a><button className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save product'}</button></div>
        </section>
      </form>
    </>
  );
}
