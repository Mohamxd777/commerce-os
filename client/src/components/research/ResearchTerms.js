export const researchTerms = {
  ROI: 'العائد على الاستثمار: يقيس الربح مقارنة بالمبلغ الذي تم استثماره.',
  'Net Margin': 'نسبة صافي الربح من سعر البيع بعد خصم التكاليف.',
  'Break-even': 'السعر أو مستوى المبيعات الذي لا يوجد عنده ربح أو خسارة.',
  MOQ: 'أقل كمية يسمح المورد بطلبها في الطلب الواحد.',
  'Lead Time': 'الوقت المتوقع من طلب البضاعة حتى استلامها.',
  'Estimated Return Reserve': 'مبلغ احتياطي تقديري لتغطية أثر المرتجعات أو الوحدات المعيبة.',
  'Contribution Profit': 'المبلغ المتبقي من بيع الوحدة بعد خصم التكاليف المتغيرة المرتبطة بها.',
};

export function money(value, currency = 'EGP') {
  if (value === null || value === undefined || value === '') return '—';
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(Number(value));
}

export function percent(value) {
  return value === null || value === undefined ? '—' : Number(value).toFixed(2) + '%';
}
