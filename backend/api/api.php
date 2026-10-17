<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') { http_response_code(204); exit; }
require_once __DIR__ . '/../helpers/portal.php';
require_once __DIR__ . '/../config/db.php';
mutqan_start_session();

$system = (string)($_GET['system'] ?? '');
$allowed = ['system_1_clients','system_2_technicians','system_3_requests','system_4_services','system_5_invoices','image_data_bindings'];
if (!in_array($system, $allowed, true)) mutqan_json(400, ['status'=>'error','message'=>'نظام البيانات المطلوب غير صالح.']);

try {
    $pdo = getDatabaseConnection();
    $method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if ($method === 'GET') {
        // Only catalog browsing is public. Customer, technician, request, invoice and image records are private.
        if ($system === 'system_4_services') {
            $rows = $pdo->query("SELECT id,title,price,icon_path,category_id FROM system_4_services ORDER BY title ASC")->fetchAll();
        } else {
            $user = mutqan_require_user($pdo, ['owner','operations']);
            $rows = $pdo->query("SELECT * FROM {$system} ORDER BY 1 DESC LIMIT 500")->fetchAll();
        }
        mutqan_json(200, ['status'=>'success','version'=>'v3.0','system'=>$system,'count'=>count($rows),'data'=>$rows]);
    }
    if ($method !== 'POST') mutqan_json(405, ['status'=>'error','message'=>'طريقة الطلب غير مسموحة.']);
    mutqan_require_csrf();
    $user = mutqan_require_user($pdo, ['owner']);
    if ($system !== 'system_4_services') {
        mutqan_json(410, ['status'=>'error','message'=>'الإدراج المباشر في جداول العملاء والطلبات والفنيين والفواتير مغلق. استخدم واجهات النظام المحمية المناسبة.']);
    }
    $in = mutqan_input();
    $title = trim((string)($in['title'] ?? ''));
    if ($title === '' || mb_strlen($title) > 120) mutqan_json(422, ['status'=>'error','message'=>'اسم الخدمة غير صالح.']);
    $price = isset($in['price']) && is_numeric($in['price']) ? (float)$in['price'] : 0;
    $categoryId = max(1, (int)($in['category_id'] ?? 1));
    $icon = trim((string)($in['icon_path'] ?? '/uploads/services/pending_icon.jpg'));
    if (str_starts_with(strtolower($icon), 'http') || str_contains($icon, '..')) mutqan_json(422, ['status'=>'error','message'=>'مسار أيقونة الخدمة يجب أن يكون محلياً.']);
    $stmt = $pdo->prepare("INSERT INTO system_4_services (title,price,icon_path,category_id) VALUES (:title,:price,:icon,:category)");
    $stmt->execute([':title'=>$title,':price'=>max(0,$price),':icon'=>$icon,':category'=>$categoryId]);
    $id = (int)$pdo->lastInsertId();
    mutqan_audit($pdo, (int)$user['id'], 'create_service', 'service', $id, ['title'=>$title]);
    mutqan_json(201, ['status'=>'success','inserted_id'=>$id]);
} catch (Throwable $e) {
    error_log('[MUTQAN legacy API] '.$e->getMessage());
    mutqan_json(503, ['status'=>'error','message'=>'تعذر تنفيذ API. تحقق من إعداد قاعدة البيانات وتطبيق migration.']);
}
