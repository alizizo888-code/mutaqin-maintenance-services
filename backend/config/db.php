<?php
declare(strict_types=1);

/**
 * Shared PDO connector for Hostinger PHP + MySQL.
 * Copy config.local.php.example to config.local.php and add actual credentials there.
 */
function getDatabaseConnection(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;

    $configFile = __DIR__ . '/config.local.php';
    if (!is_file($configFile)) {
        throw new RuntimeException('Database configuration is missing. Copy config.local.php.example to config.local.php.');
    }
    require $configFile;

    foreach (['DB_HOST','DB_NAME','DB_USER','DB_PASS'] as $required) {
        if (!defined($required) || constant($required) === '' || constant($required) === 'CHANGE_ME') {
            throw new RuntimeException('Database configuration is incomplete.');
        }
    }

    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}
