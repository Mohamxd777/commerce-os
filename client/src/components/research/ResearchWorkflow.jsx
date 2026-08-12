const stages = [
  ['idea', 'Idea'], ['supplier', 'Supplier'], ['market', 'Market'],
  ['economics', 'Economics'], ['sample', 'Sample'], ['decision', 'Decision'], ['sku', 'SKU'],
];

export default function ResearchWorkflow({ currentStage = 'idea' }) {
  const currentIndex = Math.max(0, stages.findIndex(([key]) => key === currentStage));
  return (
    <ol className="research-workflow" aria-label="Product research workflow">
      {stages.map(([key, label], index) => (
        <li className={index < currentIndex ? 'complete' : index === currentIndex ? 'current' : ''} key={key} aria-current={index === currentIndex ? 'step' : undefined}>
          <span>{index < currentIndex ? '✓' : index + 1}</span><strong>{label}</strong>
        </li>
      ))}
    </ol>
  );
}
