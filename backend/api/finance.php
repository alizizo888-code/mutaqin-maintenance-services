<?php
declare(strict_types=1);
/**
 * MUTQAN technician finance API: cash custody, spare-part purchases, expenses, settlements.
 *
 * Ledger sign convention (mutqan_tech_ledger.amount):
 *   +  the technician owes the company (cash in his hand)
 *   -  the company owes the technician (approved purchases/expenses, his commission share)
 * Balance = SUM(amount). Nothing is deducted twice: every ledger row is unique per (source_type, source_id, entry_type).
 * Expected cash is never counted as received until the technician or operations confirms it.
 */
require_once __DIR__ . '/../helpers/portal.php';
require_once __DIR__ . '/../config/db.php';

mutqan_start_session();
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$action = (string)($_GET['action'] ?? 'me');
if ($method === 'OPTIONS') { http_response_code(204); exit; }

const FIN_MANAGERS = ['owner', 'operations'];
const FIN_PROFILE_FIELDS = ['pay_model','company_share_cash','company_share_transfer','monthly_salary','custody_limit','can_buy_parts','can_add_expenses','can_edit_prices','can_edit_orders','can_suggest_catalog','permission_level','is_frozen'];

function fin_is_manager(array $u): bool { return in_array($u['role'], FIN_MANAGERS, true); }

function fin_profile(PDO $pdo, int $userId): array {
    $s = $pdo->prepare("SELECT * FROM mutqan_tech_finance_profiles WHERE user_id=:id");
    $s->execute([':id' => $userId]);
    $row = $s->fetch();
    if ($row) return $row;
    // Safe default: commission technicians pay for their own parts.
    $pdo->prepare("INSERT IGNORE INTO mutqan_tech_finance_profiles (user_id, pay_model) VALUES (:id,'commission')")->execute([':id' => $userId]);
    $s->execute([':id' => $userId]);
    return $s->fetch() ?: ['user_id' => $userId, 'pay_model' => 'commission', 'company_share_cash' => 25, 'company_share_transfer' => 20, 'can_buy_parts' => 0, 'can_add_expenses' => 0, 'can_edit_prices' => 1, 'can_edit_orders' => 1, 'can_suggest_catalog' => 1, 'permission_level' => 1, 'is_frozen' => 0, 'custody_limit' => 0];
}

/** Parts are deductible for monthly technicians, or for commission technicians the owner explicitly allowed. */
function fin_parts_allowed(array $p): bool { return $p['pay_model'] === 'monthly' || !empty($p['can_buy_parts']); }
function fin_expenses_allowed(array $p): bool { return $p['pay_model'] === 'monthly' || !empty($p['can_add_expenses']); }

function fin_technician(PDO $pdo, int $id): array {
    $s = $pdo->prepare("SELECT id, full_name, username, phone, status FROM app_users WHERE id=:id AND role='technician' LIMIT 1");
    $s->execute([':id' => $id]);
    $t = $s->fetch();
    if (!$t) mutqan_json(404, ['status' => 'error', 'message' => 'الفني غير موجود.']);
    return $t;
}

/** Resolve whose account is being viewed: technicians see only themselves; managers may open any technician. */
function fin_target(PDO $pdo, array $user, $requested): int {
    if ($user['role'] === 'technician') return (int)$user['id'];
    $id = (int)$requested;
    if ($id <= 0) mutqan_json(422, ['status' => 'error', 'message' => 'حدد الفني.']);
    fin_technician($pdo, $id);
    return $id;
}

function fin_ledger_add(PDO $pdo, int $techId, string $type, float $amount, ?int $requestId, string $sourceType, int $sourceId, string $payModel, string $desc, ?int $actor): void {
    $pdo->prepare("INSERT INTO mutqan_tech_ledger (technician_user_id, entry_type, amount, request_id, source_type, source_id, pay_model_snapshot, description, created_by)
                   VALUES (:t,:type,:amount,:req,:st,:sid,:pm,:d,:actor)")
        ->execute([':t' => $techId, ':type' => $type, ':amount' => round($amount, 2), ':req' => $requestId, ':st' => $sourceType, ':sid' => $sourceId, ':pm' => $payModel, ':d' => mb_substr($desc, 0, 255), ':actor' => $actor]);
}

function fin_summary(PDO $pdo, int $techId): array {
    $s = $pdo->prepare("SELECT entry_type, COALESCE(SUM(amount),0) total FROM mutqan_tech_ledger WHERE technician_user_id=:t GROUP BY entry_type");
    $s->execute([':t' => $techId]);
    $by = array_fill_keys(['cash_received','technician_share','part_purchase','expense','adjustment','settlement'], 0.0);
    foreach ($s->fetchAll() as $r) $by[$r['entry_type']] = round((float)$r['total'], 2);
    $balance = round(array_sum($by), 2);
    $e = $pdo->prepare("SELECT COUNT(*) c, COALESCE(SUM(purchase_price*quantity),0) v FROM mutqan_tech_expenses WHERE technician_user_id=:t AND status IN ('new','under_review')");
    $e->execute([':t' => $techId]); $pending = $e->fetch();
    $c = $pdo->prepare("SELECT COUNT(*) c, COALESCE(SUM(expected_amount),0) v FROM mutqan_cash_collections WHERE technician_user_id=:t AND status='expected'");
    $c->execute([':t' => $techId]); $expected = $c->fetch();
    return [
        'balance' => $balance,                       // >0 technician must hand over, <0 company owes him
        'to_deliver' => max(0, $balance),
        'owed_to_technician' => max(0, -$balance),
        'cash_received' => $by['cash_received'],
        'technician_share' => -$by['technician_share'],
        'parts' => -$by['part_purchase'],
        'expenses' => -$by['expense'],
        'adjustments' => $by['adjustment'],
        'settlements' => -$by['settlement'],
        'pending_review_count' => (int)$pending['c'],
        'pending_review_amount' => round((float)$pending['v'], 2),
        'expected_cash_count' => (int)$expected['c'],
        'expected_cash_amount' => round((float)$expected['v'], 2),
    ];
}

function fin_request(PDO $pdo, int $id, bool $lock = false): array {
    $s = $pdo->prepare("SELECT id, assigned_user_id, created_by_user_id, status, quoted_total, service_name FROM system_3_requests WHERE id=:id LIMIT 1" . ($lock ? ' FOR UPDATE' : ''));
    $s->execute([':id' => $id]);
    $r = $s->fetch();
    if (!$r) mutqan_json(404, ['status' => 'error', 'message' => 'الطلب غير موجود.']);
    return $r;
}

/** Store an uploaded image under /uploads/expenses/<tech>/ and return [path, sha256]. */
function fin_store_image(string $field, int $techId, bool $required): array {
    if (empty($_FILES[$field]) || ($_FILES[$field]['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        if ($required) mutqan_json(422, ['status' => 'error', 'message' => $field === 'invoice_image' ? 'صورة الفاتورة مطلوبة.' : 'صورة القطعة مطلوبة.']);
        return [null, null];
    }
    $f = $_FILES[$field];
    if ($f['error'] !== UPLOAD_ERR_OK) mutqan_json(400, ['status' => 'error', 'message' => 'تعذر رفع الصورة.']);
    if ((int)$f['size'] > 6 * 1024 * 1024) mutqan_json(413, ['status' => 'error', 'message' => 'أقصى حجم للصورة 6 ميجابايت.']);
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
    $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$mime] ?? null;
    if (!$ext) mutqan_json(415, ['status' => 'error', 'message' => 'الصيغ المسموحة: JPG وPNG وWEBP.']);
    $hash = hash_file('sha256', $f['tmp_name']);
    $dir = __DIR__ . '/../../uploads/expenses/' . $techId . '/';
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) throw new RuntimeException('Cannot create upload directory');
    $name = $field . '_' . $hash . '.' . $ext;
    if (!is_file($dir . $name) && !move_uploaded_file($f['tmp_name'], $dir . $name)) throw new RuntimeException('Cannot move uploaded file');
    return ['/uploads/expenses/' . $techId . '/' . $name, $hash];
}

try {
    $pdo = getDatabaseConnection();

    // ───────────── READ ─────────────
    if ($method === 'GET' && $action === 'me') {
        $user = mutqan_require_user($pdo, ['owner', 'operations', 'technician']);
        $techId = fin_target($pdo, $user, $_GET['technician_id'] ?? 0);
        $profile = fin_profile($pdo, $techId);
        $l = $pdo->prepare("SELECT id, entry_type, amount, request_id, description, pay_model_snapshot, created_at FROM mutqan_tech_ledger WHERE technician_user_id=:t ORDER BY id DESC LIMIT 200");
        $l->execute([':t' => $techId]);
        $x = $pdo->prepare("SELECT * FROM mutqan_tech_expenses WHERE technician_user_id=:t ORDER BY id DESC LIMIT 200");
        $x->execute([':t' => $techId]);
        $c = $pdo->prepare("SELECT c.*, r.service_name FROM mutqan_cash_collections c LEFT JOIN system_3_requests r ON r.id=c.request_id WHERE c.technician_user_id=:t ORDER BY c.id DESC LIMIT 100");
        $c->execute([':t' => $techId]);
        mutqan_json(200, ['status' => 'success', 'technician' => fin_technician($pdo, $techId), 'profile' => $profile,
            'rules' => ['parts_deductible' => fin_parts_allowed($profile), 'expenses_deductible' => fin_expenses_allowed($profile)],
            'summary' => fin_summary($pdo, $techId), 'ledger' => $l->fetchAll(), 'expenses' => $x->fetchAll(), 'cash' => $c->fetchAll()]);
    }
    if ($method === 'GET' && $action === 'technicians') {
        mutqan_require_user($pdo, FIN_MANAGERS);
        $rows = $pdo->query("SELECT u.id, u.full_name, u.username, u.status, COALESCE(p.pay_model,'commission') pay_model, COALESCE(p.is_frozen,0) is_frozen, COALESCE(p.permission_level,1) permission_level
                             FROM app_users u LEFT JOIN mutqan_tech_finance_profiles p ON p.user_id=u.id WHERE u.role='technician' ORDER BY u.full_name")->fetchAll();
        foreach ($rows as &$r) $r['summary'] = fin_summary($pdo, (int)$r['id']);
        mutqan_json(200, ['status' => 'success', 'technicians' => $rows]);
    }
    if ($method === 'GET' && $action === 'review_queue') {
        mutqan_require_user($pdo, FIN_MANAGERS);
        $x = $pdo->query("SELECT e.*, u.full_name technician_name FROM mutqan_tech_expenses e JOIN app_users u ON u.id=e.technician_user_id WHERE e.status IN ('new','under_review') ORDER BY e.id ASC LIMIT 300")->fetchAll();
        $s = $pdo->query("SELECT c.id, c.item_code, c.item_name, c.category, c.service_key, c.base_price, c.purchase_price, c.created_at, u.full_name suggested_by_name FROM mutqan_price_catalog c LEFT JOIN app_users u ON u.id=c.suggested_by WHERE c.approval_status='pending' ORDER BY c.id ASC LIMIT 200")->fetchAll();
        mutqan_json(200, ['status' => 'success', 'expenses' => $x, 'suggestions' => $s]);
    }
    if ($method === 'GET' && $action === 'request_cash') {
        $user = mutqan_require_user($pdo, ['owner', 'operations', 'technician']);
        $req = fin_request($pdo, (int)($_GET['request_id'] ?? 0));
        if ($user['role'] === 'technician' && (int)$req['assigned_user_id'] !== (int)$user['id']) mutqan_json(403, ['status' => 'error', 'message' => 'هذا الطلب غير مسند إليك.']);
        $c = $pdo->prepare("SELECT * FROM mutqan_cash_collections WHERE request_id=:id");
        $c->execute([':id' => $req['id']]);
        $x = $pdo->prepare("SELECT id, expense_type, item_name, quantity, purchase_price, sale_price, status FROM mutqan_tech_expenses WHERE request_id=:id ORDER BY id");
        $x->execute([':id' => $req['id']]);
        mutqan_json(200, ['status' => 'success', 'request' => $req, 'collection' => $c->fetch() ?: null, 'expenses' => $x->fetchAll()]);
    }
    if ($method === 'GET' && $action === 'profile_history') {
        mutqan_require_user($pdo, FIN_MANAGERS);
        $h = $pdo->prepare("SELECT h.*, u.full_name changed_by_name FROM mutqan_tech_finance_profile_history h LEFT JOIN app_users u ON u.id=h.changed_by WHERE h.user_id=:t ORDER BY h.id DESC LIMIT 100");
        $h->execute([':t' => (int)($_GET['technician_id'] ?? 0)]);
        mutqan_json(200, ['status' => 'success', 'history' => $h->fetchAll()]);
    }

    if ($method !== 'POST') mutqan_json(405, ['status' => 'error', 'message' => 'طريقة الطلب غير مسموحة.']);
    mutqan_require_csrf();
    $in = mutqan_input();

    // ───────────── OWNER: technician profile / pay model / permissions ─────────────
    if ($action === 'save_profile') {
        $user = mutqan_require_user($pdo, ['owner']);
        $techId = (int)($in['technician_id'] ?? 0);
        fin_technician($pdo, $techId);
        $old = fin_profile($pdo, $techId);
        $new = [];
        foreach (FIN_PROFILE_FIELDS as $k) $new[$k] = array_key_exists($k, $in) ? $in[$k] : $old[$k];
        $new['pay_model'] = $new['pay_model'] === 'monthly' ? 'monthly' : 'commission';
        foreach (['company_share_cash', 'company_share_transfer'] as $k) { $new[$k] = (float)$new[$k]; if ($new[$k] < 0 || $new[$k] > 100) mutqan_json(422, ['status' => 'error', 'message' => 'نسبة الشركة يجب أن تكون بين 0 و100.']); }
        $new['monthly_salary'] = $new['monthly_salary'] === null || $new['monthly_salary'] === '' ? null : max(0, (float)$new['monthly_salary']);
        $new['custody_limit'] = max(0, (float)$new['custody_limit']);
        foreach (['can_buy_parts', 'can_add_expenses', 'can_edit_prices', 'can_edit_orders', 'can_suggest_catalog', 'is_frozen'] as $k) $new[$k] = !empty($new[$k]) ? 1 : 0;
        $new['permission_level'] = min(10, max(1, (int)$new['permission_level']));
        $effective = trim((string)($in['effective_from'] ?? ''));
        $effective = preg_match('/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?$/', $effective) ? $effective : date('Y-m-d H:i:s');
        $pdo->beginTransaction();
        $sets = implode(',', array_map(fn($k) => "$k=:$k", FIN_PROFILE_FIELDS));
        $params = []; foreach (FIN_PROFILE_FIELDS as $k) $params[":$k"] = $new[$k];
        $pdo->prepare("UPDATE mutqan_tech_finance_profiles SET $sets, effective_from=:eff, updated_by=:actor WHERE user_id=:id")
            ->execute($params + [':eff' => $effective, ':actor' => $user['id'], ':id' => $techId]);
        $oldSnap = array_intersect_key($old, array_flip(FIN_PROFILE_FIELDS));
        $pdo->prepare("INSERT INTO mutqan_tech_finance_profile_history (user_id, old_json, new_json, effective_from, changed_by) VALUES (:u,:o,:n,:e,:a)")
            ->execute([':u' => $techId, ':o' => json_encode($oldSnap, JSON_UNESCAPED_UNICODE), ':n' => json_encode($new, JSON_UNESCAPED_UNICODE), ':e' => $effective, ':a' => $user['id']]);
        mutqan_audit($pdo, (int)$user['id'], 'update_tech_finance_profile', 'technician', $techId, ['old' => $oldSnap, 'new' => $new, 'effective_from' => $effective]);
        if ($old['pay_model'] !== $new['pay_model']) mutqan_notify($pdo, $techId, 'تغيير نظام المحاسبة', 'تم تغيير نظام حسابك إلى ' . ($new['pay_model'] === 'monthly' ? 'شهري' : 'نسبة') . ' اعتباراً من ' . $effective . '. الحركات السابقة تبقى على نظامها القديم.', 'finance', $techId);
        $pdo->commit();
        mutqan_json(200, ['status' => 'success', 'message' => 'تم حفظ نظام الفني وصلاحياته. الحسابات السابقة لم تتغير.']);
    }

    // ───────────── CASH ─────────────
    if ($action === 'mark_cash_expected') {
        // Customer chose cash: record what is EXPECTED. Not counted in custody until confirmed.
        $user = mutqan_require_user($pdo, ['owner', 'operations', 'technician', 'client']);
        $req = fin_request($pdo, (int)($in['request_id'] ?? 0));
        $allowed = fin_is_manager($user) || ((int)$req['assigned_user_id'] === (int)$user['id']) || ($user['role'] === 'client' && (int)$req['created_by_user_id'] === (int)$user['id']);
        if (!$allowed) mutqan_json(403, ['status' => 'error', 'message' => 'لا يمكنك تعديل طريقة دفع هذا الطلب.']);
        if (empty($req['assigned_user_id'])) mutqan_json(409, ['status' => 'error', 'message' => 'أسند الطلب لفني أولاً حتى يُسجّل النقد على عهدته.']);
        $amount = isset($in['expected_amount']) && is_numeric($in['expected_amount']) ? max(0, (float)$in['expected_amount']) : (float)($req['quoted_total'] ?? 0);
        $pdo->prepare("UPDATE system_3_requests SET payment_method='cash', updated_at=NOW() WHERE id=:id")->execute([':id' => $req['id']]);
        $pdo->prepare("INSERT INTO mutqan_cash_collections (request_id, technician_user_id, expected_amount, created_by) VALUES (:r,:t,:a,:u)
                       ON DUPLICATE KEY UPDATE expected_amount=IF(status='expected', VALUES(expected_amount), expected_amount), technician_user_id=IF(status='expected', VALUES(technician_user_id), technician_user_id)")
            ->execute([':r' => $req['id'], ':t' => $req['assigned_user_id'], ':a' => $amount, ':u' => $user['id']]);
        mutqan_notify($pdo, (int)$req['assigned_user_id'], 'العميل اختار الدفع نقداً', 'الطلب رقم ' . $req['id'] . ' سيدفع نقداً بقيمة متوقعة ' . $amount . ' ريال. أكّد الاستلام بعد التحصيل.', 'request', (int)$req['id']);
        mutqan_audit($pdo, (int)$user['id'], 'mark_cash_expected', 'request', (int)$req['id'], ['expected_amount' => $amount]);
        mutqan_json(200, ['status' => 'success', 'message' => 'تم تسجيل الدفع النقدي كمبلغ متوقع بانتظار تأكيد الاستلام.']);
    }
    if ($action === 'confirm_cash') {
        $user = mutqan_require_user($pdo, ['owner', 'operations', 'technician']);
        $received = (float)($in['received_amount'] ?? -1);
        if ($received < 0 || $received > 1000000) mutqan_json(422, ['status' => 'error', 'message' => 'أدخل المبلغ المستلم فعلياً.']);
        $pdo->beginTransaction();
        $req = fin_request($pdo, (int)($in['request_id'] ?? 0), true);
        $techId = (int)$req['assigned_user_id'];
        if (!$techId) mutqan_json(409, ['status' => 'error', 'message' => 'الطلب غير مسند لفني.']);
        if ($user['role'] === 'technician' && $techId !== (int)$user['id']) mutqan_json(403, ['status' => 'error', 'message' => 'هذا الطلب غير مسند إليك.']);
        $c = $pdo->prepare("SELECT * FROM mutqan_cash_collections WHERE request_id=:r FOR UPDATE");
        $c->execute([':r' => $req['id']]); $col = $c->fetch();
        if ($col && $col['status'] === 'received') mutqan_json(409, ['status' => 'error', 'message' => 'تم تأكيد استلام نقد هذا الطلب مسبقاً؛ لا يمكن تسجيله مرتين.']);
        if (!$col) {
            $pdo->prepare("INSERT INTO mutqan_cash_collections (request_id, technician_user_id, expected_amount, created_by) VALUES (:r,:t,:a,:u)")
                ->execute([':r' => $req['id'], ':t' => $techId, ':a' => (float)($req['quoted_total'] ?? $received), ':u' => $user['id']]);
            $colId = (int)$pdo->lastInsertId();
        } else $colId = (int)$col['id'];
        $pdo->prepare("UPDATE system_3_requests SET payment_method='cash', updated_at=NOW() WHERE id=:id")->execute([':id' => $req['id']]);
        $pdo->prepare("UPDATE mutqan_cash_collections SET received_amount=:a, status='received', confirmed_by=:u, confirmed_at=NOW(), note=:n WHERE id=:id")
            ->execute([':a' => $received, ':u' => $user['id'], ':n' => mb_substr(trim((string)($in['note'] ?? '')), 0, 500), ':id' => $colId]);
        $profile = fin_profile($pdo, $techId);
        fin_ledger_add($pdo, $techId, 'cash_received', $received, (int)$req['id'], 'cash_collection', $colId, $profile['pay_model'], 'نقد مستلم من العميل — طلب #' . $req['id'], (int)$user['id']);
        if ($profile['pay_model'] === 'commission') {
            // Commission technician keeps his share of the cash; he hands over only the company share.
            $techShare = round($received * (100 - (float)$profile['company_share_cash']) / 100, 2);
            if ($techShare > 0) fin_ledger_add($pdo, $techId, 'technician_share', -$techShare, (int)$req['id'], 'cash_collection', $colId, 'commission', 'نصيب الفني (' . (100 - (float)$profile['company_share_cash']) . '%) — طلب #' . $req['id'], (int)$user['id']);
        }
        $diff = $col ? round($received - (float)$col['expected_amount'], 2) : 0;
        mutqan_audit($pdo, (int)$user['id'], 'confirm_cash_received', 'request', (int)$req['id'], ['received' => $received, 'expected' => $col['expected_amount'] ?? null, 'difference' => $diff, 'pay_model' => $profile['pay_model']]);
        if ($user['role'] === 'technician') {
            foreach ($pdo->query("SELECT id FROM app_users WHERE role IN ('owner','operations') AND status='active'")->fetchAll() as $m)
                mutqan_notify($pdo, (int)$m['id'], 'تأكيد استلام نقد', 'الفني ' . $user['full_name'] . ' أكد استلام ' . $received . ' ريال نقداً للطلب رقم ' . $req['id'] . ($diff != 0.0 ? ' (فرق ' . $diff . ' عن المتوقع)' : '') . '.', 'request', (int)$req['id']);
        }
        $pdo->commit();
        mutqan_json(200, ['status' => 'success', 'message' => 'تم تسجيل النقد في عهدة الفني.', 'summary' => fin_summary($pdo, $techId)]);
    }

    // ───────────── PURCHASES & EXPENSES ─────────────
    if ($action === 'submit_expense') {
        $user = mutqan_require_user($pdo, ['technician', 'owner', 'operations']);
        $techId = fin_target($pdo, $user, $in['technician_id'] ?? 0);
        $profile = fin_profile($pdo, $techId);
        if (!empty($profile['is_frozen'])) mutqan_json(423, ['status' => 'error', 'message' => 'الحساب المالي مجمّد من الإدارة.']);
        $type = (string)($in['expense_type'] ?? '');
        if (!in_array($type, ['spare_part', 'fuel', 'meal', 'other'], true)) mutqan_json(422, ['status' => 'error', 'message' => 'نوع المصروف غير صالح.']);
        if ($type === 'spare_part' && !fin_parts_allowed($profile)) mutqan_json(403, ['status' => 'error', 'message' => 'نظامك بالنسبة: قطع الغيار على حسابك ولا تُخصم من العهدة. تواصل مع الإدارة لطلب استثناء.']);
        if ($type !== 'spare_part' && !fin_expenses_allowed($profile)) mutqan_json(403, ['status' => 'error', 'message' => 'إضافة المصروفات غير مفعّلة لحسابك.']);
        $qty = max(0.01, (float)($in['quantity'] ?? 1));
        $price = (float)($in['purchase_price'] ?? -1);
        if ($price <= 0 || $price > 100000) mutqan_json(422, ['status' => 'error', 'message' => 'أدخل قيمة الفاتورة بشكل صحيح.']);
        $requestId = (int)($in['request_id'] ?? 0) ?: null;
        if ($requestId) { $r = fin_request($pdo, $requestId); if ($user['role'] === 'technician' && (int)$r['assigned_user_id'] !== $techId) mutqan_json(403, ['status' => 'error', 'message' => 'الطلب المرتبط غير مسند إليك.']); }
        $catalogId = (int)($in['catalog_item_id'] ?? 0) ?: null;
        $name = trim((string)($in['item_name'] ?? ''));
        if ($catalogId) { $s = $pdo->prepare("SELECT item_name FROM mutqan_price_catalog WHERE id=:id AND is_active=1"); $s->execute([':id' => $catalogId]); $n = $s->fetchColumn(); if ($n === false) mutqan_json(422, ['status' => 'error', 'message' => 'القطعة غير موجودة في الكتالوج.']); if ($name === '') $name = (string)$n; }
        if ($type === 'spare_part' && $name === '') mutqan_json(422, ['status' => 'error', 'message' => 'اكتب اسم القطعة أو اخترها من الكتالوج.']);
        [$invoicePath, $invoiceHash] = fin_store_image('invoice_image', $techId, true);
        [$partPath] = fin_store_image('part_image', $techId, $type === 'spare_part');
        $dup = $pdo->prepare("SELECT id FROM mutqan_tech_expenses WHERE invoice_sha256=:h LIMIT 1");
        $dup->execute([':h' => $invoiceHash]);
        if ($dup->fetchColumn()) mutqan_json(409, ['status' => 'error', 'message' => 'صورة هذه الفاتورة مرفوعة من قبل؛ لا يمكن احتسابها مرتين.']);
        $meal = in_array(($in['meal_kind'] ?? ''), ['breakfast', 'lunch', 'dinner'], true) ? $in['meal_kind'] : null;
        $pdo->prepare("INSERT INTO mutqan_tech_expenses (technician_user_id, request_id, expense_type, meal_kind, catalog_item_id, item_name, quantity, purchase_price, sale_price, paid_from, invoice_image_path, invoice_sha256, part_image_path, note, pay_model_snapshot, status)
                       VALUES (:t,:r,:type,:meal,:cat,:name,:qty,:price,:sale,:paid,:inv,:hash,:part,:note,:pm,'new')")
            ->execute([':t' => $techId, ':r' => $requestId, ':type' => $type, ':meal' => $meal, ':cat' => $catalogId, ':name' => $name ?: null, ':qty' => $qty, ':price' => $price,
                ':sale' => isset($in['sale_price']) && is_numeric($in['sale_price']) ? max(0, (float)$in['sale_price']) : null,
                ':paid' => ($in['paid_from'] ?? '') === 'own_pocket' ? 'own_pocket' : 'cash_on_hand', ':inv' => $invoicePath, ':hash' => $invoiceHash, ':part' => $partPath,
                ':note' => mb_substr(trim((string)($in['note'] ?? '')), 0, 500) ?: null, ':pm' => $profile['pay_model']]);
        $id = (int)$pdo->lastInsertId();
        mutqan_audit($pdo, (int)$user['id'], 'submit_tech_expense', 'tech_expense', $id, ['type' => $type, 'amount' => round($price * $qty, 2), 'request_id' => $requestId]);
        foreach ($pdo->query("SELECT id FROM app_users WHERE role IN ('owner','operations') AND status='active'")->fetchAll() as $m)
            mutqan_notify($pdo, (int)$m['id'], 'فاتورة جديدة بانتظار المراجعة', 'فاتورة ' . ['spare_part' => 'قطعة غيار', 'fuel' => 'بنزين', 'meal' => 'وجبة', 'other' => 'مصروف'][$type] . ' بقيمة ' . round($price * $qty, 2) . ' ريال.', 'tech_expense', $id);
        mutqan_json(201, ['status' => 'success', 'id' => $id, 'message' => 'تم رفع الفاتورة. لن تُخصم من العهدة إلا بعد اعتمادها.']);
    }
    if ($action === 'review_expense') {
        $user = mutqan_require_user($pdo, FIN_MANAGERS);
        $decision = (string)($in['decision'] ?? '');
        if (!in_array($decision, ['approved', 'rejected', 'under_review'], true)) mutqan_json(422, ['status' => 'error', 'message' => 'القرار غير صالح.']);
        $pdo->beginTransaction();
        $s = $pdo->prepare("SELECT * FROM mutqan_tech_expenses WHERE id=:id FOR UPDATE");
        $s->execute([':id' => (int)($in['expense_id'] ?? 0)]); $e = $s->fetch();
        if (!$e) mutqan_json(404, ['status' => 'error', 'message' => 'الفاتورة غير موجودة.']);
        if (in_array($e['status'], ['approved', 'rejected'], true)) mutqan_json(409, ['status' => 'error', 'message' => 'تمت مراجعة هذه الفاتورة مسبقاً.']);
        $amount = round((float)$e['purchase_price'] * (float)$e['quantity'], 2);
        if (isset($in['approved_amount']) && is_numeric($in['approved_amount']) && $decision === 'approved') $amount = min($amount, max(0, round((float)$in['approved_amount'], 2)));
        $pdo->prepare("UPDATE mutqan_tech_expenses SET status=:s, reviewed_by=:u, reviewed_at=NOW(), review_note=:n WHERE id=:id")
            ->execute([':s' => $decision, ':u' => $user['id'], ':n' => mb_substr(trim((string)($in['review_note'] ?? '')), 0, 500) ?: null, ':id' => $e['id']]);
        if ($decision === 'approved' && $amount > 0) {
            $label = $e['expense_type'] === 'spare_part' ? 'شراء قطعة: ' . $e['item_name'] : ['fuel' => 'فاتورة بنزين', 'meal' => 'فاتورة وجبة', 'other' => 'مصروف'][$e['expense_type']] . ($e['item_name'] ? ': ' . $e['item_name'] : '');
            fin_ledger_add($pdo, (int)$e['technician_user_id'], $e['expense_type'] === 'spare_part' ? 'part_purchase' : 'expense', -$amount, $e['request_id'] ? (int)$e['request_id'] : null, 'tech_expense', (int)$e['id'], $e['pay_model_snapshot'], $label, (int)$user['id']);
        }
        if ($decision !== 'under_review') mutqan_notify($pdo, (int)$e['technician_user_id'], $decision === 'approved' ? 'تم اعتماد فاتورتك' : 'تم رفض فاتورتك', ($decision === 'approved' ? 'اعتُمد خصم ' . $amount . ' ريال من عهدتك.' : 'لم تُعتمد الفاتورة رقم ' . $e['id'] . '.') . ($in['review_note'] ?? '' ? ' ملاحظة: ' . $in['review_note'] : ''), 'tech_expense', (int)$e['id']);
        mutqan_audit($pdo, (int)$user['id'], 'review_tech_expense', 'tech_expense', (int)$e['id'], ['decision' => $decision, 'amount' => $amount]);
        $pdo->commit();
        mutqan_json(200, ['status' => 'success', 'message' => $decision === 'approved' ? 'تم الاعتماد والخصم من العهدة.' : ($decision === 'rejected' ? 'تم رفض الفاتورة.' : 'تم وضعها تحت المراجعة.')]);
    }

    // ───────────── BALANCE ADJUSTMENT & SETTLEMENT ─────────────
    if ($action === 'adjust') {
        $user = mutqan_require_user($pdo, ['owner']);
        $techId = fin_target($pdo, $user, $in['technician_id'] ?? 0);
        $amount = round((float)($in['amount'] ?? 0), 2);
        $note = trim((string)($in['note'] ?? ''));
        if ($amount == 0.0 || abs($amount) > 1000000 || $note === '') mutqan_json(422, ['status' => 'error', 'message' => 'أدخل مبلغ التعديل (موجب = على الفني، سالب = للفني) وسبباً واضحاً.']);
        $pdo->beginTransaction();
        $pdo->prepare("INSERT INTO app_audit_log (actor_user_id, action, entity_type, entity_id, details_json) VALUES (:a,'tech_balance_adjustment','technician',:t,:d)")
            ->execute([':a' => $user['id'], ':t' => $techId, ':d' => json_encode(['amount' => $amount, 'note' => $note], JSON_UNESCAPED_UNICODE)]);
        $auditId = (int)$pdo->lastInsertId();
        fin_ledger_add($pdo, $techId, 'adjustment', $amount, null, 'audit', $auditId, fin_profile($pdo, $techId)['pay_model'], 'تعديل من المالك: ' . $note, (int)$user['id']);
        mutqan_notify($pdo, $techId, 'تعديل على رصيدك', ($amount > 0 ? 'إضافة على حسابك ' : 'إضافة لصالحك ') . abs($amount) . ' ريال. السبب: ' . $note, 'finance', $techId);
        $pdo->commit();
        mutqan_json(200, ['status' => 'success', 'message' => 'تم تسجيل التعديل.', 'summary' => fin_summary($pdo, $techId)]);
    }
    if ($action === 'settle') {
        $user = mutqan_require_user($pdo, FIN_MANAGERS);
        $techId = fin_target($pdo, $user, $in['technician_id'] ?? 0);
        $amount = round((float)($in['amount'] ?? 0), 2);
        $direction = ($in['direction'] ?? '') === 'company_to_tech' ? 'company_to_tech' : 'tech_to_company';
        if ($amount <= 0) mutqan_json(422, ['status' => 'error', 'message' => 'أدخل مبلغ التسوية المستلم أو المدفوع فعلياً.']);
        $pdo->beginTransaction();
        $pdo->prepare("SELECT user_id FROM mutqan_tech_finance_profiles WHERE user_id=:t FOR UPDATE")->execute([':t' => $techId]);
        $before = fin_summary($pdo, $techId)['balance'];
        if (empty($in['ignore_pending'])) {
            $p = $pdo->prepare("SELECT COUNT(*) FROM mutqan_tech_expenses WHERE technician_user_id=:t AND status IN ('new','under_review')"); $p->execute([':t' => $techId]);
            if ((int)$p->fetchColumn() > 0) { $pdo->rollBack(); mutqan_json(409, ['status' => 'error', 'code' => 'PENDING_EXPENSES', 'message' => 'توجد فواتير لم تُراجع بعد. اعتمدها أو ارفضها قبل التسوية، أو أكّد التسوية مع تجاهلها.']); }
        }
        $pdo->prepare("INSERT INTO mutqan_tech_settlements (technician_user_id, balance_before, amount, direction, method, note, created_by) VALUES (:t,:b,:a,:d,:m,:n,:u)")
            ->execute([':t' => $techId, ':b' => $before, ':a' => $amount, ':d' => $direction, ':m' => mb_substr(trim((string)($in['method'] ?? 'cash')), 0, 60) ?: 'cash', ':n' => mb_substr(trim((string)($in['note'] ?? '')), 0, 500) ?: null, ':u' => $user['id']]);
        $sid = (int)$pdo->lastInsertId();
        fin_ledger_add($pdo, $techId, 'settlement', $direction === 'tech_to_company' ? -$amount : $amount, null, 'settlement', $sid, fin_profile($pdo, $techId)['pay_model'],
            $direction === 'tech_to_company' ? 'توريد نقدية من الفني' : 'دفع مستحقات للفني', (int)$user['id']);
        mutqan_audit($pdo, (int)$user['id'], 'tech_settlement', 'technician', $techId, ['settlement_id' => $sid, 'amount' => $amount, 'direction' => $direction, 'balance_before' => $before]);
        mutqan_notify($pdo, $techId, 'تسوية حساب', ($direction === 'tech_to_company' ? 'تم استلام توريد ' : 'تم صرف مستحقات ') . $amount . ' ريال.', 'finance', $techId);
        $pdo->commit();
        mutqan_json(200, ['status' => 'success', 'settlement_id' => $sid, 'message' => 'تمت التسوية.', 'summary' => fin_summary($pdo, $techId)]);
    }

    // ───────────── CATALOGUE SUGGESTIONS (technician proposes, management approves) ─────────────
    if ($action === 'suggest_item') {
        $user = mutqan_require_user($pdo, ['technician']);
        $profile = fin_profile($pdo, (int)$user['id']);
        if (empty($profile['can_suggest_catalog'])) mutqan_json(403, ['status' => 'error', 'message' => 'اقتراح الأصناف غير مفعّل لحسابك.']);
        $name = trim((string)($in['item_name'] ?? '')); $price = (float)($in['base_price'] ?? -1);
        if ($name === '' || mb_strlen($name) > 180 || $price < 0) mutqan_json(422, ['status' => 'error', 'message' => 'اكتب اسم القطعة وسعر البيع المقترح.']);
        $code = 'TMP-' . strtoupper(bin2hex(random_bytes(4)));
        $pdo->prepare("INSERT INTO mutqan_price_catalog (item_code,item_name,category,service_key,item_type,unit_name,base_price,purchase_price,visible_to_customer,visible_to_technician,is_active,approval_status,suggested_by,created_by,updated_by)
                       VALUES (:code,:name,:cat,:svc,'spare_part',:unit,:price,:pp,0,0,0,'pending',:u,:u,:u)")
            ->execute([':code' => $code, ':name' => $name, ':cat' => trim((string)($in['category'] ?? 'قطع غيار')) ?: 'قطع غيار', ':svc' => trim((string)($in['service_key'] ?? '')) ?: null,
                ':unit' => trim((string)($in['unit_name'] ?? 'قطعة')) ?: 'قطعة', ':price' => $price, ':pp' => isset($in['purchase_price']) && is_numeric($in['purchase_price']) ? (float)$in['purchase_price'] : null, ':u' => $user['id']]);
        $id = (int)$pdo->lastInsertId();
        mutqan_audit($pdo, (int)$user['id'], 'suggest_catalog_item', 'price_catalog', $id, ['item_name' => $name, 'base_price' => $price]);
        mutqan_json(201, ['status' => 'success', 'id' => $id, 'message' => 'تم إرسال الصنف للإدارة. يمكنك استخدامه كبند حر في التسعيرة حتى يُعتمد.']);
    }
    if ($action === 'review_suggestion') {
        $user = mutqan_require_user($pdo, FIN_MANAGERS);
        $id = (int)($in['id'] ?? 0); $approve = ($in['decision'] ?? '') === 'approved';
        $code = trim((string)($in['item_code'] ?? ''));
        if ($approve && ($code === '' || strlen($code) > 40)) mutqan_json(422, ['status' => 'error', 'message' => 'حدد كوداً نهائياً للقطعة قبل الاعتماد.']);
        $sql = $approve
            ? "UPDATE mutqan_price_catalog SET approval_status='approved', item_code=:code, base_price=COALESCE(:price, base_price), is_active=1, visible_to_technician=1, updated_by=:u WHERE id=:id AND approval_status='pending'"
            : "UPDATE mutqan_price_catalog SET approval_status='rejected', is_active=0, updated_by=:u WHERE id=:id AND approval_status='pending'";
        $p = [':u' => $user['id'], ':id' => $id];
        if ($approve) { $p[':code'] = $code; $p[':price'] = isset($in['base_price']) && is_numeric($in['base_price']) ? (float)$in['base_price'] : null; }
        $st = $pdo->prepare($sql); $st->execute($p);
        if (!$st->rowCount()) mutqan_json(409, ['status' => 'error', 'message' => 'الاقتراح غير موجود أو تمت مراجعته.']);
        mutqan_audit($pdo, (int)$user['id'], 'review_catalog_suggestion', 'price_catalog', $id, ['decision' => $approve ? 'approved' : 'rejected', 'item_code' => $code]);
        mutqan_json(200, ['status' => 'success', 'message' => $approve ? 'تم اعتماد الصنف وإضافته لجدول الأسعار.' : 'تم رفض الاقتراح.']);
    }

    mutqan_json(404, ['status' => 'error', 'message' => 'الإجراء المطلوب غير معروف.']);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) $pdo->rollBack();
    if ($e instanceof PDOException && ($e->errorInfo[1] ?? 0) === 1062) mutqan_json(409, ['status' => 'error', 'message' => 'هذه الحركة مسجلة مسبقاً؛ تم منع التكرار.']);
    error_log('MUTQAN finance API: ' . $e->getMessage());
    mutqan_json(500, ['status' => 'error', 'message' => 'تعذر تنفيذ العملية المالية حالياً. راجع سجل الخادم.']);
}
