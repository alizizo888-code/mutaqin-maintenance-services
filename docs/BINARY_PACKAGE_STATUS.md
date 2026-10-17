# حالة الحزمة الثنائية — مُتقِن

## الحالة المؤكدة
- الملف الثنائي `mutqan-php-clean-package.zip` موجود في جذر المستودع.
- أُعيد بناؤه عبر GitHub Actions من الملفات المتتبعة في الفرع `main`.
- اجتاز فحص سلامة ZIP `unzip -t`، وآخر عملية بناء موثقة نجحت.
- [تنزيل ZIP](https://github.com/alizizo888-code/mutaqin-maintenance-services/raw/refs/heads/main/mutqan-php-clean-package.zip)
- [سجل بناء الحزمة](https://github.com/alizizo888-code/mutaqin-maintenance-services/actions/workflows/build-package.yml)

## الملفات الجديدة
تم رفع ملفات إعدادات React/Vite الستة التي أُرسلت بشكل منفصل إلى `react-export/`.

## القيد المتبقي
الحزمة الموجودة على GitHub هي نسخة مولدة من شجرة المصدر الحالية، وليست نسخة مطابقة بايتًا ببايت لملف ZIP المحلي المرفق بالمحادثة. أرشيف المصدر `mutaqin (2).zip` يحتوي على تطبيق React ومجلد `src/`، لكن هذا الأرشيف الثنائي نفسه ومحتويات مجلد `src/` لم تُنقل كاملة إلى GitHub حتى الآن. لذلك مجلد `react-export/` الحالي لا يُبنى منفردًا بعد.
