<?php
/**
 * Version: v2.0
 * File: backend/api/api.php
 * Description: واجهة برمجة التطبيقات المعزولة للأنظمة الخمسة (Modular Systems API)
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';

$pdo    = getDatabaseConnection();
$method = $_SERVER['REQUEST_METHOD'];
$system = $_GET['system'] ?? '';

$allowedSystems = [
    'system_1_clients',
    'system_2_technicians',
    'system_3_requests',
    'system_4_services',
    'system_5_invoices',
    'image_data_bindings'
];

if (!in_array($system, $allowedSystems, true)) {
    http_response_code(400);
    echo json_encode([
        'status'  => 'error',
        'version' => 'v2.0',
        'message' => 'يجب تحديد نظام صالح ومعزول في المعامل (system).'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    // 1. قراءة البيانات (GET) مع إرفاق بيانات بصمة الصورة الخاصة بكل سجل
    if ($method === 'GET') {
        $stmt = $pdo->query("SELECT * FROM {$system} ORDER BY 1 DESC");
        $records = $stmt->fetchAll();

        echo json_encode([
            'status'  => 'success',
            'version' => 'v2.0',
            'system'  => $system,
            'count'   => count($records),
            'data'    => $records
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // 2. إدراج سجل جديد (POST) لكل نظام على حدة دون خلط الجداول
    if ($method === 'POST') {
        $payload = json_decode(file_get_contents('php://input'), true);
        if (!is_array($payload)) {
            $payload = $_POST;
        }

        switch ($system) {
            case 'system_1_clients':
                $stmt = $pdo->prepare("
                    INSERT INTO system_1_clients (name, phone, address, avatar_image_path)
                    VALUES (:name, :phone, :address, :avatar_image_path)
                ");
                $stmt->execute([
                    ':name'              => trim($payload['name'] ?? ''),
                    ':phone'             => trim($payload['phone'] ?? ''),
                    ':address'           => trim($payload['address'] ?? ''),
                    ':avatar_image_path' => trim($payload['avatar_image_path'] ?? '/uploads/clients/pending.jpg')
                ]);
                break;

            case 'system_2_technicians':
                $stmt = $pdo->prepare("
                    INSERT INTO system_2_technicians (name, specialty, rating, cert_image_path)
                    VALUES (:name, :specialty, :rating, :cert_image_path)
                ");
                $stmt->execute([
                    ':name'            => trim($payload['name'] ?? ''),
                    ':specialty'       => trim($payload['specialty'] ?? ''),
                    ':rating'          => (float)($payload['rating'] ?? 5.00),
                    ':cert_image_path' => trim($payload['cert_image_path'] ?? '/uploads/technicians/pending.jpg')
                ]);
                break;

            case 'system_3_requests':
                $stmt = $pdo->prepare("
                    INSERT INTO system_3_requests (client_id, tech_id, issue, before_img, after_img)
                    VALUES (:client_id, :tech_id, :issue, :before_img, :after_img)
                ");
                $stmt->execute([
                    ':client_id'  => (int)($payload['client_id'] ?? 0),
                    ':tech_id'    => !empty($payload['tech_id']) ? (int)$payload['tech_id'] : null,
                    ':issue'      => trim($payload['issue'] ?? ''),
                    ':before_img' => trim($payload['before_img'] ?? '/uploads/requests/pending_before.jpg'),
                    ':after_img'  => !empty($payload['after_img']) ? trim($payload['after_img']) : null
                ]);
                break;

            case 'system_4_services':
                $stmt = $pdo->prepare("
                    INSERT INTO system_4_services (title, price, icon_path, category_id)
                    VALUES (:title, :price, :icon_path, :category_id)
                ");
                $stmt->execute([
                    ':title'       => trim($payload['title'] ?? ''),
                    ':price'       => (float)($payload['price'] ?? 0.00),
                    ':icon_path'   => trim($payload['icon_path'] ?? '/uploads/services/pending_icon.jpg'),
                    ':category_id' => (int)($payload['category_id'] ?? 1)
                ]);
                break;

            case 'system_5_invoices':
                $stmt = $pdo->prepare("
                    INSERT INTO system_5_invoices (request_id, amount, pdf_path, signature_img)
                    VALUES (:request_id, :amount, :pdf_path, :signature_img)
                ");
                $stmt->execute([
                    ':request_id'    => (int)($payload['request_id'] ?? 0),
                    ':amount'        => (float)($payload['amount'] ?? 0.00),
                    ':pdf_path'      => trim($payload['pdf_path'] ?? '/uploads/invoices/pending.pdf'),
                    ':signature_img' => trim($payload['signature_img'] ?? '/uploads/invoices/pending_sig.jpg')
                ]);
                break;

            default:
                http_response_code(403);
                echo json_encode(['status' => 'error', 'message' => 'الإدراج المباشر غير مسموح لهذا الجدول.'], JSON_UNESCAPED_UNICODE);
                exit;
        }

        $insertedId = (int)$pdo->lastInsertId();

        echo json_encode([
            'status'      => 'success',
            'version'     => 'v2.0',
            'system'      => $system,
            'inserted_id' => $insertedId
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'version' => 'v2.0',
        'message' => 'خطأ في معالجة الطلب: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}