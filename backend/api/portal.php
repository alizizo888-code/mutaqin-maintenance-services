<?php
declare(strict_types=1);
require_once __DIR__ . '/../helpers/portal.php';
require_once __DIR__ . '/../config/db.php';

mutqan_start_session();
$action = (string)($_GET['action'] ?? 'dashboard');
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if ($method === 'OPTIONS') { http_response_code(204); exit; }

function mutqan_catalog(): array {
    return [
        'التكييف والتبريد' => ['صيانة تكييف','غسيل تكييف','تركيب تكييف','فك ونقل تكييف','بيع مكيفات','شراء مكيفات مستعملة','تعبئة فريون','إصلاح تسريب الفريون','صيانة غرف التبريد','صيانة ثلاجات وفريزرات'],
        'السباكة' => ['كشف تسربات المياه','تسليك مجاري ومصارف','تركيب خلاطات وأدوات صحية','صيانة سخانات المياه','تركيب وصيانة مضخات','تمديدات سباكة','صيانة عوامات وخزانات'],
        'الكهرباء والإضاءة' => ['إصلاح أعطال كهربائية','تمديدات كهرباء','صيانة لوحات وقواطع','تركيب إضاءة وكشافات','تركيب نجف وثريات','تركيب مفاتيح ومقابس','صيانة إنارة خارجية'],
        'النجارة والأثاث' => ['إصلاح أبواب وأقفال','تركيب أبواب','إصلاح أثاث','تركيب مطابخ وخزائن','أعمال نجارة حسب الطلب'],
        'المقاولات والترميم' => ['ترميمات عامة','دهانات وديكورات','عزل مائي وحراري','تركيب سيراميك وبلاط','تشطيبات داخلية','أعمال جبس وأسقف'],
        'الخزانات' => ['تنظيف وتعقيم خزانات','عزل خزانات','صيانة خزانات','تركيب خزان ومستلزماته'],
        'نقل العفش' => ['نقل عفش منزلي','فك وتركيب أثاث','تغليف وحماية الأثاث','نقل أجهزة كهربائية','تخزين عفش'],
        'الدش والستالايت' => ['تركيب دش جديد','ضبط إشارة الدش','صيانة رسيفر','تمديد شبكات تلفزيون'],
        'الصيانة العامة' => ['صيانة منزلية متنوعة','تركيب إكسسوارات ومعلقات','إصلاح أبواب ونوافذ','تركيب أقفال ذكية'],
        'التنظيف والخدمات المساندة' => ['تنظيف بعد الصيانة','تنظيف عميق','تنظيف مكيفات مركزي','نقل وتغليف وتخزين'],
    ];
}

function mutqan_request_row(PDO $pdo, int $id): ?array {
    $stmt = $pdo->prepare("SELECT r.*, COALESCE(r.requester_name,c.name) AS customer_name, COALESCE(r.requester_phone,c.phone) AS customer_phone, COALESCE(r.service_address,c.address) AS customer_address, t.name AS technician_name, au.full_name AS assigned_technician_name FROM system_3_requests r LEFT JOIN system_1_clients c ON c.id = r.client_id LEFT JOIN system_2_technicians t ON t.id = r.tech_id LEFT JOIN app_users au ON au.id = r.assigned_user_id WHERE r.id = :id LIMIT 1");
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function mutqan_can_access_request(array $user, array $request, ?string $guestToken): bool {
    if (in_array($user['role'], ['owner','operations'], true)) return true;
    if ($user['role'] === 'technician' && (int)($request['assigned_user_id'] ?? 0) === (int)$user['id']) return true;
    if ($user['role'] === 'client' && (int)($request['created_by_user_id'] ?? 0) === (int)$user['id']) return true;
    $stored = (string)($request['guest_token_hash'] ?? '');
    return $guestToken !== null && $guestToken !== '' && $stored !== '' && hash_equals($stored, hash('sha256', $guestToken));
}

function mutqan_dashboard(PDO $pdo, array $user): array {
    $data = ['user' => $user, 'requests' => [], 'technicians' => [], 'pending_providers' => [], 'notifications' => [], 'stats' => []];
    if ($user['role'] === 'client') {
        $stmt = $pdo->prepare("SELECT r.*, COALESCE(r.requester_name,c.name) AS customer_name, COALESCE(r.requester_phone,c.phone) AS customer_phone, COALESCE(r.service_address,c.address) AS customer_address, au.full_name AS assigned_technician_name FROM system_3_requests r LEFT JOIN system_1_clients c ON c.id=r.client_id LEFT JOIN app_users au ON au.id=r.assigned_user_id WHERE r.created_by_user_id=:uid ORDER BY r.id DESC LIMIT 100");
        $stmt->execute([':uid' => $user['id']]);
        $data['requests'] = $stmt->fetchAll();
    } elseif ($user['role'] === 'technician') {
        $stmt = $pdo->prepare("SELECT r.*, COALESCE(r.requester_name,c.name) AS customer_name, COALESCE(r.requester_phone,c.phone) AS customer_phone, COALESCE(r.service_address,c.address) AS customer_address, au.full_name AS assigned_technician_name FROM system_3_requests r LEFT JOIN system_1_clients c ON c.id=r.client_id LEFT JOIN app_users au ON au.id=r.assigned_user_id WHERE r.assigned_user_id=:uid ORDER BY FIELD(r.status,'assigned','accepted','en_route','in_progress','awaiting_approval','new','completed','cancelled'), r.id DESC LIMIT 100");
        $stmt->execute([':uid' => $user['id']]);
        $data['requests'] = $stmt->fetchAll();
        $loc = $pdo->prepare("SELECT id, status FROM system_2_technicians WHERE user_id=:uid LIMIT 1");
        $loc->execute([':uid' => $user['id']]);
        $data['technician_record'] = $loc->fetch() ?: null;
    } elseif (in_array($user['role'], ['operations','owner'], true)) {
        $data['requests'] = $pdo->query("SELECT r.*, COALESCE(r.requester_name,c.name) AS customer_name, COALESCE(r.requester_phone,c.phone) AS customer_phone, COALESCE(r.service_address,c.address) AS customer_address, t.name AS technician_name, au.full_name AS assigned_technician_name FROM system_3_requests r LEFT JOIN system_1_clients c ON c.id=r.client_id LEFT JOIN system_2_technicians t ON t.id=r.tech_id LEFT JOIN app_users au ON au.id=r.assigned_user_id ORDER BY FIELD(r.status,'new','assigned','accepted','en_route','in_progress','awaiting_approval','completed','cancelled'), r.id DESC LIMIT 200")->fetchAll();
        $data['technicians'] = $pdo->query("SELECT t.id AS technician_id, t.user_id, t.name, t.specialty, t.rating, t.status AS technician_status, t.latitude, t.longitude, u.full_name, u.phone, u.service_area FROM system_2_technicians t INNER JOIN app_users u ON u.id=t.user_id WHERE u.role='technician' AND u.status='active' AND t.status IN ('available','busy') ORDER BY t.status, t.name")->fetchAll();
        $data['stats'] = [
            'new' => (int)$pdo->query("SELECT COUNT(*) FROM system_3_requests WHERE status='new'")->fetchColumn(),
            'active' => (int)$pdo->query("SELECT COUNT(*) FROM system_3_requests WHERE status IN ('assigned','accepted','en_route','in_progress','awaiting_approval')")->fetchColumn(),
            'completed' => (int)$pdo->query("SELECT COUNT(*) FROM system_3_requests WHERE status='completed'")->fetchColumn(),
            'technicians' => (int)$pdo->query("SELECT COUNT(*) FROM app_users WHERE role='technician' AND status='active'")->fetchColumn(),
        ];
        if ($user['role'] === 'owner') {
            $data['pending_providers'] = $pdo->query("SELECT id, full_name, phone, specialty, experience_years, service_area, address, created_at FROM app_users WHERE role='provider' AND status='pending' ORDER BY created_at ASC")->fetchAll();
            $data['staff'] = $pdo->query("SELECT id, username, full_name, role, status, phone FROM app_users WHERE role IN ('technician','operations','owner','provider') ORDER BY FIELD(role,'owner','operations','technician','provider'), full_name")->fetchAll();
        }
    }
    $notices = $pdo->prepare("SELECT id,title,message,entity_type,entity_id,is_read,created_at FROM app_notifications WHERE user_id=:uid ORDER BY id DESC LIMIT 12");
    $notices->execute([':uid' => $user['id']]);
    $data['notifications'] = $notices->fetchAll();
    return $data;
}

try {
    if ($method === 'GET' && $action === 'services') {
        mutqan_json(200, ['status' => 'success', 'catalog' => mutqan_catalog()]);
    }
    if ($method === 'GET' && $action === 'config') {
        $number = defined('WHATSAPP_BUSINESS_NUMBER') ? preg_replace('/\D/', '', (string)WHATSAPP_BUSINESS_NUMBER) : '';
        mutqan_json(200, ['status' => 'success', 'whatsapp_number' => $number ?: null]);
    }

    $pdo = getDatabaseConnection();

    if ($method === 'GET' && $action === 'dashboard') {
        $user = mutqan_require_user($pdo, ['client','technician','operations','owner']);
        mutqan_json(200, ['status' => 'success', 'data' => mutqan_dashboard($pdo, $user)]);
    }

    if ($method === 'GET' && $action === 'messages') {
        $requestId = (int)($_GET['request_id'] ?? 0);
        if ($requestId <= 0) mutqan_json(422, ['status' => 'error', 'message' => 'رقم الطلب غير صالح.']);
        $request = mutqan_request_row($pdo, $requestId);
        if (!$request) mutqan_json(404, ['status' => 'error', 'message' => 'الطلب غير موجود.']);
        $user = mutqan_current_user($pdo);
        $guestToken = isset($_GET['guest_token']) ? (string)$_GET['guest_token'] : null;
        if (!$user && !mutqan_can_access_request([], $request, $guestToken)) mutqan_json(403, ['status' => 'error', 'message' => 'رابط المحادثة غير صالح.']);
        if ($user && !mutqan_can_access_request($user, $request, $guestToken)) mutqan_json(403, ['status' => 'error', 'message' => 'ليس لديك صلاحية لقراءة هذه المحادثة.']);
        $stmt = $pdo->prepare("SELECT id, sender_user_id, sender_name, message, created_at FROM app_messages WHERE request_id=:rid ORDER BY id ASC LIMIT 300");
        $stmt->execute([':rid' => $requestId]);
        mutqan_json(200, ['status' => 'success', 'request' => $request, 'messages' => $stmt->fetchAll()]);
    }

    mutqan_require_method('POST');
    mutqan_require_csrf();
    $input = mutqan_input();

    if ($action === 'create_request') {
        $user = mutqan_current_user($pdo);
        if ($user && !in_array($user['role'], ['client'], true)) mutqan_json(403, ['status' => 'error', 'message' => 'إنشاء طلب صيانة متاح للعميل والزائر فقط.']);
        if ($user && $user['must_change_password']) mutqan_json(428, ['status' => 'error', 'must_change_password' => true, 'message' => 'غيّر كلمة المرور المؤقتة أولاً.']);

        $category = trim((string)($input['service_category'] ?? ''));
        $service = trim((string)($input['service_name'] ?? ''));
        $catalog = mutqan_catalog();
        if (!isset($catalog[$category]) || !in_array($service, $catalog[$category], true)) mutqan_json(422, ['status' => 'error', 'message' => 'اختر الخدمة من القائمة المعتمدة.']);
        $issue = trim((string)($input['issue'] ?? ''));
        if ($issue === '' || mb_strlen($issue) > 5000) mutqan_json(422, ['status' => 'error', 'message' => 'اكتب وصف المشكلة في حدود 5000 حرف.']);

        $name = trim((string)($user['full_name'] ?? $input['full_name'] ?? ''));
        $phone = mutqan_phone((string)($input['phone'] ?? $user['phone'] ?? ''));
        $address = trim((string)($input['address'] ?? $user['address'] ?? ''));
        if (mb_strlen($name) < 2) mutqan_json(422, ['status' => 'error', 'message' => 'اكتب اسم العميل.']);
        if ($phone === '') mutqan_json(422, ['status' => 'error', 'message' => 'اكتب رقم هاتف صحيحاً للتواصل معك.']);
        if ($address === '' || mb_strlen($address) > 255) mutqan_json(422, ['status' => 'error', 'message' => 'حدد عنوان الموقع أو اكتبه يدوياً.']);

        $lat = isset($input['latitude']) && is_numeric($input['latitude']) ? (float)$input['latitude'] : null;
        $lng = isset($input['longitude']) && is_numeric($input['longitude']) ? (float)$input['longitude'] : null;
        if ($lat !== null && ($lat < -90 || $lat > 90)) $lat = null;
        if ($lng !== null && ($lng < -180 || $lng > 180)) $lng = null;
        if (($lat === null) !== ($lng === null)) { $lat = null; $lng = null; }
        $mapsUrl = $lat !== null ? 'https://www.google.com/maps?q=' . rawurlencode((string)$lat . ',' . (string)$lng) : null;
        $priority = (string)($input['priority'] ?? 'normal');
        if (!in_array($priority, ['low','normal','high','urgent'], true)) $priority = 'normal';
        $guestToken = $user ? null : bin2hex(random_bytes(32));

        $pdo->beginTransaction();
        $findClient = $pdo->prepare("SELECT id FROM system_1_clients WHERE phone=:phone ORDER BY id DESC LIMIT 1");
        $findClient->execute([':phone' => $phone]);
        $clientId = (int)($findClient->fetchColumn() ?: 0);
        if ($clientId <= 0) {
            $insertClient = $pdo->prepare("INSERT INTO system_1_clients (name, phone, address, avatar_image_path) VALUES (:name,:phone,:address,'/uploads/clients/pending.jpg')");
            $insertClient->execute([':name' => $name, ':phone' => $phone, ':address' => $address]);
            $clientId = (int)$pdo->lastInsertId();
        }
        $stmt = $pdo->prepare("INSERT INTO system_3_requests (client_id, tech_id, issue, before_img, after_img, service_category, service_name, requester_name, requester_phone, service_address, latitude, longitude, maps_url, channel, status, priority, created_by_user_id, assigned_user_id, guest_token_hash, created_at, updated_at) VALUES (:client_id,NULL,:issue,'/uploads/requests/pending_before.jpg',NULL,:category,:service,:name,:phone,:address,:lat,:lng,:maps,:channel,'new',:priority,:user_id,NULL,:guest_token,NOW(),NOW())");
        $stmt->execute([
            ':client_id' => $clientId, ':issue' => $issue, ':category' => $category, ':service' => $service,
            ':name' => $name, ':phone' => $phone, ':address' => $address, ':lat' => $lat, ':lng' => $lng,
            ':maps' => $mapsUrl, ':channel' => $user ? 'client' : 'guest', ':priority' => $priority,
            ':user_id' => $user ? $user['id'] : null, ':guest_token' => $guestToken ? hash('sha256', $guestToken) : null,
        ]);
        $requestId = (int)$pdo->lastInsertId();
        foreach ($pdo->query("SELECT id FROM app_users WHERE role IN ('owner','operations') AND status='active'")->fetchAll() as $manager) {
            mutqan_notify($pdo, (int)$manager['id'], 'طلب صيانة جديد #' . $requestId, $name . ' طلب خدمة ' . $service . '. يحتاج الطلب إلى مراجعة وإسناد يدوي.', 'request', $requestId);
        }
        mutqan_audit($pdo, $user ? (int)$user['id'] : null, 'create_request', 'request', $requestId, ['service_category' => $category, 'service_name' => $service, 'channel' => $user ? 'client' : 'guest']);
        $pdo->commit();

        $waNumber = defined('WHATSAPP_BUSINESS_NUMBER') ? preg_replace('/\D/', '', (string)WHATSAPP_BUSINESS_NUMBER) : '';
        $waText = 'مرحباً، بخصوص طلب مُتقن رقم ' . $requestId . ' - ' . $service . '، الاسم: ' . $name . '، الجوال: ' . $phone;
        $waUrl = 'https://wa.me/' . ($waNumber ?: '') . '?text=' . rawurlencode($waText);
        mutqan_json(201, [
            'status' => 'success', 'request_id' => $requestId, 'status_label' => 'طلب جديد بانتظار المراجعة',
            'guest_token' => $guestToken, 'maps_url' => $mapsUrl, 'whatsapp_url' => $waUrl,
            'whatsapp_configured' => $waNumber !== '',
            'message' => 'تم حفظ الطلب. مشرف العمليات سيراجعه ويختار الفني يدوياً؛ لن يتم إسناد الطلب تلقائياً.',
        ]);
    }

    $actor = mutqan_require_user($pdo, ['technician','operations','owner']);
    if ($actor['role'] === 'technician' && $actor['must_change_password']) mutqan_json(428, ['status' => 'error', 'must_change_password' => true, 'message' => 'غيّر كلمة المرور المؤقتة أولاً.']);

    if ($action === 'assign_request') {
        if (!in_array($actor['role'], ['operations','owner'], true)) mutqan_json(403, ['status' => 'error', 'message' => 'الإسناد متاح لمشرف العمليات والمالك فقط.']);
        $requestId = (int)($input['request_id'] ?? 0);
        $techUserId = (int)($input['technician_user_id'] ?? 0);
        if ($requestId <= 0 || $techUserId <= 0) mutqan_json(422, ['status' => 'error', 'message' => 'اختر الطلب والفني يدوياً. لا يوجد إسناد تلقائي.']);
        $req = mutqan_request_row($pdo, $requestId);
        if (!$req) mutqan_json(404, ['status' => 'error', 'message' => 'الطلب غير موجود.']);
        if (in_array($req['status'], ['completed','cancelled'], true)) mutqan_json(409, ['status' => 'error', 'message' => 'لا يمكن إسناد طلب مغلق.']);
        $findTech = $pdo->prepare("SELECT t.id AS technician_id, t.user_id, t.status, u.full_name FROM system_2_technicians t JOIN app_users u ON u.id=t.user_id WHERE t.user_id=:uid AND u.role='technician' AND u.status='active' AND t.status IN ('available','busy') LIMIT 1");
        $findTech->execute([':uid' => $techUserId]);
        $tech = $findTech->fetch();
        if (!$tech) mutqan_json(422, ['status' => 'error', 'message' => 'الفني غير معتمد أو غير متاح للإسناد.']);
        $stmt = $pdo->prepare("UPDATE system_3_requests SET tech_id=:tech_id, assigned_user_id=:uid, status='assigned', updated_at=NOW() WHERE id=:id");
        $stmt->execute([':tech_id' => $tech['technician_id'], ':uid' => $techUserId, ':id' => $requestId]);
        $pdo->prepare("UPDATE system_2_technicians SET status='busy', updated_at=NOW() WHERE id=:id")->execute([':id' => $tech['technician_id']]);
        mutqan_notify($pdo, (int)$techUserId, 'مهمة جديدة #' . $requestId, 'تم إسناد طلب ' . $req['service_name'] . ' لك يدوياً من العمليات.', 'request', $requestId);
        mutqan_audit($pdo, (int)$actor['id'], 'assign_request', 'request', $requestId, ['technician_user_id' => $techUserId]);
        mutqan_json(200, ['status' => 'success', 'message' => 'تم إسناد الطلب للفني المختار.', 'request_id' => $requestId, 'technician_name' => $tech['full_name']]);
    }

    if ($action === 'provider_decision') {
        if ($actor['role'] !== 'owner') mutqan_json(403, ['status' => 'error', 'message' => 'اعتماد مزودي الخدمة من صلاحية المالك فقط.']);
        $providerId = (int)($input['provider_user_id'] ?? 0);
        $decision = (string)($input['decision'] ?? '');
        if ($providerId <= 0 || !in_array($decision, ['approve','reject'], true)) mutqan_json(422, ['status' => 'error', 'message' => 'طلب اعتماد غير صالح.']);
        $find = $pdo->prepare("SELECT * FROM app_users WHERE id=:id AND role='provider' AND status='pending' LIMIT 1");
        $find->execute([':id' => $providerId]);
        $provider = $find->fetch();
        if (!$provider) mutqan_json(404, ['status' => 'error', 'message' => 'طلب مزود الخدمة غير موجود أو سبق التعامل معه.']);
        if ($decision === 'reject') {
            $pdo->prepare("UPDATE app_users SET status='rejected', approved_by=:owner, approved_at=NOW() WHERE id=:id")->execute([':owner' => $actor['id'], ':id' => $providerId]);
            mutqan_notify($pdo, $providerId, 'نتيجة طلب الانضمام', 'لم تتم الموافقة على طلب الانضمام حالياً. يمكنك التواصل مع الإدارة للمراجعة.', 'provider', $providerId);
            mutqan_audit($pdo, (int)$actor['id'], 'reject_provider', 'user', $providerId);
            mutqan_json(200, ['status' => 'success', 'message' => 'تم رفض طلب مزود الخدمة وتسجيل القرار.']);
        }
        $pdo->beginTransaction();
        $pdo->prepare("UPDATE app_users SET role='technician', status='active', approved_by=:owner, approved_at=NOW() WHERE id=:id")->execute([':owner' => $actor['id'], ':id' => $providerId]);
        $techStmt = $pdo->prepare("INSERT INTO system_2_technicians (name, specialty, rating, cert_image_path, user_id, status, latitude, longitude, updated_at) VALUES (:name,:specialty,5.00,'/uploads/technicians/pending.jpg',:uid,'available',:lat,:lng,NOW()) ON DUPLICATE KEY UPDATE specialty=VALUES(specialty), status='available', updated_at=NOW()");
        $techStmt->execute([':name' => $provider['full_name'], ':specialty' => $provider['specialty'] ?: 'خدمات عامة', ':uid' => $providerId, ':lat' => $provider['latitude'], ':lng' => $provider['longitude']]);
        mutqan_notify($pdo, $providerId, 'تم اعتمادك كمزود خدمة', 'اعتمد المالك حسابك كفني. لن تصلك مهمة إلا بعد إسنادها يدوياً من مشرف العمليات.', 'provider', $providerId);
        mutqan_audit($pdo, (int)$actor['id'], 'approve_provider_as_technician', 'user', $providerId, ['specialty' => $provider['specialty']]);
        $pdo->commit();
        mutqan_json(200, ['status' => 'success', 'message' => 'تم اعتماد المزود وإضافته إلى قائمة الفنيين. لن يتلقى مهام تلقائية.']);
    }

    if ($action === 'update_task_status') {
        if ($actor['role'] !== 'technician') mutqan_json(403, ['status' => 'error', 'message' => 'تحديث مراحل المهمة من صلاحية الفني المعيّن.']);
        $requestId = (int)($input['request_id'] ?? 0);
        $newStatus = (string)($input['status'] ?? '');
        $allowed = ['accepted','en_route','in_progress','awaiting_approval'];
        if ($requestId <= 0 || !in_array($newStatus, $allowed, true)) mutqan_json(422, ['status' => 'error', 'message' => 'مرحلة المهمة غير صالحة.']);
        $req = mutqan_request_row($pdo, $requestId);
        if (!$req || (int)$req['assigned_user_id'] !== (int)$actor['id']) mutqan_json(404, ['status' => 'error', 'message' => 'المهمة غير مسندة إلى حسابك.']);
        $transition = [
            'assigned' => ['accepted'],
            'accepted' => ['en_route','in_progress'],
            'en_route' => ['in_progress'],
            'in_progress' => ['awaiting_approval'],
            'awaiting_approval' => [],
        ];
        if (!in_array($newStatus, $transition[$req['status']] ?? [], true)) mutqan_json(409, ['status' => 'error', 'message' => 'لا يمكن الانتقال من الحالة الحالية إلى هذه المرحلة.']);
        $pdo->prepare("UPDATE system_3_requests SET status=:status, updated_at=NOW() WHERE id=:id")->execute([':status' => $newStatus, ':id' => $requestId]);
        mutqan_audit($pdo, (int)$actor['id'], 'update_task_status', 'request', $requestId, ['from' => $req['status'], 'to' => $newStatus]);
        if ($newStatus === 'awaiting_approval') {
            foreach ($pdo->query("SELECT id FROM app_users WHERE role IN ('owner','operations') AND status='active'")->fetchAll() as $manager) {
                mutqan_notify($pdo, (int)$manager['id'], 'المهمة بانتظار الاعتماد #' . $requestId, 'أنهى الفني عمله وأرسل المهمة للمراجعة قبل إغلاقها.', 'request', $requestId);
            }
        } else {
            $clientUserId = (int)($req['created_by_user_id'] ?? 0);
            if ($clientUserId > 0) mutqan_notify($pdo, $clientUserId, 'تحديث طلب الصيانة #' . $requestId, 'تم تحديث حالة طلبك إلى: ' . $newStatus, 'request', $requestId);
        }
        mutqan_json(200, ['status' => 'success', 'message' => 'تم تحديث حالة المهمة.']);
    }

    if ($action === 'review_completion') {
        if (!in_array($actor['role'], ['operations','owner'], true)) mutqan_json(403, ['status' => 'error', 'message' => 'اعتماد إغلاق المهمة متاح للعمليات والمالك.']);
        $requestId = (int)($input['request_id'] ?? 0);
        $decision = (string)($input['decision'] ?? '');
        $req = $requestId > 0 ? mutqan_request_row($pdo, $requestId) : null;
        if (!$req || $req['status'] !== 'awaiting_approval') mutqan_json(409, ['status' => 'error', 'message' => 'الطلب ليس بانتظار اعتماد الإغلاق.']);
        if (!in_array($decision, ['approve','reopen'], true)) mutqan_json(422, ['status' => 'error', 'message' => 'اختيار الاعتماد غير صالح.']);
        $newStatus = $decision === 'approve' ? 'completed' : 'in_progress';
        $pdo->prepare("UPDATE system_3_requests SET status=:status, updated_at=NOW() WHERE id=:id")->execute([':status' => $newStatus, ':id' => $requestId]);
        if ($decision === 'approve' && (int)($req['tech_id'] ?? 0) > 0) {
            $pdo->prepare("UPDATE system_2_technicians SET status='available', updated_at=NOW() WHERE id=:id")->execute([':id' => $req['tech_id']]);
        }
        if ((int)($req['created_by_user_id'] ?? 0) > 0) mutqan_notify($pdo, (int)$req['created_by_user_id'], 'تمت مراجعة طلبك #' . $requestId, $decision === 'approve' ? 'تم اعتماد إنجاز الخدمة وإغلاق الطلب.' : 'أُعيدت المهمة للفني لاستكمال العمل.', 'request', $requestId);
        if ((int)($req['assigned_user_id'] ?? 0) > 0 && $decision === 'reopen') mutqan_notify($pdo, (int)$req['assigned_user_id'], 'استكمال المهمة #' . $requestId, 'أعادت العمليات المهمة لاستكمال العمل.', 'request', $requestId);
        mutqan_audit($pdo, (int)$actor['id'], 'review_completion', 'request', $requestId, ['decision' => $decision]);
        mutqan_json(200, ['status' => 'success', 'message' => $decision === 'approve' ? 'تم اعتماد الإغلاق.' : 'تمت إعادة المهمة للفني.']);
    }

    if ($action === 'save_location') {
        if ($actor['role'] !== 'technician') mutqan_json(403, ['status' => 'error', 'message' => 'تحديث موقع الفني فقط.']);
        $lat = isset($input['latitude']) && is_numeric($input['latitude']) ? (float)$input['latitude'] : null;
        $lng = isset($input['longitude']) && is_numeric($input['longitude']) ? (float)$input['longitude'] : null;
        if ($lat === null || $lng === null || $lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) mutqan_json(422, ['status' => 'error', 'message' => 'إحداثيات الموقع غير صالحة.']);
        $pdo->prepare("UPDATE app_users SET latitude=:lat, longitude=:lng WHERE id=:id")->execute([':lat' => $lat, ':lng' => $lng, ':id' => $actor['id']]);
        $pdo->prepare("UPDATE system_2_technicians SET latitude=:lat, longitude=:lng, updated_at=NOW() WHERE user_id=:id")->execute([':lat' => $lat, ':lng' => $lng, ':id' => $actor['id']]);
        mutqan_json(200, ['status' => 'success', 'maps_url' => 'https://www.google.com/maps?q=' . rawurlencode((string)$lat . ',' . (string)$lng)]);
    }

    if ($action === 'send_message') {
        $requestId = (int)($input['request_id'] ?? 0);
        $message = trim((string)($input['message'] ?? ''));
        if ($requestId <= 0 || $message === '' || mb_strlen($message) > 3000) mutqan_json(422, ['status' => 'error', 'message' => 'اكتب رسالة من 1 إلى 3000 حرف.']);
        $req = mutqan_request_row($pdo, $requestId);
        if (!$req) mutqan_json(404, ['status' => 'error', 'message' => 'الطلب غير موجود.']);
        $user = mutqan_current_user($pdo);
        $guestToken = isset($input['guest_token']) ? (string)$input['guest_token'] : null;
        if (!$user && !mutqan_can_access_request([], $req, $guestToken)) mutqan_json(403, ['status' => 'error', 'message' => 'رابط المحادثة غير صالح.']);
        if ($user && !mutqan_can_access_request($user, $req, $guestToken)) mutqan_json(403, ['status' => 'error', 'message' => 'ليس لديك صلاحية إرسال رسالة لهذا الطلب.']);
        if (in_array($req['status'], ['completed','cancelled'], true)) mutqan_json(409, ['status' => 'error', 'message' => 'المحادثة مغلقة مع انتهاء الطلب.']);
        $senderName = $user ? (string)$user['full_name'] : trim((string)($input['guest_name'] ?? $req['customer_name'] ?? 'الزائر'));
        $stmt = $pdo->prepare("INSERT INTO app_messages (request_id, sender_user_id, sender_name, message) VALUES (:rid,:uid,:name,:message)");
        $stmt->execute([':rid' => $requestId, ':uid' => $user ? $user['id'] : null, ':name' => mb_substr($senderName, 0, 120), ':message' => $message]);
        $recipients = [];
        if ($user && $user['role'] === 'client') {
            $q = $pdo->prepare("SELECT id FROM app_users WHERE role IN ('operations','owner') AND status='active'");
            $q->execute(); $recipients = $q->fetchAll();
        } elseif ($user && $user['role'] === 'technician') {
            $q = $pdo->prepare("SELECT id FROM app_users WHERE role IN ('operations','owner') AND status='active'");
            $q->execute(); $recipients = $q->fetchAll();
            if ((int)($req['created_by_user_id'] ?? 0) > 0) $recipients[] = ['id' => (int)$req['created_by_user_id']];
        } else {
            $q = $pdo->prepare("SELECT id FROM app_users WHERE role IN ('operations','owner') AND status='active'");
            $q->execute(); $recipients = $q->fetchAll();
        }
        foreach ($recipients as $recipient) if (!$user || (int)$recipient['id'] !== (int)$user['id']) mutqan_notify($pdo, (int)$recipient['id'], 'رسالة جديدة في الطلب #' . $requestId, mb_substr($message, 0, 300), 'request', $requestId);
        mutqan_json(201, ['status' => 'success', 'message' => 'تم إرسال الرسالة.']);
    }

    mutqan_json(404, ['status' => 'error', 'message' => 'العملية المطلوبة غير معروفة.']);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) $pdo->rollBack();
    error_log('[MUTQAN portal] ' . $e->getMessage());
    mutqan_json(503, ['status' => 'error', 'message' => 'تعذر إكمال العملية. راجع إعداد قاعدة البيانات وتطبيق migration الخاصة بواجهات الأدوار.']);
}
