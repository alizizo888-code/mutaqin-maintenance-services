# حالة الحزمة الثنائية — مُتقِن

## الحزمة الثنائية
- `mutqan-php-clean-package.zip` موجود في جذر المستودع ويتم بناؤه تلقائيًا عبر GitHub Actions.
- البناء يشغّل `git archive` ويتحقق من سلامة ZIP عبر `unzip -t`.
- [تنزيل ZIP](https://github.com/alizizo888-code/mutaqin-maintenance-services/raw/refs/heads/main/mutqan-php-clean-package.zip)
- [سجل البناء](https://github.com/alizizo888-code/mutaqin-maintenance-services/actions/workflows/build-package.yml)

## مصدر React/Vite

تم رفع:
- 16 ملفًا من المستوى الرئيسي لـ `src/`
- 20 صفحة تشغيلية و11 صفحة عميل
- 21 مكوّنًا و11 hook
- 49 ملفًا في `src/lib/`

بناء Vite واختبار Chromium على الواجهة الإنتاجية مضافان إلى `.github/workflows/build-react-export.yml`. كما تم ربط مساري الإشعارات المفقودين.

**حالة التشغيل:** وضع المعاينة يعمل باستخدام تخزين محلي في المتصفح، ويُظهر تنبيهًا بأن الطلبات لا تصل لفريق العمليات. بيانات العميل لا تتزامن بين الأجهزة. لا يزال إطلاق الإنتاج متوقفًا على Backend موثوق للمصادقة والأدوار والبيانات المشتركة والذكاء الاصطناعي والإشعارات والدفع والملفات.

## قيود المصدر الأصلي
الملف الثنائي ZIP الموجود في المستودع يعاد بناؤه من ملفات المستودع وليس مطابقًا بايتًا ببايت للأرشيف المحلي. README الأصلي من Whacka محفوظ منفصلًا ويذكر أن خدمات المصادقة والبيانات والتخزين والذكاء الاصطناعي والمدفوعات والإشعارات تعتمد على المنصة وليست ضمن التصدير.


## اختبار React وتشغيل المعاينة
- ملف CI: `.github/workflows/build-react-export.yml`.
- نجاح مثبت للبناء الإنتاجي: تثبيت الاعتمادات و`npm run build` وإنشاء artifact باسم `mutqan-react-dist`.
- نسخة المعاينة تستخدم محولًا محليًا في المتصفح، مع شريط ظاهر يوضح أن البيانات لا تصل إلى فريق العمليات.
- مانع الإطلاق: يلزم Backend موثوق لتخزين البيانات المشتركة وتسجيل الدخول والأدوار والإشعارات والذكاء الاصطناعي والدفع والتخزين. نجاح بناء Vite لا يثبت اكتمال هذه الخدمات.


Expanded QA check: the Chromium smoke test now visits all 30 registered customer/staff routes, and validates that the app shell renders without uncaught browser errors. This verifies frontend route mounting only; it does not certify server-backed workflows or production data isolation.
