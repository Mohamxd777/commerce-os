export function LoadingState({ label = 'Loading catalog…' }) {
  return <div className="catalog-state">{label}</div>;
}

export function EmptyState({ title, message }) {
  return (
    <div className="catalog-state empty-state">
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  );
}

export function ErrorState({ error }) {
  return (
    <div className="catalog-state error-state" role="alert">
      <strong>Could not load this catalog view.</strong>
      <span>{error?.message || 'Please try again.'}</span>
    </div>
  );
}

export function PageHeader({ eyebrow = 'Catalog', title, description, action }) {
  return (
    <header className="catalog-page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  );
}
