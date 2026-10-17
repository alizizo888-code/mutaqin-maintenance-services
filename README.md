# مُتقن MUTQAN — منصة الصيانة (PHP + MySQL)

المستودع يحتوي على مصدر PHP قابل للتثبيت، وواجهات API، ومخطط قاعدة البيانات، وواجهات HTML التجريبية، والتوثيق، والملفات المصدرية المقروءة التي رُفعت للمراجعة.

## تنزيل حزمة ZIP
ملف ثنائي باسم `mutqan-php-clean-package.zip` موجود في جذر المستودع، ويتم بناؤه والتحقق من سلامته تلقائيًا عبر GitHub Actions من الملفات المتتبعة في الفرع `main`.

- [تنزيل حزمة ZIP الثنائية من GitHub](https://github.com/alizizo888-code/mutaqin-maintenance-services/raw/refs/heads/main/mutqan-php-clean-package.zip)
- [سجل بناء الحزمة](https://github.com/alizizo888-code/mutaqin-maintenance-services/actions/workflows/build-package.yml)

**ملاحظة مهمة عن التطابق:** الحزمة الثنائية الموجودة في المستودع يُعاد بناؤها داخل GitHub من شجرة المصدر الحالية؛ لذلك ليست نسخة بايت-ببايت من ملف ZIP المحلي المرفق بالمحادثة. الأرشيف المحلي الأصلي يحتوي أيضًا على أرشيف React داخلي لم يُسجل حتى الآن كملف منفصل داخل المستودع.

## بدء التشغيل
1. ارفع الملفات إلى استضافة PHP مثل Hostinger.
2. أنشئ قاعدة MySQL ثم استورد `database/schema.sql` من phpMyAdmin.
3. انسخ `backend/config/config.local.php.example` إلى `backend/config/config.local.php` وضع بيانات قاعدة البيانات الحقيقية.
4. افتح النطاق. لا ترفع كلمات المرور أو الأسرار إلى GitHub.

## المكونات
- `index.php`: واجهة طلب الصيانة.
- `backend/api/api.php`: واجهة API الأساسية للأنظمة.
- `backend/api/operations.php`: واجهة غرفة العمليات والإسناد.
- `backend/api/invoices.php`: عمليات الفواتير.
- `backend/upload/image-handler.php`: رفع الصور المحلية والتحقق من بصمة SHA-256.
- `frontend/prototypes/`: معاينات واجهات العميل وغرفة العمليات والفواتير.
- `docs/`: تقارير ومخططات المشروع.
- `reference/original-uploads/`: الملفات النصية الأصلية التي رُفعت للمراجعة.
