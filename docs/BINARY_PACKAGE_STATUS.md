# حالة الحزمة الثنائية — مُتقِن

## الحزمة الثنائية
- `mutqan-php-clean-package.zip` موجود في جذر المستودع ويتم بناؤه تلقائيًا عبر GitHub Actions.
- البناء يشغّل `git archive` ويتحقق من سلامة ZIP عبر `unzip -t`.
- [تنزيل ZIP](https://github.com/alizizo888-code/mutaqin-maintenance-services/raw/refs/heads/main/mutqan-php-clean-package.zip)
- [سجل البناء](https://github.com/alizizo888-code/mutaqin-maintenance-services/actions/workflows/build-package.yml)

## مصدر React/Vite
تم رفع الإعدادات و16 ملفًا من المستوى الرئيسي لـ `src/`، و20 صفحة تشغيلية داخل `react-export/src/pages/`، و11 صفحة عميل داخل `react-export/src/pages/client/`، و49 ملفًا من أصل 49 داخل `react-export/src/lib/`.

المجلدات المتبقية:
- `react-export/src/components/` — تم العثور على 21 ملفًا في `components/` بجذر المستودع، ونُسخت إلى مسار React الصحيح مع الاحتفاظ بالأصل
- `react-export/src/hooks/` — تم رفع 11 ملفًا

تنبيه: ملفات lib الموردة تصف نفسها على أنها Whacka stubs؛ وجودها في المستودع يحافظ على مسارات الملفات وأسماء الواجهات، لكنه لا يوفّر تنفيذ خدمات المنصة.

ملفات App.jsx وملفات الخدمة تستورد وحدات من هذه المسارات؛ لذلك React export غير مكتمل ولا ينبغي اعتبار نجاح ZIP على أنه نجاح بناء React.

## قيود المصدر الأصلي
الملف الثنائي ZIP الموجود في المستودع يعاد بناؤه من ملفات المستودع وليس مطابقًا بايتًا ببايت للأرشيف المحلي. README الأصلي من Whacka محفوظ منفصلًا ويذكر أن خدمات المصادقة والبيانات والتخزين والذكاء الاصطناعي والمدفوعات والإشعارات تعتمد على المنصة وليست ضمن التصدير.
