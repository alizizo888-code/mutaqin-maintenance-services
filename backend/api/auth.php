<?php
declare(strict_types=1);
require_once __DIR__ . '/../helpers/portal.php';
require_once __DIR__ . '/../config/db.php';

mutqan_start_session();
$action = (string)($_GET['action'] ?? '');
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if ($method === 'OPTIONS') { http_response_code(204); exit; }

try {
    // The CSRF token is issued on bootstrap and required for every state-changing request.
    if ($method === 'GET' && in_array($action, ['me', 'bootstrap'], true)) {
        $csrf = mutqan_csrf_token();
        $pdo = getDatabaseConnection();
        $user = mutqan_current_user($pdo);
        mutqan_json(200, ['status' => 'success', 'user' => $user, 'csrf_token' => $csrf]);
    }

    mutqan_require_method('POST');
    mutqan_require_csrf();
    $input = mutqan_input();

    if ($action === 'login') {
        $username = trim((string)($input['username'] ?? ''));
        $password = (string)($input['password'] ?? '');
        if ($username === '' || $password === '') mutqan_json(422, ['status' => 'error', 'message' => 'اكتب اسم المستخدم أو رقم الهاتف وكلمة المرور.']);
        $attempts = (int)($_SESSION['mutqan_login_attempts'] ?? 0);
        $lastAttempt = (int)($_SESSION['mutqan_login_last_attempt'] ?? 0);
        if ($attempts >= 8 && time() - $lastAttempt < 900) mutqan_json(429, ['status' => 'error', 'message' => 'محاولات الدخول كثيرة. انتظر 15 دقيقة ثم حاول مرة أخرى.']);

        $pdo = getDatabaseConnection();
        $stmt = $pdo->prepare("SELECT * FROM app_users WHERE username = :username OR phone = :phone LIMIT 1");
        $stmt->execute([':username' => $username, ':phone' => mutqan_phone($username) ?: $username]);
        $row = $stmt->fetch();
        if (!$row || !password_verify($password, (string)$row['password_hash'])) {
            $_SESSION['mutqan_login_attempts'] = $attempts + 1;
            $_SESSION['mutqan_login_last_attempt'] = time();
            mutqan_json(401, ['status' => 'error', 'message' => 'بيانات الدخول غير صحيحة.']);
        }
        if ($row['status'] === 'pending') mutqan_json(403, ['status' => 'error', 'pending' => true, 'message' => 'طلب الانضمام ما زال قيد مراجعة المالك. ستصلك الموافقة بعد مراجعة بياناتك.']);
        if ($row['status'] === 'rejected') mutqan_json(403, ['status' => 'error', 'message' => 'لم تتم الموافقة على طلب الانضمام. تواصل مع الإدارة للمراجعة.']);
        if ($row['status'] !== 'active') mutqan_json(403, ['status' => 'error', 'message' => 'الحساب غير مفعّل. تواصل مع الإدارة.']);

        session_regenerate_id(true);
        $_SESSION['mutqan_user_id'] = (int)$row['id'];
        $_SESSION['mutqan_login_attempts'] = 0;
        $_SESSION['mutqan_login_last_attempt'] = time();
        $_SESSION['mutqan_csrf'] = bin2hex(random_bytes(32));
        $user = mutqan_current_user($pdo);
        mutqan_audit($pdo, (int)$row['id'], 'login', 'user', (int)$row['id']);
        mutqan_json(200, ['status' => 'success', 'user' => $user, 'csrf_token' => mutqan_csrf_token()]);
    }

    if ($action === 'register') {
        $role = (string)($input['role'] ?? 'client');
        if (!in_array($role, ['client', 'provider'], true)) mutqan_json(403, ['status' => 'error', 'message' => 'التسجيل العام متاح للعملاء ومزودي الخدمة فقط.']);
        $name = trim((string)($input['full_name'] ?? ''));
        $phone = mutqan_phone((string)($input['phone'] ?? ''));
        $password = (string)($input['password'] ?? '');
        $address = trim((string)($input['address'] ?? ''));
        if (mb_strlen($name) < 2 || mb_strlen($name) > 120) mutqan_json(422, ['status' => 'error', 'message' => 'اكتب الاسم بشكل صحيح.']);
        if ($phone === '') mutqan_json(422, ['status' => 'error', 'message' => 'رقم الهاتف غير صالح.']);
        if (strlen($password) < 8) mutqan_json(422, ['status' => 'error', 'message' => 'كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف أو أرقام.']);
        if (mb_strlen($address) > 255) mutqan_json(422, ['status' => 'error', 'message' => 'العنوان أطول من المسموح.']);

        $specialty = trim((string)($input['specialty'] ?? ''));
        $experience = max(0, min(80, (int)($input['experience_years'] ?? 0)));
        $area = trim((string)($input['service_area'] ?? ''));
        if ($role === 'provider' && ($specialty === '' || mb_strlen($specialty) > 160)) mutqan_json(422, ['status' => 'error', 'message' => 'حدد تخصص الخدمة التي تقدمها.']);
        $lat = isset($input['latitude']) && is_numeric($input['latitude']) ? (float)$input['latitude'] : null;
        $lng = isset($input['longitude']) && is_numeric($input['longitude']) ? (float)$input['longitude'] : null;
        if ($lat !== null && ($lat < -90 || $lat > 90)) $lat = null;
        if ($lng !== null && ($lng < -180 || $lng > 180)) $lng = null;

        $pdo = getDatabaseConnection();
        $exists = $pdo->prepare("SELECT id FROM app_users WHERE phone = :phone OR username = :username LIMIT 1");
        $exists->execute([':phone' => $phone, ':username' => $phone]);
        if ($exists->fetch()) mutqan_json(409, ['status' => 'error', 'message' => 'رقم الهاتف مسجل بالفعل. جرّب تسجيل الدخول بدلاً من إنشاء حساب جديد.']);

        $status = $role === 'provider' ? 'pending' : 'active';
        $stmt = $pdo->prepare("INSERT INTO app_users (username, full_name, phone, password_hash, role, status, must_change_password, specialty, experience_years, service_area, address, latitude, longitude) VALUES (:username, :name, :phone, :hash, :role, :status, 0, :specialty, :experience, :area, :address, :lat, :lng)");
        $stmt->execute([
            ':username' => $phone, ':name' => $name, ':phone' => $phone,
            ':hash' => password_hash($password, PASSWORD_DEFAULT), ':role' => $role,
            ':status' => $status, ':specialty' => $role === 'provider' ? $specialty : null,
            ':experience' => $role === 'provider' ? $experience : null,
            ':area' => $role === 'provider' ? $area : null, ':address' => $address ?: null,
            ':lat' => $lat, ':lng' => $lng,
        ]);
        $newId = (int)$pdo->lastInsertId();
        mutqan_audit($pdo, null, 'register_' . $role, 'user', $newId, ['phone_suffix' => substr(preg_replace('/\D/', '', $phone) ?: '', -4)]);
        if ($role === 'provider') {
            $owners = $pdo->query("SELECT id FROM app_users WHERE role = 'owner' AND status = 'active'")->fetchAll();
            foreach ($owners as $owner) {
                mutqan_notify($pdo, (int)$owner['id'], 'طلب مزود خدمة جديد', $name . ' تقدم للانضمام كتخصص ' . $specialty . '. الموافقة اليدوية مطلوبة قبل توزيع أي مهمة.', 'provider', $newId);
            }
            mutqan_json(201, ['status' => 'success', 'pending' => true, 'message' => 'تم استلام طلبك. سيظهر للمالك للمراجعة، ولن يتم إسناد أي مهام لك قبل الاعتماد.']);
        }

        session_regenerate_id(true);
        $_SESSION['mutqan_user_id'] = $newId;
        $_SESSION['mutqan_csrf'] = bin2hex(random_bytes(32));
        $user = mutqan_current_user($pdo);
        mutqan_json(201, ['status' => 'success', 'user' => $user, 'csrf_token' => mutqan_csrf_token()]);
    }

    if ($action === 'change_password') {
        $pdo = getDatabaseConnection();
        $user = mutqan_current_user($pdo);
        if (!$user) mutqan_json(401, ['status' => 'error', 'message' => 'سجّل الدخول أولاً لتغيير كلمة المرور.']);
        $current = (string)($input['current_password'] ?? '');
        $password = (string)($input['new_password'] ?? '');
        $confirm = (string)($input['confirm_password'] ?? '');
        $stmt = $pdo->prepare("SELECT password_hash FROM app_users WHERE id = :id");
        $stmt->execute([':id' => $user['id']]);
        $stored = (string)$stmt->fetchColumn();
        if (!password_verify($current, $stored)) mutqan_json(422, ['status' => 'error', 'message' => 'كلمة المرور الحالية غير صحيحة.']);
        if (strlen($password) < 12) mutqan_json(422, ['status' => 'error', 'message' => 'استخدم كلمة مرور قوية من 12 حرفًا أو رقمًا على الأقل.']);
        if ($password !== $confirm) mutqan_json(422, ['status' => 'error', 'message' => 'تأكيد كلمة المرور غير متطابق.']);
        $update = $pdo->prepare("UPDATE app_users SET password_hash = :hash, must_change_password = 0 WHERE id = :id");
        $update->execute([':hash' => password_hash($password, PASSWORD_DEFAULT), ':id' => $user['id']]);
        mutqan_audit($pdo, (int)$user['id'], 'change_password', 'user', (int)$user['id']);
        $fresh = mutqan_current_user($pdo);
        $_SESSION['mutqan_csrf'] = bin2hex(random_bytes(32));
        mutqan_json(200, ['status' => 'success', 'user' => $fresh, 'csrf_token' => mutqan_csrf_token(), 'message' => 'تم تحديث كلمة المرور.']);
    }

    if ($action === 'logout') {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], '', (bool)$params['secure'], (bool)$params['httponly']);
        }
        session_destroy();
        mutqan_start_session();
        $_SESSION['mutqan_csrf'] = bin2hex(random_bytes(32));
        mutqan_json(200, ['status' => 'success', 'csrf_token' => mutqan_csrf_token()]);
    }

    mutqan_json(404, ['status' => 'error', 'message' => 'العملية المطلوبة غير معروفة.']);
} catch (Throwable $e) {
    error_log('[MUTQAN auth] ' . $e->getMessage());
    mutqan_json(503, ['status' => 'error', 'csrf_token' => mutqan_csrf_token(), 'user' => null, 'message' => 'تعذر إكمال العملية. تأكد من تثبيت قاعدة البيانات وتطبيق ملف migration الخاص بالصلاحيات.']);
}
