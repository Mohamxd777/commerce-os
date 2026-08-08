const navigation = ['Overview', 'Organization', 'Team & access', 'Locations', 'Business glossary'];

export default function AppLayout({ children }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="Commerce OS home">
          <span className="brand-mark">C</span>
          <span><strong>Commerce</strong><small>Operating System</small></span>
        </a>
        <nav aria-label="Primary navigation">
          <p className="nav-label">Workspace</p>
          <ul>
            {navigation.map((item, index) => (
              <li key={item}>
                <a className={index === 0 ? 'active' : ''} href={'#' + item.toLowerCase().replaceAll(' ', '-')}>
                  <span className="nav-dot" aria-hidden="true" />{item}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="sidebar-footer">
          <span className="avatar">O</span>
          <span><strong>Owner</strong><small>Development workspace</small></span>
        </div>
      </aside>
      <div className="page">
        <header className="topbar" id="top">
          <div><span className="mobile-brand">Commerce OS</span></div>
          <div className="environment"><span />Local development</div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
