<?php
/**
 * Version: v2.0 - Mutqan Backend API for system_5_invoices & SHA-256 Image Binding
 * Compatible with Hostinger PHP + MySQL (phpMyAdmin)
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// إعدادات الاتصال بقاعدة بيانات Hostinger (يتم تعديلها ببيانات لوحة التحكم)
$db_host = 'localhost';
$db_name = 'u123456789_mutqan_db';
$db_user = 'u123456789_mutqan_user';
$db_pass = 'YOUR_DB_PASSWORD';

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (PDOException $e) {
    echo json_encode([
        'status' => 'error',
        'message' => 'فشل الاتصال بقاعدة البيانات المحلي: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput, true);

    if (!$payload || !isset($payload['system_5_invoices_row']) || !isset($payload['image_data_binding'])) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'بيانات الفاتورة أو بصمة الصورة غير مكتملة.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $inv = $payload['system_5_invoices_row'];
    $bind = $payload['image_data_binding'];

    // التحقق الصارم من عدم وجود أي مصدر خارجي للصور
    if (empty($bind['no_external_source']) || strpos($bind['local_path'], 'http') === 0) {
        http_response_code(422);
        echo json_encode(['status' => 'error', 'message' => 'مخالفة صارمة: يمنع استخدام روابط صور خارجية.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    try {
        $pdo->beginTransaction();

        // 1. إدراج الفاتورة في جدول system_5_invoices
        $stmtInv = $pdo->prepare("
            INSERT INTO system_5_invoices (request_id, amount, pdf_path, signature_img)
            VALUES (:request_id, :amount, :pdf_path, :signature_img)
        ");
        $stmtInv->execute([
            ':request_id'    => (int)$inv['request_id'],
            ':amount'        => (float)$inv['amount'],
            ':pdf_path'      => $inv['pdf_path'],
            ':signature_img' => $inv['signature_img']
        ]);
        $newInvoiceId = (int)$pdo->lastInsertId();

        // 2. إدراج سجل ربط الصورة ببصمة SHA-256 في جدول image_data_bindings
        $stmtBind = $pdo->prepare("
            INSERT INTO image_data_bindings (image_id, owner_type, owner_id, local_path, hash_sha256, uploaded_at, uploaded_by, no_external_source)
            VALUES (:image_id, 'invoice', :owner_id, :local_path, :hash_sha256, NOW(), :uploaded_by, 1)
        ");
        $stmtBind->execute([
            ':image_id'    => 'IMG_INV_' . $newInvoiceId,
            ':owner_id'    => $newInvoiceId,
            ':local_path'  => $bind['local_path'],
            ':hash_sha256' => $bind['hash_sha256'],
            ':uploaded_by' => $bind['uploaded_by'] ?? 'client'
        ]);

        $pdo->commit();

        echo json_encode([
            'status' => 'success',
            'invoice_id' => $newInvoiceId,
            'hash_verified' => $bind['hash_sha256'],
            'whatsapp_numbers' => ['0549423050', '0536554731']
        ], JSON_UNESCAPED_UNICODE);

    } catch (Exception $ex) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => $ex->getMessage()], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

// استعلام GET لجلب الفواتير المرتبطة ببصمة SHA-256
$stmt = $pdo->query("
    SELECT i.*, b.image_id, b.hash_sha256, b.uploaded_at
    FROM system_5_invoices i
    LEFT JOIN image_data_bindings b ON b.owner_type = 'invoice' AND b.owner_id = i.id
    ORDER BY i.id DESC
    LIMIT 50
");
echo json_encode(['status' => 'success', 'data' => $stmt->fetchAll()], JSON_UNESCAPED_UNICODE);