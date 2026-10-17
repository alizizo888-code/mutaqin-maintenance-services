<?php
/**
 * Version: v2.0
 * File: backend/config/db.php
 * Description: جسر الاتصال الآمن بقاعدة بيانات MySQL على استضافة Hostinger
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// إعدادات قاعدة البيانات (عدّل القيم ببيانات قاعدة بياناتك في Hostinger)
define('DB_HOST', 'localhost');
define('DB_NAME', 'u123456789_mutqen_db');
define('DB_USER', 'u123456789_mutqen_user');
define('DB_PASS', 'YOUR_STRONG_DB_PASSWORD');

function getDatabaseConnection(): PDO {
    static $pdo = null;

    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];

        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode([
                'status'  => 'error',
                'version' => 'v2.0',
                'message' => 'فشل الاتصال بقاعدة البيانات: ' . $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }

    return $pdo;
}