<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') { http_response_code(204); exit; }
require_once __DIR__ . '/../config/db.php';
function invoiceJson(int $status, array $body): never {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
try {
    $pdo = getDatabaseConnection();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method === 'GET') {
        $stmt = $pdo->query("SELECT i.*, b.hash_sha256, b.local_path AS signature_path FROM system_5_invoices i LEFT JOIN image_data_bindings b ON b.owner_type='invoice' AND b.owner_id=i.id ORDER BY i.id DESC LIMIT 100");
        invoiceJson(200, ['status'=>'success','data'=>$stmt->fetchAll()]);
    }
    if ($method !== 'POST') invoiceJson(405, ['status'=>'error','message'=>'Method not allowed.']);
    $payload = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($payload)) invoiceJson(400, ['status'=>'error','message'=>'Invalid JSON payload.']);
    $requestId = filter_var($payload['request_id'] ?? null, FILTER_VALIDATE_INT);
    $amount = filter_var($payload['amount'] ?? null, FILTER_VALIDATE_FLOAT);
    $pdfPath = trim((string)($payload['pdf_path'] ?? ''));
    $signaturePath = trim((string)($payload['signature_img'] ?? ''));
    if (!$requestId || $requestId < 1 || $amount === false || $amount < 0) invoiceJson(422, ['status'=>'error','message'=>'Valid request_id and non-negative amount are required.']);
    foreach ([$pdfPath,$signaturePath] as $path) {
        if ($path !== '' && (str_starts_with(strtolower($path),'http://') || str_starts_with(strtolower($path),'https://') || str_contains($path,'..'))) {
            invoiceJson(422, ['status'=>'error','message'=>'Use local relative paths only.']);
        }
    }
    $pdo->beginTransaction();
    $stmt = $pdo->prepare('INSERT INTO system_5_invoices (request_id,amount,pdf_path,signature_img) VALUES (:request_id,:amount,:pdf_path,:signature_img)');
    $stmt->execute([':request_id'=>$requestId,':amount'=>$amount,':pdf_path'=>$pdfPath,':signature_img'=>$signaturePath]);
    $id = (int)$pdo->lastInsertId();
    $pdo->commit();
    invoiceJson(201, ['status'=>'success','invoice_id'=>$id]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) $pdo->rollBack();
    error_log('MUTQAN invoice API: '.$e->getMessage());
    invoiceJson(500, ['status'=>'error','message'=>'Invoice operation failed. Check server logs.']);
}
