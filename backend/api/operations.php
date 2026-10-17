<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') { http_response_code(204); exit; }
require_once __DIR__ . '/../config/db.php';
try { $pdo = getDatabaseConnection(); }
catch (Throwable $e) { http_response_code(503); echo json_encode(['status'=>'error','message'=>'Database unavailable. Check backend/config/config.local.php.'], JSON_UNESCAPED_UNICODE); exit; }

$action = $_GET['action'] ?? 'dashboard';

// 1. إسناد طلب صيانة آلياً إلى فني معتمد (src/assignment.js)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'assign') {
    $input = json_decode(file_get_contents('php://input'), true);
    $requestId = (int)($input['request_id'] ?? 0);
    $techId    = (int)($input['tech_id'] ?? 0);

    if ($requestId <= 0) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'رقم الطلب غير صالح.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // إذا لم يُحدد الفني يدوياً، نختار الأعلى تقييماً تلقائياً من system_2_technicians
    if ($techId <= 0) {
        $stmtBest = $pdo->query("SELECT id, name, rating FROM system_2_technicians ORDER BY rating DESC LIMIT 1");
        $bestTech = $stmtBest->fetch();
        if (!$bestTech) {
            echo json_encode(['status' => 'error', 'message' => 'لا يوجد فنيون مسجلون حالياً.'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $techId = (int)$bestTech['id'];
    }

    $stmtUpdate = $pdo->prepare("UPDATE system_3_requests SET tech_id = :tech_id WHERE id = :req_id");
    $stmtUpdate->execute([
        ':tech_id' => $techId,
        ':req_id'  => $requestId
    ]);

    echo json_encode([
        'status' => 'success',
        'message' => 'تم إسناد الطلب للفني بنجاح',
        'request_id' => $requestId,
        'assigned_tech_id' => $techId
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 2. توثيق صور قبل وبعد الصيانة (before_img / after_img) مع بصمة SHA-256
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'bind_request_images') {
    $input = json_decode(file_get_contents('php://input'), true);
    $requestId = (int)($input['request_id'] ?? 0);
    $beforePath = $input['before_img'] ?? '';
    $afterPath  = $input['after_img'] ?? '';
    $beforeHash = $input['before_sha256'] ?? '';
    $afterHash  = $input['after_sha256'] ?? '';

    // منع صارم لأي روابط خارجية
    if (strpos($beforePath, 'http') === 0 || strpos($afterPath, 'http') === 0) {
        http_response_code(422);
        echo json_encode(['status' => 'error', 'message' => 'ممنوع استخدام روابط خارجية للصور. المسارات المحلية فقط مسموحة.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    try {
        $pdo->beginTransaction();

        $stmtReq = $pdo->prepare("
            UPDATE system_3_requests
            SET before_img = :before_img, after_img = :after_img
            WHERE id = :id
        ");
        $stmtReq->execute([
            ':before_img' => $beforePath,
            ':after_img'  => $afterPath,
            ':id'         => $requestId
        ]);

        $stmtBind = $pdo->prepare("
            INSERT INTO image_data_bindings (image_id, owner_type, owner_id, local_path, hash_sha256, uploaded_at, uploaded_by, no_external_source)
            VALUES (:image_id, 'request', :owner_id, :local_path, :hash_sha256, NOW(), :uploaded_by, 1)
            ON DUPLICATE KEY UPDATE local_path = VALUES(local_path), hash_sha256 = VALUES(hash_sha256), uploaded_at = NOW()
        ");

        if ($beforePath && $beforeHash) {
            $stmtBind->execute([
                ':image_id'    => "IMG_REQ_{$requestId}_BEFORE",
                ':owner_id'    => $requestId,
                ':local_path'  => $beforePath,
                ':hash_sha256' => $beforeHash,
                ':uploaded_by' => 'tech_201'
            ]);
        }

        if ($afterPath && $afterHash) {
            $stmtBind->execute([
                ':image_id'    => "IMG_REQ_{$requestId}_AFTER",
                ':owner_id'    => $requestId,
                ':local_path'  => $afterPath,
                ':hash_sha256' => $afterHash,
                ':uploaded_by' => 'tech_201'
            ]);
        }

        $pdo->commit();
        echo json_encode(['status' => 'success', 'request_id' => $requestId], JSON_UNESCAPED_UNICODE);
    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

// 3. جلب بيانات غرفة العمليات (الفنيون + الطلبات + البصمات)
$techs = $pdo->query("SELECT * FROM system_2_technicians ORDER BY rating DESC")->fetchAll();
$requests = $pdo->query("
    SELECT r.*, t.name AS tech_name, t.rating AS tech_rating
    FROM system_3_requests r
    LEFT JOIN system_2_technicians t ON r.tech_id = t.id
    ORDER BY r.id DESC
")->fetchAll();

echo json_encode([
    'status' => 'success',
    'version' => 'v3.0',
    'system_2_technicians' => $techs,
    'system_3_requests' => $requests
], JSON_UNESCAPED_UNICODE);