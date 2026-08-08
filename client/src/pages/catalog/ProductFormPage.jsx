import { useEffect, useState } from 'react';
import { catalogApi } from '../../api/catalogApi.js';
import { ErrorState, LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';
import ProductForm from '../../components/catalog/ProductForm.jsx';

export default function ProductFormPage({ organizationId }) {
  const [options, setOptions] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      catalogApi.listBrands(organizationId, { isActive: true }),
      catalogApi.listCategories(organizationId, { isActive: true }),
    ])
      .then(([brands, categories]) => setOptions({ brands: brands.data, categories: categories.data }))
      .catch(setLoadError);
  }, [organizationId]);

  async function createBrand(name) {
    const result = await catalogApi.createBrand(organizationId, { name, isActive: true });
    return result.data;
  }

  async function saveProduct(payload) {
    setSubmitting(true);
    setSaveError(null);
    try {
      const result = await catalogApi.createProduct(organizationId, payload);
      window.location.hash = 'products/' + result.data.id;
    } catch (error) {
      setSaveError(error);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) return <ErrorState error={loadError} />;
  if (!options) return <LoadingState label="Preparing product form…" />;

  return (
    <>
      <PageHeader title="Create product" description="Build the product, variants, SKUs, identifiers, and serial-tracking configuration in one transaction." />
      <ProductForm
        brands={options.brands}
        categories={options.categories}
        onCreateBrand={createBrand}
        onSubmit={saveProduct}
        submitting={submitting}
        error={saveError}
      />
    </>
  );
}
