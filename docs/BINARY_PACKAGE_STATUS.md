# حالة الحزمة الثنائية — مُتقِن

## الحالة المؤكدة
- الملف الثنائي `mutqan-php-clean-package.zip` موجود في جذر مستودع GitHub.
- تم إنشاؤه عبر سير عمل GitHub Actions من الملفات المتتبعة في `main`.
- اجتاز فحص `unzip -t` في خطوة البناء، وانتهت عملية الـ workflow بنجاح.
- رابط التنزيل المباشر: https://github.com/alizizo888-code/mutaqin-maintenance-services/raw/refs/heads/main/mutqan-php-clean-package.zip

## قيد يجب عدم إخفائه
هذا الأرشيف ZIP أُعيد بناؤه داخل GitHub من شجرة المصدر الحالية. لا يمكن اعتباره مطابقًا بايت-ببايت لملف ZIP المحلي الذي أُرفق بالمحادثة. النسخة المحلية تضم أيضًا الملف الثنائي الداخلي `reference/mutaqin-react-export-original.zip` الذي لم يُرفع كملف مستقل إلى المستودع حتى الآن.

## آلية البناء
يوجد سير العمل في `.github/workflows/build-package.yml`، ويعيد إنشاء ملف ZIP بعد التغييرات على `main`، ثم يضيف الملف الثنائي إلى المستودع في commit منفصل.
