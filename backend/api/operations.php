<?php
declare(strict_types=1);
require_once __DIR__ . '/../helpers/portal.php';
require_once __DIR__ . '/../config/db.php';
mutqan_start_session();
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') { http_response_code(204); exit; }
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$action = (string)($_GET['action'] ?? 'dashboard');

try {
    $pdo = getDatabaseConnection();
    if ($method === 'GET' && $action === 'dashboard') {
        $user = mutqan_require_user($pdo, ['owner','operations']);
        $techs = $pdo->query("SELECT t.id AS technician_id,t.user_id,t.name,t.specialty,t.rating,t.status,t.latitude,t.longitude,u.full_name,u.phone FROM system_2_technicians t JOIN app_users u ON u.id=t.user_id WHERE u.role='technician' AND u.status='active' ORDER BY t.status,t.name")->fetchAll();
        $requests = $pdo->query("SELECT r.*,COALESCE(r.requester_name,c.name) AS customer_name,COALESCE(r.requester_phone,c.phone) AS customer_phone,COALESCE(r.service_address,c.address) AS customer_address,au.full_name AS assigned_technician_name FROM system_3_requests r LEFT JOIN system_1_clients c ON c.id=r.client_id LEFT JOIN app_users au ON au.id=r.assigned_user_id ORDER BY r.id DESC LIMIT 200")->fetchAll();
        mutqan_json(200,['status'=>'success','version'=>'v4.0','system_2_technicians'=>$techs,'system_3_requests'=>$requests]);
    }
    if ($method !== 'POST') mutqan_json(405,['status'=>'error','message'=>'طريقة الطلب غير مسموحة.']);
    mutqan_require_csrf();
    $in = mutqan_input();

    if ($action === 'assign') {
        $user = mutqan_require_user($pdo, ['owner','operations']);
        $requestId = (int)($in['request_id'] ?? 0);
        $techId = (int)($in['tech_id'] ?? 0);
        if ($requestId <= 0 || $techId <= 0) mutqan_json(422,['status'=>'error','message'=>'يجب اختيار فني معتمد صراحةً؛ الإسناد التلقائي غير مسموح.']);
        $req = $pdo->prepare("SELECT id,status FROM system_3_requests WHERE id=:id LIMIT 1");
        $req->execute([':id'=>$requestId]); $request = $req->fetch();
        if (!$request) mutqan_json(404,['status'=>'error','message'=>'الطلب غير موجود.']);
        if (in_array($request['status'],['completed','cancelled'],true)) mutqan_json(409,['status'=>'error','message'=>'لا يمكن إسناد طلب مغلق.']);
        $techStmt = $pdo->prepare("SELECT t.id,t.user_id,u.full_name FROM system_2_technicians t JOIN app_users u ON u.id=t.user_id WHERE t.id=:id AND t.status IN ('available','busy') AND u.role='technician' AND u.status='active' LIMIT 1");
        $techStmt->execute([':id'=>$techId]); $tech = $techStmt->fetch();
        if (!$tech) mutqan_json(422,['status'=>'error','message'=>'الفني غير معتمد أو غير متاح.']);
        $pdo->prepare("UPDATE system_3_requests SET tech_id=:tid,assigned_user_id=:uid,status='assigned',updated_at=NOW() WHERE id=:rid")->execute([':tid'=>$tech['id'],':uid'=>$tech['user_id'],':rid'=>$requestId]);
        $pdo->prepare("UPDATE system_2_technicians SET status='busy',updated_at=NOW() WHERE id=:tid")->execute([':tid'=>$tech['id']]);
        mutqan_notify($pdo,(int)$tech['user_id'],'مهمة جديدة #'.$requestId,'تم إسناد طلب صيانة إليك يدوياً من مشرف العمليات.','request',$requestId);
        mutqan_audit($pdo,(int)$user['id'],'assign_request','request',$requestId,['technician_user_id'=>(int)$tech['user_id']]);
        mutqan_json(200,['status'=>'success','message'=>'تم إسناد الطلب للفني المختار.','assigned_tech_id'=>(int)$tech['id']]);
    }

    if ($action === 'bind_request_images') {
        $user = mutqan_require_user($pdo, ['technician','operations','owner']);
        $requestId = (int)($in['request_id'] ?? 0);
        $beforePath = trim((string)($in['before_img'] ?? ''));
        $afterPath = trim((string)($in['after_img'] ?? ''));
        $beforeHash = strtolower(trim((string)($in['before_sha256'] ?? '')));
        $afterHash = strtolower(trim((string)($in['after_sha256'] ?? '')));
        $stmt = $pdo->prepare("SELECT id,assigned_user_id FROM system_3_requests WHERE id=:id LIMIT 1");
        $stmt->execute([':id'=>$requestId]); $req=$stmt->fetch();
        if (!$req) mutqan_json(404,['status'=>'error','message'=>'الطلب غير موجود.']);
        if ($user['role']==='technician' && (int)$req['assigned_user_id'] !== (int)$user['id']) mutqan_json(403,['status'=>'error','message'=>'لا يمكنك تعديل صور طلب غير مسند إليك.']);
        foreach ([[$beforePath,$beforeHash],[$afterPath,$afterHash]] as [$path,$hash]) {
            if ($path !== '' && (preg_match('/^https?:/i',$path) || str_contains($path,'..') || !preg_match('/^[a-f0-9]{64}$/',$hash))) {
                mutqan_json(422,['status'=>'error','message'=>'مسار الصورة أو بصمة SHA-256 غير صالحين. استخدم معالج الرفع المحلي.']);
            }
        }
        $pdo->beginTransaction();
        $stmt = $pdo->prepare("UPDATE system_3_requests SET before_img=COALESCE(NULLIF(:before_img,''),before_img),after_img=COALESCE(NULLIF(:after_img,''),after_img),updated_at=NOW() WHERE id=:id");
        $stmt->execute([':before_img'=>$beforePath,':after_img'=>$afterPath,':id'=>$requestId]);
        $bind = $pdo->prepare("INSERT INTO image_data_bindings (image_id,owner_type,owner_id,local_path,hash_sha256,uploaded_at,uploaded_by,no_external_source) VALUES (:image_id,'request',:owner_id,:path,:hash,NOW(),:uploaded_by,1) ON DUPLICATE KEY UPDATE local_path=VALUES(local_path),hash_sha256=VALUES(hash_sha256),uploaded_at=NOW(),uploaded_by=VALUES(uploaded_by)");
        if ($beforePath!=='') $bind->execute([':image_id'=>'IMG_REQ_'.$requestId.'_BEFORE',':owner_id'=>$requestId,':path'=>$beforePath,':hash'=>$beforeHash,':uploaded_by'=>(string)$user['username']]);
        if ($afterPath!=='') $bind->execute([':image_id'=>'IMG_REQ_'.$requestId.'_AFTER',':owner_id'=>$requestId,':path'=>$afterPath,':hash'=>$afterHash,':uploaded_by'=>(string)$user['username']]);
        mutqan_audit($pdo,(int)$user['id'],'bind_request_images','request',$requestId);
        $pdo->commit();
        mutqan_json(200,['status'=>'success','request_id'=>$requestId]);
    }

    mutqan_json(404,['status'=>'error','message'=>'العملية المطلوبة غير معروفة.']);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) $pdo->rollBack();
    error_log('[MUTQAN operations] '.$e->getMessage());
    mutqan_json(503,['status'=>'error','message'=>'تعذر تنفيذ العملية. تحقق من قاعدة البيانات وصلاحيات الحساب.']);
}
