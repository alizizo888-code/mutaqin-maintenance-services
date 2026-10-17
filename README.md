# مُتقن MUTQAN — منصة الصيانة

المستودع يضم أساس PHP + MySQL، وواجهات HTML التجريبية، ونسخة جزئية من تصدير React/Vite.

## آخر تحديث لمصدر React
تم رفع 16 ملفًا من المستوى الرئيسي إلى `react-export/src/`، بما فيها `App.jsx`, `main.jsx`, `index.css` ومحركات التسجيل والخدمات والضمان والتسعير والإشعارات والذكاء الاصطناعي والمدفوعات.

**تصدير React غير مكتمل بعد:** ننتظر المجلدات التي تستوردها الملفات، وهي:
- `react-export/src/components/`
- `react-export/src/hooks/`
- `react-export/src/lib/`
- `react-export/src/pages/`

بعض ملفات الإعدادات و`src` تعتمد على SDK خاص بمنصة Whacka، وتصدير README الأصلي يوضح أن خدمات المصادقة والبيانات والتخزين والذكاء الاصطناعي ليست ضمن التصدير وحده؛ لذلك لا يعتبر مجلد React الحالي بناءً مستقلًا قابلًا للتشغيل حتى اكتمال هذه التبعيات وتكييفها.

## تنزيل الحزمة الثنائية
- [تنزيل mutqan-php-clean-package.zip](https://github.com/alizizo888-code/mutaqin-maintenance-services/raw/refs/heads/main/mutqan-php-clean-package.zip)
- [سجل بناء الحزمة](https://github.com/alizizo888-code/mutaqin-maintenance-services/actions/workflows/build-package.yml)

ZIP الحالي يُبنى تلقائيًا من شجرة المستودع؛ بعد كل رفع إلى `main` يعاد بناؤه والتحقق منه.

## تشغيل نسخة PHP
1. استورد `database/schema.sql` في قاعدة MySQL جديدة.
2. انسخ `backend/config/config.local.php.example` إلى `backend/config/config.local.php`.
3. أدخل بيانات MySQL من Hostinger محليًا، ولا ترفع الأسرار إلى GitHub.
4. اختبر الموقع بعد إعداد الاتصال.
