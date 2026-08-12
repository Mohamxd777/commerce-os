export const researchTerms = {
  ROI: 'العائد على الاستثمار: يقيس الربح مقارنة بالمبلغ الذي تم استثماره.',
  'Net Margin': 'هامش صافي الربح: نسبة الربح من سعر البيع بعد خصم كل التكاليف المتغيرة.',
  Margin: 'الهامش: نسبة الربح المتبقية من سعر البيع بعد خصم التكاليف.',
  'Break-even': 'سعر التعادل: أقل سعر بيع يغطي التكاليف بدون ربح أو خسارة.',
  MOQ: 'الحد الأدنى للطلب: أقل كمية يسمح المورد بطلبها في المرة الواحدة.',
  'Lead Time': 'مدة التوريد: الوقت المتوقع من طلب البضاعة حتى استلامها.',
  'Estimated Return Reserve': 'مبلغ احتياطي تقديري لتغطية أثر المرتجعات أو الوحدات المعيبة.',
  'Contribution Profit': 'ربح المساهمة: المبلغ المتبقي من بيع الوحدة بعد خصم التكاليف المتغيرة المرتبطة بها.',
};

export function money(value, currency = 'EGP') {
  if (value === null || value === undefined || value === '') return '—';
  return new Intl.NumberFormat('en-EG', { style: 'currency', currency }).format(Number(value));
}

export function percent(value) {
  return value === null || value === undefined ? '—' : Number(value).toFixed(2) + '%';
}
