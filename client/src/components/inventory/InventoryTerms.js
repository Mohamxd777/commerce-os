export const inventoryTerms = {
  'ROP / Reorder Point': 'مستوى المخزون الذي عند الوصول إليه تبدأ التفكير في طلب كمية جديدة.',
  'Safety Stock': 'كمية احتياطية من المخزون لتقليل خطر نفاد المنتج أثناء تأخر التوريد أو زيادة الطلب.',
  'Available Stock': 'الكمية الموجودة حاليًا والقابلة للبيع أو الاستخدام.',
  'Reserved Stock': 'كمية موجودة فعليًا لكنها محجوزة لطلبات ولم تعد متاحة للبيع لطلب آخر.',
  'Quarantine Stock': 'مخزون معزول مؤقتًا لحين الفحص أو اتخاذ قرار بشأنه.',
  'Stock Adjustment': 'حركة تصحيح مسجلة عند وجود فرق بين المخزون الفعلي والمخزون المسجل في النظام.',
  'Inventory Ledger': 'سجل لكل حركة دخول أو خروج أو تغيير في المخزون، ومنه يمكن معرفة سبب الرصيد الحالي.',
};

export const bucketLabels = {
  available: 'Available',
  reserved: 'Reserved',
  quarantine: 'Quarantine',
  damaged: 'Damaged',
};

export function quantity(value) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 4,
  });
}
