const navigationGroups = [
  {
    label: 'Workspace',
    items: [['Overview', '#overview']],
  },
  {
    label: 'Catalog',
    items: [
      ['Products', '#products'],
      ['Brands', '#brands'],
      ['Categories', '#categories'],
      ['SKUs', '#skus'],
    ],
  },
  {
    label: 'Purchasing',
    items: [
      ['Summary', '#purchasing'],
      ['Suppliers', '#suppliers'],
      ['Purchase Orders', '#purchase-orders'],
      ['Goods Receipts', '#goods-receipts'],
    ],
  },
  {
    label: 'Inventory',
    items: [
      ['Overview', '#inventory'],
      ['Stock', '#inventory/stock'],
      ['Movements', '#inventory/movements'],
      ['Transfers', '#inventory/transfers'],
      ['Reorder Rules', '#inventory/reorder-rules'],
    ],
  },
  {
    label: 'Product Research',
    items: [
      ['Workspace', '#research'],
      ['Quick Capture', '#research/quick-capture'],
      ['Summary', '#research/overview'],
      ['Comparison', '#research/comparison'],
      ['Launch Settings', '#research/settings'],
    ],
  },
];

export default function AppLayout({
  children,
  activeRoute = 'overview',
  userName = 'Owner',
  organizationName = 'Commerce workspace',
}) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="Commerce OS home">
          <span className="brand-mark">C</span>
          <span><strong>Commerce</strong><small>Operating System</small></span>
        </a>
        <nav aria-label="Primary navigation">
          {navigationGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <p className="nav-label">{group.label}</p>
              <ul>
                {group.items.map(([label, href]) => {
                  const route = href.slice(1);
                  const active = activeRoute === route
                    || (!['inventory', 'research'].includes(route) && activeRoute.startsWith(route + '/'));
                  return (
                    <li key={label}>
                      <a className={active ? 'active' : ''} href={href}>
                        <span className="nav-dot" aria-hidden="true" />{label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="avatar">{userName.slice(0, 1).toUpperCase()}</span>
          <span><strong>{userName}</strong><small>{organizationName}</small></span>
        </div>
      </aside>
      <div className="page">
        <header className="topbar" id="top">
          <div><span className="mobile-brand">Commerce OS</span></div>
          <div className="environment"><span />Catalog, purchasing, inventory &amp; research</div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
