# مُتقن MUTQAN — منصة الصيانة

المستودع يضم أساس PHP + MySQL، وواجهات HTML التجريبية، ونسخة جزئية من تصدير React/Vite.

## آخر تحديث لمصدر React
تم رفع 16 ملفًا من المستوى الرئيسي إلى `react-export/src/`، بالإضافة إلى 20 صفحة إلى `react-export/src/pages/`، منها `NewOrder.jsx` و`ClientOrderDetail.jsx` وصفحات العمليات والفنيين والإشعارات والدفع والذكاء الاصطناعي.

**تصدير React غير مكتمل بعد:** صفحات المستوى الرئيسي موجودة، لكن لا تزال المجلدات التالية ناقصة:
- `react-export/src/components/`
- `react-export/src/hooks/`
- `react-export/src/lib/`
- `react-export/src/pages/client/` (صفحات واجهة العميل المستوردة من `App.jsx` مثل `Home`, `Services`, `MyOrders`, `Account` و`AiChat`).

الملف المستلم باسم `ClientOrderDetail.jsx` موجود ضمن الصفحات؛ وهو صفحة تفاصيل طلب العميل وليس بديلًا عن مجلد `pages/client/`.

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
