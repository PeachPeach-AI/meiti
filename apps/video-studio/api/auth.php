<?php
require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json; charset=utf-8');

$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    $input = [];
}

function videoStudioCurrentUserPayload() {
    return [
        'id' => $_SESSION['user_id'] ?? null,
        'username' => $_SESSION['username'] ?? '',
        'is_admin' => !empty($_SESSION['is_admin']),
    ];
}

if ($action === 'me' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    if (empty($_SESSION['user_id'])) {
        jsonResponse(['success' => false, 'message' => '未登录'], 401);
    }
    jsonResponse(['success' => true, 'user' => videoStudioCurrentUserPayload()]);
}

if ($action === 'logout' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();
    jsonResponse(['success' => true, 'message' => '已退出登录']);
}

if ($action === 'login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($input['username'] ?? '');
    $password = $input['password'] ?? '';
    if ($username === '' || $password === '') {
        jsonResponse(['success' => false, 'message' => '请填写完整信息'], 400);
    }

    $stmt = $pdo->prepare('SELECT * FROM users WHERE username = ? OR email = ?');
    $stmt->execute([$username, $username]);
    $user = $stmt->fetch();

    if ($user && password_verify($password, $user['password'])) {
        session_regenerate_id(true);
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['is_admin'] = ($user['role'] ?? 'user') === 'admin';
        jsonResponse(['success' => true, 'message' => '登录成功', 'user' => videoStudioCurrentUserPayload()]);
    }

    jsonResponse(['success' => false, 'message' => '用户名或密码错误'], 401);
}

if ($action === 'register' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($input['username'] ?? '');
    $email = trim($input['email'] ?? '');
    $password = $input['password'] ?? '';

    if (strlen($username) < 3 || strlen($password) < 6) {
        jsonResponse(['success' => false, 'message' => '用户名至少3位，密码至少6位'], 400);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(['success' => false, 'message' => '邮箱格式不正确'], 400);
    }

    $stmt = $pdo->prepare('SELECT id FROM users WHERE username = ? OR email = ?');
    $stmt->execute([$username, $email]);
    if ($stmt->fetch()) {
        jsonResponse(['success' => false, 'message' => '用户名或邮箱已被注册'], 409);
    }

    $hash = password_hash($password, PASSWORD_BCRYPT);
    $stmt = $pdo->prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)');
    $stmt->execute([$username, $email, $hash]);
    $newId = $pdo->lastInsertId();

    $roleStmt = $pdo->prepare('SELECT role FROM users WHERE id = ?');
    $roleStmt->execute([$newId]);
    $newUser = $roleStmt->fetch();

    session_regenerate_id(true);
    $_SESSION['user_id'] = $newId;
    $_SESSION['username'] = $username;
    $_SESSION['is_admin'] = ($newUser['role'] ?? 'user') === 'admin';

    jsonResponse(['success' => true, 'message' => '注册成功', 'user' => videoStudioCurrentUserPayload()]);
}

jsonResponse(['success' => false, 'message' => '无效请求'], 400);
