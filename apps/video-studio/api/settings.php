<?php
require_once __DIR__ . '/../../config/db.php';
requireLogin();

header('Content-Type: application/json; charset=utf-8');

$allowedKeys = [
    'video_api_key',
    'video_endpoint',
    'video_model',
    'ai_api_key',
    'ai_endpoint',
    'ai_model',
    'img_api_key',
    'img_endpoint',
    'img_model',
    'oss_access_key',
    'oss_access_secret',
    'oss_bucket',
    'oss_endpoint',
    'oss_region',
    'oss_custom_domain',
];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $placeholders = implode(',', array_fill(0, count($allowedKeys), '?'));
    $stmt = $pdo->prepare("SELECT `key`, `value` FROM site_settings WHERE `key` IN ($placeholders) ORDER BY `key`");
    $stmt->execute($allowedKeys);
    $settings = [];
    foreach ($stmt->fetchAll() as $row) {
        $settings[$row['key']] = $row['value'];
    }
    jsonResponse(['success' => true, 'settings' => $settings]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || !is_array($input)) {
        jsonResponse(['success' => false, 'message' => '数据格式错误'], 400);
    }

    $stmt = $pdo->prepare("INSERT INTO site_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), `updated_at` = NOW()");
    foreach ($input as $key => $value) {
        if (!in_array($key, $allowedKeys, true)) {
            continue;
        }
        $stmt->execute([$key, trim((string)$value)]);
    }

    jsonResponse(['success' => true, 'message' => '配置已保存']);
}

jsonResponse(['success' => false, 'message' => '无效请求'], 400);
