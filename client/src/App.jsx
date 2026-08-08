import AppLayout from './components/layout/AppLayout.jsx';
import BusinessTerm from './components/BusinessTerm.jsx';

const readinessItems = [
  ['Identity & access', 'Users, roles, and permissions'],
  ['Organization', 'Business profile and memberships'],
  ['Locations', 'Warehouse and operating-location foundation'],
];

export default function App() {
  return (
    <AppLayout>
      <section className="welcome-panel">
        <p className="eyebrow">Engineering foundation</p>
        <h1>Your commerce workspace starts here.</h1>
        <p className="lead">
          The foundation is ready for secure, auditable modules to be added one deliberate step at a time.
        </p>
      </section>

      <section aria-labelledby="foundation-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Task 1</p>
            <h2 id="foundation-heading">Foundation areas</h2>
          </div>
          <span className="status-badge">Ready</span>
        </div>
        <div className="card-grid">
          {readinessItems.map(([title, description]) => (
            <article className="foundation-card" key={title}>
              <span className="card-marker" aria-hidden="true" />
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="glossary-preview" aria-labelledby="glossary-heading">
        <div>
          <p className="eyebrow">Built for learning</p>
          <h2 id="glossary-heading">Business glossary</h2>
          <p>Important terms include a simple Arabic explanation throughout the interface.</p>
        </div>
        <div className="term-row">
          <BusinessTerm term="ROI" explanation="العائد على الاستثمار: مقدار الربح مقارنةً بالمبلغ الذي استثمرته." />
          <BusinessTerm term="MOQ" explanation="الحد الأدنى لكمية الطلب التي يقبل المورد بيعها." />
          <BusinessTerm term="COGS" explanation="تكلفة البضاعة المباعة: التكلفة المباشرة للمنتجات التي تم بيعها." />
        </div>
      </section>
    </AppLayout>
  );
}
