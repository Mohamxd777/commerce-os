import { useEffect, useState } from 'react';
import { catalogApi } from '../../api/catalogApi.js';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';

export default function ProductsPage({ organizationId }) {
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ search: '', brandId: '', categoryId: '', status: '' });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ loading: true, error: null });

  useEffect(() => {
    Promise.all([
      catalogApi.listBrands(organizationId, { isActive: true }),
      catalogApi.listCategories(organizationId, { isActive: true }),
    ]).then(([brandResult, categoryResult]) => {
      setBrands(brandResult.data);
      setCategories(categoryResult.data);
    }).catch(() => {});
  }, [organizationId]);

  useEffect(() => {
    catalogApi
      .listProducts(organizationId, { ...applied, page, limit: 25 })
      .then((result) => {
        setProducts(result.data);
        setMeta(result.meta);
        setState({ loading: false, error: null });
      })
      .catch((error) => setState({ loading: false, error }));
  }, [organizationId, applied, page]);

  function applyFilters(event) {
    event.preventDefault();
    setPage(1);
    setApplied(filters);
  }

  return (
    <>
      <PageHeader
        title="Products"
        description="Search by product, model, brand, or SKU. All filtering and pagination run on the server."
        action={<a className="primary-button" href="#products/new">Create product</a>}
      />
      <form className="catalog-filters" onSubmit={applyFilters}>
        <input
          aria-label="Search products"
          value={filters.search}
          onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
          placeholder="Search product, model, brand, or SKU"
        />
        <select aria-label="Filter by brand" value={filters.brandId} onChange={(event) => setFilters((current) => ({ ...current, brandId: event.target.value }))}>
          <option value="">All brands</option>
          {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
        </select>
        <select aria-label="Filter by category" value={filters.categoryId} onChange={(event) => setFilters((current) => ({ ...current, categoryId: event.target.value }))}>
          <option value="">All categories</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.path || category.name}</option>)}
        </select>
        <select aria-label="Filter by status" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <button className="secondary-button">Apply</button>
      </form>

      {state.loading ? <LoadingState /> : state.error ? <ErrorState error={state.error} /> : products.length === 0 ? (
        <EmptyState title="No products found" message="Create a product or adjust the server-side filters." />
      ) : (
        <div className="catalog-table-wrap">
          <table className="catalog-table">
            <thead><tr><th>Product</th><th>Brand</th><th>Category</th><th>Variants</th><th>SKUs</th><th>Status</th></tr></thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td><a className="table-link" href={'#products/' + product.id}>{product.name}</a><small>{product.model_number || 'No model number'}</small></td>
                  <td>{product.brand_name || '—'}</td>
                  <td>{product.category_name}</td>
                  <td>{product.variant_count}</td>
                  <td>{product.sku_count}</td>
                  <td><span className={'status-pill ' + product.status}>{product.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination">
            <span>{meta.total} products · Page {meta.page} of {meta.totalPages || 1}</span>
            <div>
              <button className="secondary-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
              <button className="secondary-button" disabled={page >= meta.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
