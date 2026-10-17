<?php
declare(strict_types=1);

/** Shared session, authorization, CSRF and audit helpers for MUTQAN's Hostinger PHP APIs. */
function mutqan_start_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    session_name('mutqan_session');
    $secure = (!empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function mutqan_json(int $status, array $body): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, private');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function mutqan_input(): array {
    $raw = file_get_contents('php://input');
    $parsed = json_decode($raw ?: '', true);
    return is_array($parsed) ? $parsed : $_POST;
}

function mutqan_csrf_token(): string {
    if (empty($_SESSION['mutqan_csrf'])) $_SESSION['mutqan_csrf'] = bin2hex(random_bytes(32));
    return (string)$_SESSION['mutqan_csrf'];
}

function mutqan_require_csrf(): void {
    $provided = (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    $expected = (string)($_SESSION['mutqan_csrf'] ?? '');
    if ($expected === '' || $provided === '' || !hash_equals($expected, $provided)) {
        mutqan_json(419, ['status' => 'error', 'message' => 'انتهت جلسة الحماية. حدّث الصفحة ثم حاول مرة أخرى.']);
    }
}

function mutqan_current_user(PDO $pdo): ?array {
    $id = (int)($_SESSION['mutqan_user_id'] ?? 0);
    if ($id <= 0) return null;
    $stmt = $pdo->prepare("SELECT id, username, full_name, phone, role, status, must_change_password, specialty, experience_years, service_area, address, latitude, longitude FROM app_users WHERE id = :id LIMIT 1");
    $stmt->execute([':id' => $id]);
    $user = $stmt->fetch();
    if (!$user || $user['status'] !== 'active') {
        unset($_SESSION['mutqan_user_id']);
        return null;
    }
    $user['id'] = (int)$user['id'];
    $user['must_change_password'] = (bool)$user['must_change_password'];
    return $user;
}

function mutqan_require_user(PDO $pdo, array $roles = []): array {
    $user = mutqan_current_user($pdo);
    if (!$user) mutqan_json(401, ['status' => 'error', 'message' => 'سجّل الدخول أولاً للمتابعة.']);
    if (!empty($user['must_change_password'])) mutqan_json(428, ['status' => 'error', 'message' => 'يجب تغيير كلمة المرور المؤقتة أولاً.', 'must_change_password' => true]);
    if ($roles && !in_array($user['role'], $roles, true)) {
        mutqan_json(403, ['status' => 'error', 'message' => 'ليس لديك صلاحية لتنفيذ هذا الإجراء.']);
    }
    return $user;
}

function mutqan_audit(PDO $pdo, ?int $actorId, string $action, string $entityType, ?int $entityId = null, array $details = []): void {
    $stmt = $pdo->prepare("INSERT INTO app_audit_log (actor_user_id, action, entity_type, entity_id, details_json) VALUES (:actor, :action, :type, :entity, :details)");
    $stmt->execute([
        ':actor' => $actorId,
        ':action' => $action,
        ':type' => $entityType,
        ':entity' => $entityId,
        ':details' => $details ? json_encode($details, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null,
    ]);
}

function mutqan_notify(PDO $pdo, int $userId, string $title, string $message, ?string $entityType = null, ?int $entityId = null): void {
    $stmt = $pdo->prepare("INSERT INTO app_notifications (user_id, title, message, entity_type, entity_id) VALUES (:user_id, :title, :message, :type, :entity_id)");
    $stmt->execute([':user_id' => $userId, ':title' => $title, ':message' => $message, ':type' => $entityType, ':entity_id' => $entityId]);
}

function mutqan_require_method(string $method): void {
    if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== strtoupper($method)) {
        header('Allow: ' . strtoupper($method));
        mutqan_json(405, ['status' => 'error', 'message' => 'طريقة الطلب غير مسموحة.']);
    }
}

function mutqan_phone(string $phone): string {
    $phone = preg_replace('/[^\d+]/u', '', trim($phone)) ?? '';
    return strlen(preg_replace('/\D/', '', $phone) ?? '') >= 8 && strlen(preg_replace('/\D/', '', $phone) ?? '') <= 15 ? $phone : '';
}

function mutqan_public_user(array $user): array {
    unset($user['password_hash']);
    if (isset($user['phone'])) $user['phone'] = (string)$user['phone'];
    return $user;
}
