<?php
declare(strict_types=1);
require_once __DIR__ . '/../helpers/portal.php';
require_once __DIR__ . '/../config/db.php';

mutqan_start_session();
header('Content-Type: application/json; charset=utf-8');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') { http_response_code(204); exit; }

try {
    $pdo = getDatabaseConnection();
    $method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if ($method === 'GET') {
        mutqan_require_user($pdo, ['owner','operations']);
        $stmt = $pdo->query("SELECT i.*, b.hash_sha256, b.local_path AS signature_path FROM system_5_invoices i LEFT JOIN image_data_bindings b ON b.owner_type='invoice' AND b.owner_id=i.id ORDER BY i.id DESC LIMIT 100");
        mutqan_json(200, ['status'=>'success','data'=>$stmt->fetchAll()]);
    }
    if ($method !== 'POST') mutqan_json(405, ['status'=>'error','message'=>'طريقة الطلب غير مسموحة.']);
    mutqan_require_csrf();
    $user = mutqan_require_user($pdo, ['owner','operations']);
    $payload = mutqan_input();
    $requestId = filter_var($payload['request_id'] ?? null, FILTER_VALIDATE_INT);
    $amount = filter_var($payload['amount'] ?? null, FILTER_VALIDATE_FLOAT);
    $pdfPath = trim((string)($payload['pdf_path'] ?? ''));
    $signaturePath = trim((string)($payload['signature_img'] ?? ''));
    if (!$requestId || $requestId < 1 || $amount === false || $amount < 0) mutqan_json(422, ['status'=>'error','message'=>'رقم الطلب أو المبلغ غير صالح.']);
    foreach ([$pdfPath,$signaturePath] as $path) {
        if ($path === '' || preg_match('/^https?:/i',$path) || str_contains($path,'..')) {
            mutqan_json(422, ['status'=>'error','message'=>'يجب تحديد مسارات ملفات محلية صحيحة للفواتير والتوقيعات.']);
        }
    }
    $req = $pdo->prepare("SELECT id FROM system_3_requests WHERE id=:id LIMIT 1");
    $req->execute([':id'=>$requestId]);
    if (!$req->fetchColumn()) mutqan_json(404,['status'=>'error','message'=>'طلب الصيانة غير موجود.']);
    $pdo->beginTransaction();
    $stmt = $pdo->prepare("INSERT INTO system_5_invoices (request_id,amount,pdf_path,signature_img) VALUES (:request_id,:amount,:pdf_path,:signature_img)");
    $stmt->execute([':request_id'=>$requestId,':amount'=>$amount,':pdf_path'=>$pdfPath,':signature_img'=>$signaturePath]);
    $id = (int)$pdo->lastInsertId();
    mutqan_audit($pdo,(int)$user['id'],'create_invoice','invoice',$id,['request_id'=>$requestId,'amount'=>$amount]);
    $pdo->commit();
    mutqan_json(201, ['status'=>'success','invoice_id'=>$id]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) $pdo->rollBack();
    error_log('[MUTQAN invoice API] '.$e->getMessage());
    mutqan_json(503, ['status'=>'error','message'=>'تعذر تنفيذ عملية الفاتورة. تحقق من صلاحيات الحساب وإعداد قاعدة البيانات.']);
}
