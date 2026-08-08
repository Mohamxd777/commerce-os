import { useCallback, useEffect, useState } from 'react';
import { catalogApi } from '../../api/catalogApi.js';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/catalog/CatalogStates.jsx';

export default function CategoriesPage({ organizationId }) {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ name: '', parentId: '' });
  const [state, setState] = useState({ loading: true, error: null });

  const load = useCallback(() => {
    catalogApi.listCategories(organizationId)
      .then((result) => {
        setCategories(result.data);
        setState({ loading: false, error: null });
      })
      .catch((error) => setState({ loading: false, error }));
  }, [organizationId]);

  useEffect(load, [load]);

  async function create(event) {
    event.preventDefault();
    try {
      await catalogApi.createCategory(organizationId, {
        name: form.name,
        parentId: form.parentId || null,
        isActive: true,
      });
      setForm({ name: '', parentId: '' });
      load();
    } catch (error) {
      setState({ loading: false, error });
    }
  }

  async function toggle(category) {
    await catalogApi.patchCategory(organizationId, category.id, { isActive: !category.is_active });
    load();
  }

  return (
    <>
      <PageHeader title="Categories" description="The path view makes parent-child relationships visible. Circular relationships are blocked by the API and PostgreSQL." />
      <form className="inline-create-form" onSubmit={create}>
        <label>Category name<input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Gaming Mice" /></label>
        <label>Parent category<select value={form.parentId} onChange={(event) => setForm((current) => ({ ...current, parentId: event.target.value }))}><option value="">Root category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.path}</option>)}</select></label>
        <button className="primary-button">Add category</button>
      </form>
      {state.loading ? <LoadingState /> : state.error ? <ErrorState error={state.error} /> : categories.length === 0 ? <EmptyState title="No categories yet" message="Create a root category first." /> : (
        <div className="category-tree-list">
          {categories.map((category) => (
            <article className={'category-row depth-' + Math.min(category.depth, 4)} key={category.id}>
              <span className="tree-line" />
              <div><strong>{category.name}</strong><small>{category.path}</small></div>
              <button className="text-button" onClick={() => toggle(category)}>{category.is_active ? 'Archive' : 'Reactivate'}</button>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
