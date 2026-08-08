import { describe, expect, it } from 'vitest';
import { researchTerms } from './ResearchTerms.js';

describe('Research business terms', () => {
  it('provides the required Arabic definitions exactly', () => {
    expect(researchTerms.ROI).toBe('العائد على الاستثمار: يقيس الربح مقارنة بالمبلغ الذي تم استثماره.');
    expect(researchTerms['Net Margin']).toBe('نسبة صافي الربح من سعر البيع بعد خصم التكاليف.');
    expect(researchTerms['Break-even']).toBe('السعر أو مستوى المبيعات الذي لا يوجد عنده ربح أو خسارة.');
    expect(researchTerms.MOQ).toBe('أقل كمية يسمح المورد بطلبها في الطلب الواحد.');
    expect(researchTerms['Lead Time']).toBe('الوقت المتوقع من طلب البضاعة حتى استلامها.');
    expect(researchTerms['Estimated Return Reserve']).toBe('مبلغ احتياطي تقديري لتغطية أثر المرتجعات أو الوحدات المعيبة.');
    expect(researchTerms['Contribution Profit']).toBe('المبلغ المتبقي من بيع الوحدة بعد خصم التكاليف المتغيرة المرتبطة بها.');
  });
});
