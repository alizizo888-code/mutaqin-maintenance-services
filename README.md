# مُتقن MUTQAN — منصة الصيانة

المستودع يضم أساس PHP + MySQL، وواجهات HTML التجريبية، ونسخة جزئية من تصدير React/Vite.

## حالة مصدر React/Vite

تم رفع ملفات المصدر إلى المسارات الصحيحة:
- 16 ملفًا في المستوى الرئيسي `react-export/src/`
- 20 صفحة تشغيلية في `src/pages/`، و11 صفحة عميل في `src/pages/client/`
- 21 مكوّنًا في `src/components/`
- 11 hook في `src/hooks/`
- 49 ملفًا في `src/lib/`

تم تصحيح مساري الإشعارات `/notifications` و`/staff/notify-settings`. بناء Vite واختبار Chromium الآلي أصبحا ضمن GitHub Actions.

**حدود الوضع الحالي:** ملفات الخدمات الخاصة بـ Whacka ليست متاحة خارج المنصة الأصلية؛ لذلك استُبدلت بعض الواجهات الأساسية بمحوّلات تجريبية محلية لتجنب تعطل الواجهة. تُحفظ بيانات المعاينة في متصفح واحد فقط ولا تصل إلى فريق العمليات. المصادقة الخادمية والأدوار المشتركة والذكاء الاصطناعي والإشعارات الفعلية والدفع ورفع الملفات لا تزال بحاجة إلى Backend موثوق. لا تستخدم وضع المعاينة لبيانات العملاء الحقيقية أو تنفيذ طلبات إنتاجية.

## تنزيل الحزمة الثنائية
- [تنزيل mutqan-php-clean-package.zip](https://github.com/alizizo888-code/mutaqin-maintenance-services/raw/refs/heads/main/mutqan-php-clean-package.zip)
- [سجل بناء الحزمة](https://github.com/alizizo888-code/mutaqin-maintenance-services/actions/workflows/build-package.yml)

ZIP الحالي يُبنى تلقائيًا من شجرة المستودع؛ بعد كل رفع إلى `main` يعاد بناؤه والتحقق منه.

## تشغيل نسخة PHP
1. استورد `database/schema.sql` في قاعدة MySQL جديدة.
2. انسخ `backend/config/config.local.php.example` إلى `backend/config/config.local.php`.
3. أدخل بيانات MySQL من Hostinger محليًا، ولا ترفع الأسرار إلى GitHub.
4. اختبر الموقع بعد إعداد الاتصال.


## حالة تشغيل React المستقل — مهم
- تمت إضافة بناء إنتاج تلقائي عبر GitHub Actions واختُبر نجاح `npm run build`.
- ملفات Whacka الأساسية التي كانت ترمي أخطاء استُبدلت بواجهات توافق تجريبية للسماح بتحميل واجهة React واختبارها.
- الوضع الحالي **محلي تجريبي فقط**: بيانات React تُحفظ في `localStorage` لكل متصفح، ولا تتزامن بين العملاء والفنيين، ولا يوجد تسجيل دخول خادمي أو دفع أو إشعارات Push أو AI متصل.
- لا تستخدم وضع المعاينة لتشغيل صيانة حقيقية أو تخزين بيانات عملاء إنتاجية. يلزم ربط خدمة خلفية موثوقة وصلاحيات خادمية قبل الإطلاق.


## PHP customer-first portal update (2026-10-17)

The root index.php is now the Arabic, RTL customer entry point. Visitors browse the service catalog, select a category and sub-service, then continue as a guest, register as a customer, or apply as a service provider. The role portals are server-session based:
- client: own requests and request conversations.
- technician: assigned tasks only, task status progression, and opt-in GPS location updates.
- operations: request queue, manual technician selection/assignment, review of completion, and request conversations.
- owner: all operational requests, pending provider decisions, staff overview data, and in-app notifications.

Run database/migrations/20261017_role_based_portals.sql once after the base schema. It seeds ali, ali1, ali2, and ali3 as temporary test accounts and forces a password change on first login. Back up your database first and change those passwords before production. Do not commit config.local.php or production secrets. WhatsApp routing requires setting WHATSAPP_BUSINESS_NUMBER in that local config. GPS needs HTTPS; otherwise provide the address manually. Notifications are in-app only; there is no external SMS/OTP or push provider configured yet.
