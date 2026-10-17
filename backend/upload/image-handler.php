<?php
/**
 * Version: v2.0
 * File: backend/upload/image-handler.php
 * Description: معالج رفع الصور المحلي الصارم + توليد بصمة SHA-256 + الربط في image_data_bindings
 */

declare(strict_types=1);

require_once __DIR__ . '/../helpers/portal.php';
require_once __DIR__ . '/../config/db.php';
mutqan_start_session();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') { http_response_code(204); exit; }
if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method Not Allowed'], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $pdo = getDatabaseConnection();
    $currentUser = mutqan_require_user($pdo, ['client','technician','operations','owner']);
    mutqan_require_csrf();
} catch (Throwable $e) {
    error_log('[MUTQAN upload auth] ' . $e->getMessage());
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['status'=>'error','message'=>'تعذر التحقق من الحساب أو قاعدة البيانات.'], JSON_UNESCAPED_UNICODE);
    exit;
}

// التحقق من عدم تمرير أي رابط خارجي (قاعدة صارمة: رفع محلي فقط)
if (isset($_POST['external_url']) || isset($_POST['image_url'])) {
    http_response_code(400);
    echo json_encode([
        'status'  => 'error',
        'code'    => 'EXTERNAL_SOURCE_FORBIDDEN',
        'message' => 'ممنوع تماماً استخدام روابط صور خارجية. يُسمح برفع الملفات المحلية فقط.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$allowedOwnerTypes = [
    'client'     => 'clients',
    'technician' => 'technicians',
    'request'    => 'requests',
    'service'    => 'services',
    'invoice'    => 'invoices'
];

$ownerType  = $_POST['owner_type'] ?? '';
$ownerId    = isset($_POST['owner_id']) ? (int)$_POST['owner_id'] : 0;
$uploadedBy = (string)$currentUser['username'];
$fieldRole  = $_POST['field_role'] ?? 'default'; // before_img | after_img | avatar | cert | icon | signature

if (!array_key_exists($ownerType, $allowedOwnerTypes) || $ownerId <= 0) {
    http_response_code(422);
    echo json_encode([
        'status'  => 'error',
        'message' => 'بيانات الربط غير صالحة (owner_type أو owner_id).'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Scope uploads to the authenticated record owner or a manager.
$fieldRole = (string)$fieldRole;
if ($ownerType === 'request') {
    $reqStmt = $pdo->prepare("SELECT id, created_by_user_id, assigned_user_id FROM system_3_requests WHERE id = :id LIMIT 1");
    $reqStmt->execute([':id' => $ownerId]);
    $reqRow = $reqStmt->fetch();
    if (!$reqRow) { http_response_code(404); echo json_encode(['status'=>'error','message'=>'طلب الصيانة غير موجود.'], JSON_UNESCAPED_UNICODE); exit; }
    $isManager = in_array($currentUser['role'], ['owner','operations'], true);
    $isAssignedTech = $currentUser['role'] === 'technician' && (int)$reqRow['assigned_user_id'] === (int)$currentUser['id'];
    $isOwningClient = $currentUser['role'] === 'client' && (int)$reqRow['created_by_user_id'] === (int)$currentUser['id'];
    if (!$isManager && !$isAssignedTech && !$isOwningClient) { http_response_code(403); echo json_encode(['status'=>'error','message'=>'ليس لديك صلاحية رفع صور لهذا الطلب.'], JSON_UNESCAPED_UNICODE); exit; }
    if (!in_array($fieldRole, ['before_img','after_img'], true)) { http_response_code(422); echo json_encode(['status'=>'error','message'=>'نوع صورة الطلب غير صالح.'], JSON_UNESCAPED_UNICODE); exit; }
    if ($currentUser['role'] === 'client' && $fieldRole !== 'before_img') { http_response_code(403); echo json_encode(['status'=>'error','message'=>'يمكن للعميل إرفاق صور قبل الصيانة فقط.'], JSON_UNESCAPED_UNICODE); exit; }
} elseif ($ownerType === 'technician') {
    if ($currentUser['role'] === 'technician') {
        $ownTech = $pdo->prepare("SELECT id FROM system_2_technicians WHERE id=:id AND user_id=:uid LIMIT 1");
        $ownTech->execute([':id'=>$ownerId, ':uid'=>$currentUser['id']]);
        if (!$ownTech->fetchColumn() || $fieldRole !== 'cert') { http_response_code(403); echo json_encode(['status'=>'error','message'=>'يمكنك رفع شهادات حسابك فقط.'], JSON_UNESCAPED_UNICODE); exit; }
    } elseif (!in_array($currentUser['role'], ['owner','operations'], true)) { http_response_code(403); echo json_encode(['status'=>'error','message'=>'ليس لديك صلاحية رفع هذه الصورة.'], JSON_UNESCAPED_UNICODE); exit; }
} elseif (!in_array($currentUser['role'], ['owner','operations'], true)) {
    http_response_code(403); echo json_encode(['status'=>'error','message'=>'رفع هذا النوع من الملفات متاح للإدارة فقط.'], JSON_UNESCAPED_UNICODE); exit;
}

if (!isset($_FILES['image_file']) || $_FILES['image_file']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode([
        'status'  => 'error',
        'message' => 'لم يتم إرفاق ملف صورة صالح للرفع.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
if ((int)($_FILES['image_file']['size'] ?? 0) > 5 * 1024 * 1024) { http_response_code(413); echo json_encode(['status'=>'error','message'=>'أقصى حجم للصورة 5 ميجابايت.'], JSON_UNESCAPED_UNICODE); exit; }

$fileTmpPath  = $_FILES['image_file']['tmp_name'];
$originalName = basename($_FILES['image_file']['name']);
$finfo        = new finfo(FILEINFO_MIME_TYPE);
$mimeType     = $finfo->file($fileTmpPath);

$allowedMimes = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/webp' => 'webp'
];

if (!array_key_exists($mimeType, $allowedMimes)) {
    http_response_code(415);
    echo json_encode([
        'status'  => 'error',
        'message' => 'صيغة الملف غير مدعومة. الصيغ المسموحة: JPG, PNG, WEBP.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// حساب البصمة الرقمية SHA-256 للملف المرفوع
$hashSha256 = hash_file('sha256', $fileTmpPath);

// تجهيز المسار المحلي القياسي: /uploads/<type>/<id>_<name>.jpg
$subFolder    = $allowedOwnerTypes[$ownerType];
$cleanName    = preg_replace('/[^a-zA-Z0-9_\-]/', '_', pathinfo($originalName, PATHINFO_FILENAME));
$cleanName = $cleanName ?: 'img';
$extension    = $allowedMimes[$mimeType];
$finalFileName = $ownerId . '_' . $cleanName . '.' . $extension;

$uploadDir = __DIR__ . '/../../uploads/' . $subFolder . '/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$destinationPath = $uploadDir . $finalFileName;
$relativeLocalPath = '/uploads/' . $subFolder . '/' . $finalFileName;

if (!move_uploaded_file($fileTmpPath, $destinationPath)) {
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'تعذر حفظ الصورة في المسار المحلي على الخادم.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$imageId    = 'IMG_' . strtoupper(substr($hashSha256, 0, 12));
$uploadedAt = date('Y-m-d H:i:s');

try {
    $pdo->beginTransaction();

    // 1. تسجيل وثيقة الربط في جدول image_data_bindings
    $stmtBinding = $pdo->prepare("
        INSERT INTO image_data_bindings (
            image_id, owner_type, owner_id, local_path, hash_sha256, uploaded_at, uploaded_by, no_external_source
        ) VALUES (
            :image_id, :owner_type, :owner_id, :local_path, :hash_sha256, :uploaded_at, :uploaded_by, 1
        )
        ON DUPLICATE KEY UPDATE
            local_path  = VALUES(local_path),
            hash_sha256 = VALUES(hash_sha256),
            uploaded_at = VALUES(uploaded_at)
    ");

    $stmtBinding->execute([
        ':image_id'    => $imageId,
        ':owner_type'  => $ownerType,
        ':owner_id'    => $ownerId,
        ':local_path'  => $relativeLocalPath,
        ':hash_sha256' => $hashSha256,
        ':uploaded_at' => $uploadedAt,
        ':uploaded_by' => $uploadedBy
    ]);

    // 2. تحديث مسار الصورة في جدول النظام المعني بشكل معزول تماماً
    switch ($ownerType) {
        case 'client':
            $stmtUpdate = $pdo->prepare("UPDATE system_1_clients SET avatar_image_path = :path WHERE id = :id");
            break;
        case 'technician':
            $stmtUpdate = $pdo->prepare("UPDATE system_2_technicians SET cert_image_path = :path WHERE id = :id");
            break;
        case 'request':
            $column = ($fieldRole === 'after_img') ? 'after_img' : 'before_img';
            $stmtUpdate = $pdo->prepare("UPDATE system_3_requests SET {$column} = :path WHERE id = :id");
            break;
        case 'service':
            $stmtUpdate = $pdo->prepare("UPDATE system_4_services SET icon_path = :path WHERE id = :id");
            break;
        case 'invoice':
            $stmtUpdate = $pdo->prepare("UPDATE system_5_invoices SET signature_img = :path WHERE id = :id");
            break;
    }

    $stmtUpdate->execute([
        ':path' => $relativeLocalPath,
        ':id'   => $ownerId
    ]);

    $pdo->commit();

    echo json_encode([
        'status'  => 'success',
        'version' => 'v2.0',
        'binding' => [
            'image_id'           => $imageId,
            'owner_type'         => $ownerType,
            'owner_id'           => $ownerId,
            'local_path'         => $relativeLocalPath,
            'hash_sha256'        => $hashSha256,
            'uploaded_at'        => gmdate('c', strtotime($uploadedAt)),
            'uploaded_by'        => $uploadedBy,
            'no_external_source' => true
        ]
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'تعذر ربط الصورة بقاعدة البيانات. راجع سجل الخادم.'
    ], JSON_UNESCAPED_UNICODE);
}