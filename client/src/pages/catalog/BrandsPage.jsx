import { useCallback, useEffect, useState } from 'react';
import { catalogApi } from '../../api/catalogApi.js';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';

export default function BrandsPage({ organizationId }) {
  const [brands, setBrands] = useState([]);
  const [name, setName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [editing, setEditing] = useState(null);
  const [state, setState] = useState({ loading: true, error: null });

  const load = useCallback(() => {
    catalogApi.listBrands(organizationId)
      .then((result) => {
        setBrands(result.data);
        setState({ loading: false, error: null });
      })
      .catch((error) => setState({ loading: false, error }));
  }, [organizationId]);

  useEffect(load, [load]);

  async function create(event) {
    event.preventDefault();
    try {
      await catalogApi.createBrand(organizationId, {
        name,
        websiteUrl: websiteUrl || null,
        isActive: true,
      });
      setName('');
      setWebsiteUrl('');
      load();
    } catch (error) {
      setState({ loading: false, error });
    }
  }

  async function toggle(brand) {
    await catalogApi.patchBrand(organizationId, brand.id, { isActive: !brand.is_active });
    load();
  }

  async function saveEdit(event) {
    event.preventDefault();
    await catalogApi.patchBrand(organizationId, editing.id, {
      name: editing.name,
      websiteUrl: editing.websiteUrl || null,
    });
    setEditing(null);
    load();
  }

  return (
    <>
      <PageHeader title="Brands" description="Brand names are unique within the organization and can be deactivated without deleting referenced products." />
      <form className="inline-create-form" onSubmit={create}>
        <label>Brand name<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Logitech" /></label>
        <label>Website<input type="url" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://…" /></label>
        <button className="primary-button">Add brand</button>
      </form>
      {state.loading ? <LoadingState /> : state.error ? <ErrorState error={state.error} /> : brands.length === 0 ? <EmptyState title="No brands yet" message="Add the first brand above." /> : (
        <div className="catalog-card-list">
          {brands.map((brand) => (
            <article className="catalog-list-card" key={brand.id}>
              {editing?.id === brand.id ? (
                <form className="brand-edit-row" onSubmit={saveEdit}>
                  <input aria-label="Edit brand name" required value={editing.name} onChange={(event) => setEditing((current) => ({ ...current, name: event.target.value }))} />
                  <input aria-label="Edit brand website" type="url" value={editing.websiteUrl} onChange={(event) => setEditing((current) => ({ ...current, websiteUrl: event.target.value }))} />
                  <button className="primary-button">Save</button>
                  <button type="button" className="text-button" onClick={() => setEditing(null)}>Cancel</button>
                </form>
              ) : (
                <>
                  <div><h3>{brand.name}</h3><p>{brand.website_url || 'No website'}</p></div>
                  <div className="list-card-actions">
                    <button className="text-button" onClick={() => setEditing({ id: brand.id, name: brand.name, websiteUrl: brand.website_url || '' })}>Edit</button>
                    <button className="secondary-button" onClick={() => toggle(brand)}>{brand.is_active ? 'Archive' : 'Reactivate'}</button>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
