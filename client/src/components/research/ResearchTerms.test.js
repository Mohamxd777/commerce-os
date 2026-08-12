import { describe, expect, it } from 'vitest';
import { researchTerms } from './ResearchTerms.js';

describe('Research business terms', () => {
  it('provides the required Arabic definitions exactly', () => {
    expect(researchTerms.ROI).toBe('العائد على الاستثمار: يقيس الربح مقارنة بالمبلغ الذي تم استثماره.');
    expect(researchTerms['Net Margin']).toBe('هامش صافي الربح: نسبة الربح من سعر البيع بعد خصم كل التكاليف المتغيرة.');
    expect(researchTerms.Margin).toBe('الهامش: نسبة الربح المتبقية من سعر البيع بعد خصم التكاليف.');
    expect(researchTerms['Break-even']).toBe('سعر التعادل: أقل سعر بيع يغطي التكاليف بدون ربح أو خسارة.');
    expect(researchTerms.MOQ).toBe('الحد الأدنى للطلب: أقل كمية يسمح المورد بطلبها في المرة الواحدة.');
    expect(researchTerms['Lead Time']).toBe('مدة التوريد: الوقت المتوقع من طلب البضاعة حتى استلامها.');
    expect(researchTerms['Estimated Return Reserve']).toBe('مبلغ احتياطي تقديري لتغطية أثر المرتجعات أو الوحدات المعيبة.');
    expect(researchTerms['Contribution Profit']).toBe('ربح المساهمة: المبلغ المتبقي من بيع الوحدة بعد خصم التكاليف المتغيرة المرتبطة بها.');
  });
});
