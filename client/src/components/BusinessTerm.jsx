import { useId, useState } from 'react';

export default function BusinessTerm({ term, explanation }) {
  const tooltipId = useId();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span className="business-term">
      <span>{term}</span>
      <button
        type="button"
        className="term-info"
        aria-label={'Explain ' + term}
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
      >
        ⓘ
      </button>
      {isOpen && (
        <span id={tooltipId} role="tooltip" className="term-tooltip" dir="rtl">
          {explanation}
        </span>
      )}
    </span>
  );
}
