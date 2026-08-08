import { useCallback, useEffect, useState } from 'react';
import { authApi } from '../../api/catalogApi.js';
import BusinessTerm from '../../components/BusinessTerm.jsx';
import { LoadingState } from '../../components/catalog/CatalogStates.jsx';
import AppLayout from '../../components/layout/AppLayout.jsx';
import BrandsPage from './BrandsPage.jsx';
import CategoriesPage from './CategoriesPage.jsx';
import ProductDetailPage from './ProductDetailPage.jsx';
import ProductEditPage from './ProductEditPage.jsx';
import ProductFormPage from './ProductFormPage.jsx';
import ProductsPage from './ProductsPage.jsx';
import SkusPage from './SkusPage.jsx';
import GoodsReceiptDetailPage from '../purchasing/GoodsReceiptDetailPage.jsx';
import GoodsReceiptsPage from '../purchasing/GoodsReceiptsPage.jsx';
import PurchaseOrderDetailPage from '../purchasing/PurchaseOrderDetailPage.jsx';
import PurchaseOrderFormPage from '../purchasing/PurchaseOrderFormPage.jsx';
import PurchaseOrdersPage from '../purchasing/PurchaseOrdersPage.jsx';
import PurchasingOverviewPage from '../purchasing/PurchasingOverviewPage.jsx';
import ReceivePurchaseOrderPage from '../purchasing/ReceivePurchaseOrderPage.jsx';
import SupplierComparisonPage from '../purchasing/SupplierComparisonPage.jsx';
import SupplierDetailPage from '../purchasing/SupplierDetailPage.jsx';
import SupplierFormPage from '../purchasing/SupplierFormPage.jsx';
import SuppliersPage from '../purchasing/SuppliersPage.jsx';
import InventoryAdjustmentPage from '../inventory/InventoryAdjustmentPage.jsx';
import InventoryMovementsPage from '../inventory/InventoryMovementsPage.jsx';
import InventoryOverviewPage from '../inventory/InventoryOverviewPage.jsx';
import InventoryReorderRulesPage from '../inventory/InventoryReorderRulesPage.jsx';
import InventoryStockPage from '../inventory/InventoryStockPage.jsx';
import InventoryTransferDetailPage from '../inventory/InventoryTransferDetailPage.jsx';
import InventoryTransferFormPage from '../inventory/InventoryTransferFormPage.jsx';
import InventoryTransfersPage from '../inventory/InventoryTransfersPage.jsx';
import SkuInventoryDetailPage from '../inventory/SkuInventoryDetailPage.jsx';
import ResearchCandidateDetailPage from '../research/ResearchCandidateDetailPage.jsx';
import ResearchCandidateFormPage from '../research/ResearchCandidateFormPage.jsx';
import ResearchCandidatesPage from '../research/ResearchCandidatesPage.jsx';
import ResearchComparisonPage from '../research/ResearchComparisonPage.jsx';
import ResearchOverviewPage from '../research/ResearchOverviewPage.jsx';
import ResearchSettingsPage from '../research/ResearchSettingsPage.jsx';

function useHashRoute() {
  const readRoute = () => window.location.hash.slice(1) || 'overview';
  const [route, setRoute] = useState(readRoute);

  useEffect(() => {
    const update = () => setRoute(readRoute());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);

  return route;
}

function LoginPanel({ onAuthenticated }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await authApi.login({ email, password });
      await onAuthenticated();
    } catch (loginError) {
      setError(loginError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <span className="brand-mark">C</span>
        <p className="eyebrow">Commerce OS</p>
        <h1>Sign in to your catalog</h1>
        <p>Use the owner account created through the Task 1 authentication foundation.</p>
        <label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Password<input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {error && <div className="form-error" role="alert">{error.message}</div>}
        <button className="primary-button" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}

function CatalogOverview() {
  const areas = [
    ['Products', 'Stable product identity, specifications, and archival status.'],
    ['Variants', 'Sellable versions with attributes such as color or layout.'],
    ['SKUs', 'Organization-unique inventory identities reviewed by the user.'],
    ['Barcodes', 'Multiple typed identifiers attached to a SKU.'],
  ];

  return (
    <>
      <section className="welcome-panel catalog-welcome">
        <p className="eyebrow">Task 2 · Product catalog</p>
        <h1>Build a catalog that stays useful as the business grows.</h1>
        <p className="lead">Products describe what you sell. Variants describe each version. SKUs identify the units future inventory workflows will track.</p>
        <a className="hero-button" href="#products/new">Create a product</a>
      </section>
      <section>
        <div className="section-heading">
          <div><p className="eyebrow">Catalog model</p><h2>Clear identities, no stock shortcuts</h2></div>
        </div>
        <div className="card-grid catalog-overview-grid">
          {areas.map(([title, description]) => (
            <article className="foundation-card" key={title}>
              <span className="card-marker" />
              <h3>{title === 'SKUs' ? <BusinessTerm term="SKU" explanation="كود داخلي مميز لكل نسخة قابلة للبيع من المنتج." /> : title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

export default function CatalogApp() {
  const route = useHashRoute();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const loadSession = useCallback(async () => {
    try {
      const result = await authApi.me();
      setSession(result.data);
      setAuthError(null);
    } catch (error) {
      setSession(null);
      setAuthError(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    authApi.me()
      .then((result) => {
        if (!cancelled) {
          setSession(result.data);
          setAuthError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setSession(null);
          setAuthError(error);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <LoadingState label="Opening Commerce OS…" />;
  if (!session && authError?.status === 401) return <LoginPanel onAuthenticated={loadSession} />;
  if (!session) return <div className="login-shell"><div className="login-card form-error">{authError?.message}</div></div>;

  const membership = session.memberships[0];
  if (!membership) {
    return <div className="login-shell"><div className="login-card">This user has no active organization membership.</div></div>;
  }

  const organizationId = membership.organization_id;
  let page = <CatalogOverview />;

  if (route === 'products') page = <ProductsPage organizationId={organizationId} />;
  else if (route === 'products/new') page = <ProductFormPage organizationId={organizationId} />;
  else if (/^products\/[^/]+\/edit$/.test(route)) {
    page = <ProductEditPage organizationId={organizationId} productId={route.split('/')[1]} />;
  } else if (/^products\/[^/]+$/.test(route)) {
    page = <ProductDetailPage organizationId={organizationId} productId={route.split('/')[1]} />;
  } else if (route === 'brands') page = <BrandsPage organizationId={organizationId} />;
  else if (route === 'categories') page = <CategoriesPage organizationId={organizationId} />;
  else if (route === 'skus') page = <SkusPage organizationId={organizationId} />;
  else if (/^skus\/[^/]+\/suppliers$/.test(route)) {
    page = <SupplierComparisonPage organizationId={organizationId} skuId={route.split('/')[1]} />;
  } else if (route === 'purchasing') page = <PurchasingOverviewPage organizationId={organizationId} />;
  else if (route === 'suppliers') page = <SuppliersPage organizationId={organizationId} />;
  else if (route === 'suppliers/new') page = <SupplierFormPage organizationId={organizationId} />;
  else if (/^suppliers\/[^/]+\/edit$/.test(route)) {
    page = <SupplierFormPage organizationId={organizationId} supplierId={route.split('/')[1]} />;
  } else if (/^suppliers\/[^/]+$/.test(route)) {
    page = <SupplierDetailPage organizationId={organizationId} supplierId={route.split('/')[1]} />;
  } else if (route === 'purchase-orders') page = <PurchaseOrdersPage organizationId={organizationId} />;
  else if (route === 'purchase-orders/new') page = <PurchaseOrderFormPage organizationId={organizationId} />;
  else if (/^purchase-orders\/[^/]+\/edit$/.test(route)) {
    page = <PurchaseOrderFormPage organizationId={organizationId} purchaseOrderId={route.split('/')[1]} />;
  } else if (/^purchase-orders\/[^/]+\/receive$/.test(route)) {
    page = <ReceivePurchaseOrderPage organizationId={organizationId} purchaseOrderId={route.split('/')[1]} />;
  } else if (/^purchase-orders\/[^/]+$/.test(route)) {
    page = <PurchaseOrderDetailPage organizationId={organizationId} purchaseOrderId={route.split('/')[1]} />;
  } else if (route === 'goods-receipts') page = <GoodsReceiptsPage organizationId={organizationId} />;
  else if (/^goods-receipts\/[^/]+$/.test(route)) {
    page = <GoodsReceiptDetailPage organizationId={organizationId} receiptId={route.split('/')[1]} />;
  } else if (route === 'inventory') page = <InventoryOverviewPage organizationId={organizationId} />;
  else if (route === 'inventory/stock') page = <InventoryStockPage organizationId={organizationId} />;
  else if (route === 'inventory/movements') page = <InventoryMovementsPage organizationId={organizationId} />;
  else if (route === 'inventory/adjustments/new') page = <InventoryAdjustmentPage organizationId={organizationId} />;
  else if (route === 'inventory/transfers') page = <InventoryTransfersPage organizationId={organizationId} />;
  else if (route === 'inventory/transfers/new') page = <InventoryTransferFormPage organizationId={organizationId} />;
  else if (/^inventory\/transfers\/[^/]+$/.test(route)) {
    page = <InventoryTransferDetailPage organizationId={organizationId} transferId={route.split('/')[2]} />;
  } else if (route === 'inventory/reorder-rules') page = <InventoryReorderRulesPage organizationId={organizationId} />;
  else if (/^inventory\/skus\/[^/]+$/.test(route)) {
    page = <SkuInventoryDetailPage organizationId={organizationId} skuId={route.split('/')[2]} />;
  } else if (route === 'research') page = <ResearchOverviewPage organizationId={organizationId} />;
  else if (route === 'research/candidates') page = <ResearchCandidatesPage organizationId={organizationId} />;
  else if (route === 'research/candidates/new') page = <ResearchCandidateFormPage organizationId={organizationId} />;
  else if (/^research\/candidates\/[^/]+$/.test(route)) {
    page = <ResearchCandidateDetailPage organizationId={organizationId} candidateId={route.split('/')[2]} />;
  } else if (route === 'research/comparison') {
    page = <ResearchComparisonPage organizationId={organizationId} />;
  } else if (/^research\/comparison\/[^/]+$/.test(route)) {
    page = <ResearchComparisonPage organizationId={organizationId} initialIds={route.split('/')[2].split(',')} />;
  } else if (route === 'research/settings') page = <ResearchSettingsPage organizationId={organizationId} />;

  return (
    <AppLayout
      activeRoute={route}
      userName={session.user.displayName}
      organizationName={membership.organization_name}
    >
      {page}
    </AppLayout>
  );
}
