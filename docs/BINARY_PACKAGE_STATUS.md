# حالة الحزمة الثنائية — مُتقِن

## الحزمة الثنائية
- `mutqan-php-clean-package.zip` موجود في جذر المستودع ويتم بناؤه تلقائيًا عبر GitHub Actions.
- البناء يشغّل `git archive` ويتحقق من سلامة ZIP عبر `unzip -t`.
- [تنزيل ZIP](https://github.com/alizizo888-code/mutaqin-maintenance-services/raw/refs/heads/main/mutqan-php-clean-package.zip)
- [سجل البناء](https://github.com/alizizo888-code/mutaqin-maintenance-services/actions/workflows/build-package.yml)

## مصدر React/Vite
تم رفع الإعدادات و16 ملفًا من المستوى الرئيسي لـ `src/`، و20 صفحة تشغيلية داخل `react-export/src/pages/`، و11 صفحة عميل داخل `react-export/src/pages/client/`.

المجلدات/الدفعات المتبقية:
- `react-export/src/components/` — لم تُرفع بعد
- `react-export/src/hooks/` — لم تُرفع بعد
- `react-export/src/lib/` — تم رفع 20 من أصل 49 ملفًا، ويتبقى 29

تنبيه: ملفات `lib` ذات الأسماء التي تبدأ بشرطة سفلية في الدفعة الأولى هي Whacka stubs توثّق واجهات المنصة ولا تقدم تنفيذ الخدمات نفسها.

ملفات App.jsx وملفات الخدمة تستورد وحدات من هذه المسارات؛ لذلك React export غير مكتمل ولا ينبغي اعتبار نجاح ZIP على أنه نجاح بناء React.

## قيود المصدر الأصلي
الملف الثنائي ZIP الموجود في المستودع يعاد بناؤه من ملفات المستودع وليس مطابقًا بايتًا ببايت للأرشيف المحلي. README الأصلي من Whacka محفوظ منفصلًا ويذكر أن خدمات المصادقة والبيانات والتخزين والذكاء الاصطناعي والمدفوعات والإشعارات تعتمد على المنصة وليست ضمن التصدير.
