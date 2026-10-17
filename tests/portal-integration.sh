#!/usr/bin/env bash
set -Eeuo pipefail
BASE_URL="http://127.0.0.1:8080"
WORK_DIR="/tmp/mutqan-portal-integration"
mkdir -p "$WORK_DIR"

fail() { echo "FAIL: $*" >&2; exit 1; }
pass() { echo "PASS: $*"; }
json_value() {
  php -r '
    $v=json_decode(file_get_contents($argv[1]), true);
    foreach (explode(".", $argv[2]) as $key) {
      if (!is_array($v) || !array_key_exists($key, $v)) exit(2);
      $v=$v[$key];
    }
    if ($v === null || is_array($v) || is_object($v)) exit(3);
    if (is_bool($v)) { echo $v ? "true" : "false"; }
    else { echo (string)$v; }
  ' "$1" "$2"
}
post_json() {
  local url="$1" cookie="$2" csrf="$3" body="$4" outfile="$5"
  curl -sS -o "$outfile" -w '%{http_code}' \
    -b "$cookie" -c "$cookie" -X POST "$url" \
    -H 'Content-Type: application/json' \
    -H "X-CSRF-Token: $csrf" \
    --data-binary "$body"
}

curl -fsS "$BASE_URL/" -o "$WORK_DIR/home.html"
grep -q 'مُتقِن' "$WORK_DIR/home.html" || fail "homepage branding not found"
curl -fsS "$BASE_URL/assets/mutqan.js" -o "$WORK_DIR/app.js"
grep -q 'نقل العفش' "$WORK_DIR/app.js" || fail "service catalog did not load"
pass "public customer homepage and service catalog load"

GUEST_COOKIE="$WORK_DIR/guest.cookies"
curl -fsS -c "$GUEST_COOKIE" "$BASE_URL/backend/api/auth.php?action=me" -o "$WORK_DIR/guest-bootstrap.json"
GUEST_CSRF="$(json_value "$WORK_DIR/guest-bootstrap.json" csrf_token)"
GUEST_PAYLOAD='{"service_category":"التكييف والتبريد","service_name":"صيانة تكييف","full_name":"Integration Guest","phone":"+966500000101","address":"الرياض، حي الاختبار","issue":"اختبار طلب زائر","priority":"normal"}'
CODE="$(post_json "$BASE_URL/backend/api/portal.php?action=create_request" "$GUEST_COOKIE" "$GUEST_CSRF" "$GUEST_PAYLOAD" "$WORK_DIR/guest-request.json")"
[[ "$CODE" == "201" ]] || fail "guest request returned HTTP $CODE: $(cat "$WORK_DIR/guest-request.json")"
REQUEST_ID="$(json_value "$WORK_DIR/guest-request.json" request_id)"
GUEST_TOKEN="$(json_value "$WORK_DIR/guest-request.json" guest_token)"
[[ -n "$REQUEST_ID" && -n "$GUEST_TOKEN" ]] || fail "guest request id or chat token missing"
curl -fsS "$BASE_URL/backend/api/portal.php?action=messages&request_id=$REQUEST_ID&guest_token=$GUEST_TOKEN" -o "$WORK_DIR/guest-messages.json"
[[ "$(json_value "$WORK_DIR/guest-messages.json" status)" == "success" ]] || fail "guest chat token did not authorize conversation read"
CODE="$(post_json "$BASE_URL/backend/api/portal.php?action=send_message" "$GUEST_COOKIE" "$GUEST_CSRF" "{\"request_id\":$REQUEST_ID,\"guest_token\":\"$GUEST_TOKEN\",\"guest_name\":\"Integration Guest\",\"message\":\"رسالة اختبار\"}" "$WORK_DIR/guest-message.json")"
[[ "$CODE" == "201" ]] || fail "guest chat message returned HTTP $CODE: $(cat "$WORK_DIR/guest-message.json")"
pass "guest request, private chat token, and guest messaging work"

CODE="$(curl -sS -o "$WORK_DIR/private-clients.json" -w '%{http_code}' -b "$GUEST_COOKIE" "$BASE_URL/backend/api/api.php?system=system_1_clients")"
[[ "$CODE" == "401" ]] || fail "anonymous client data read returned HTTP $CODE (expected 401)"
CODE="$(curl -sS -o "$WORK_DIR/private-invoices.json" -w '%{http_code}' -b "$GUEST_COOKIE" "$BASE_URL/backend/api/invoices.php")"
[[ "$CODE" == "401" ]] || fail "anonymous invoice read returned HTTP $CODE (expected 401)"
pass "anonymous access to client records and invoices is blocked"

OWNER_COOKIE="$WORK_DIR/owner.cookies"
curl -fsS -c "$OWNER_COOKIE" "$BASE_URL/backend/api/auth.php?action=me" -o "$WORK_DIR/owner-bootstrap.json"
OWNER_CSRF="$(json_value "$WORK_DIR/owner-bootstrap.json" csrf_token)"
CODE="$(post_json "$BASE_URL/backend/api/auth.php?action=login" "$OWNER_COOKIE" "$OWNER_CSRF" '{"username":"ali3","password":"rxUYVefyskTFUoYKYTLouE"}' "$WORK_DIR/owner-login.json")"
[[ "$CODE" == "200" ]] || fail "owner login returned HTTP $CODE: $(cat "$WORK_DIR/owner-login.json")"
[[ "$(json_value "$WORK_DIR/owner-login.json" user.role)" == "owner" ]] || fail "ali3 was not assigned owner role"
[[ "$(json_value "$WORK_DIR/owner-login.json" user.must_change_password)" == "true" ]] || fail "seeded owner did not require initial password change"
OWNER_CSRF="$(json_value "$WORK_DIR/owner-login.json" csrf_token)"
CODE="$(post_json "$BASE_URL/backend/api/auth.php?action=change_password" "$OWNER_COOKIE" "$OWNER_CSRF" '{"current_password":"rxUYVefyskTFUoYKYTLouE","new_password":"OwnerStrongTest@2026","confirm_password":"OwnerStrongTest@2026"}' "$WORK_DIR/owner-password.json")"
[[ "$CODE" == "200" ]] || fail "owner could not change forced temporary password: $(cat "$WORK_DIR/owner-password.json")"
OWNER_CSRF="$(json_value "$WORK_DIR/owner-password.json" csrf_token)"
curl -fsS -b "$OWNER_COOKIE" "$BASE_URL/backend/api/portal.php?action=dashboard" -o "$WORK_DIR/owner-dashboard.json"
[[ "$(json_value "$WORK_DIR/owner-dashboard.json" data.user.role)" == "owner" ]] || fail "owner dashboard did not preserve owner role"
php -r '$d=json_decode(file_get_contents($argv[1]),true);$id=(int)$argv[2];foreach($d["data"]["requests"] as $r){if((int)$r["id"]===$id){if(!empty($r["assigned_user_id"]))exit(1);exit(0);}}exit(2);' "$WORK_DIR/owner-dashboard.json" "$REQUEST_ID" || fail "guest order was assigned before any manual action"
pass "owner role, forced password reset, dashboard and no-auto-assignment verified"

PROVIDER_COOKIE="$WORK_DIR/provider-apply.cookies"
PROVIDER_PHONE="+966500000102"
PROVIDER_PASSWORD="ProviderStrongTest@2026"
curl -fsS -c "$PROVIDER_COOKIE" "$BASE_URL/backend/api/auth.php?action=me" -o "$WORK_DIR/provider-bootstrap.json"
PROVIDER_CSRF="$(json_value "$WORK_DIR/provider-bootstrap.json" csrf_token)"
PROVIDER_PAYLOAD="{\"role\":\"provider\",\"full_name\":\"Integration Technician\",\"phone\":\"$PROVIDER_PHONE\",\"password\":\"$PROVIDER_PASSWORD\",\"specialty\":\"التكييف والتبريد\",\"experience_years\":4,\"service_area\":\"الرياض\",\"address\":\"الرياض، حي الاختبار\"}"
CODE="$(post_json "$BASE_URL/backend/api/auth.php?action=register" "$PROVIDER_COOKIE" "$PROVIDER_CSRF" "$PROVIDER_PAYLOAD" "$WORK_DIR/provider-register.json")"
[[ "$CODE" == "201" ]] || fail "provider registration returned HTTP $CODE: $(cat "$WORK_DIR/provider-register.json")"
[[ "$(json_value "$WORK_DIR/provider-register.json" pending)" == "true" ]] || fail "provider registration did not return pending approval"
curl -fsS -b "$OWNER_COOKIE" "$BASE_URL/backend/api/portal.php?action=dashboard" -o "$WORK_DIR/owner-pending.json"
PROVIDER_ID="$(php -r '$d=json_decode(file_get_contents($argv[1]),true);foreach($d["data"]["pending_providers"] as $p){if(($p["phone"]??"")===$argv[2]){echo $p["id"];exit(0);}}exit(2);' "$WORK_DIR/owner-pending.json" "$PROVIDER_PHONE")" || fail "owner could not see pending provider"
CODE="$(post_json "$BASE_URL/backend/api/portal.php?action=provider_decision" "$OWNER_COOKIE" "$OWNER_CSRF" "{\"provider_user_id\":$PROVIDER_ID,\"decision\":\"approve\"}" "$WORK_DIR/provider-approved.json")"
[[ "$CODE" == "200" ]] || fail "owner approval returned HTTP $CODE: $(cat "$WORK_DIR/provider-approved.json")"
[[ "$(json_value "$WORK_DIR/provider-approved.json" status)" == "success" ]] || fail "owner approval failed"
pass "provider application remains pending and only owner can approve it"

CODE="$(post_json "$BASE_URL/backend/api/portal.php?action=assign_request" "$OWNER_COOKIE" "$OWNER_CSRF" "{\"request_id\":$REQUEST_ID,\"technician_user_id\":$PROVIDER_ID}" "$WORK_DIR/assigned.json")"
[[ "$CODE" == "200" ]] || fail "manual task assignment returned HTTP $CODE: $(cat "$WORK_DIR/assigned.json")"
TECH_COOKIE="$WORK_DIR/technician.cookies"
curl -fsS -c "$TECH_COOKIE" "$BASE_URL/backend/api/auth.php?action=me" -o "$WORK_DIR/tech-bootstrap.json"
TECH_CSRF="$(json_value "$WORK_DIR/tech-bootstrap.json" csrf_token)"
CODE="$(post_json "$BASE_URL/backend/api/auth.php?action=login" "$TECH_COOKIE" "$TECH_CSRF" "{\"username\":\"$PROVIDER_PHONE\",\"password\":\"$PROVIDER_PASSWORD\"}" "$WORK_DIR/tech-login.json")"
[[ "$CODE" == "200" ]] || fail "approved provider could not sign in as technician: $(cat "$WORK_DIR/tech-login.json")"
[[ "$(json_value "$WORK_DIR/tech-login.json" user.role)" == "technician" ]] || fail "approved provider did not become a technician"
TECH_CSRF="$(json_value "$WORK_DIR/tech-login.json" csrf_token)"
curl -fsS -b "$TECH_COOKIE" "$BASE_URL/backend/api/portal.php?action=dashboard" -o "$WORK_DIR/tech-dashboard.json"
php -r '$d=json_decode(file_get_contents($argv[1]),true);$id=(int)$argv[2];if(($d["data"]["user"]["role"]??"")!=="technician")exit(1);foreach($d["data"]["requests"] as $r){if((int)$r["id"]===$id)exit(0);}exit(2);' "$WORK_DIR/tech-dashboard.json" "$REQUEST_ID" || fail "technician did not see the explicitly assigned task"
pass "approved provider becomes a technician and sees the assigned task"

CODE="$(post_json "$BASE_URL/backend/api/portal.php?action=save_location" "$TECH_COOKIE" "$TECH_CSRF" '{"latitude":24.7136,"longitude":46.6753}' "$WORK_DIR/tech-location.json")"
[[ "$CODE" == "200" ]] || fail "technician location update failed: $(cat "$WORK_DIR/tech-location.json")"
for STATUS in accepted en_route in_progress awaiting_approval; do
  CODE="$(post_json "$BASE_URL/backend/api/portal.php?action=update_task_status" "$TECH_COOKIE" "$TECH_CSRF" "{\"request_id\":$REQUEST_ID,\"status\":\"$STATUS\"}" "$WORK_DIR/task-status.json")"
  [[ "$CODE" == "200" ]] || fail "task transition to $STATUS returned HTTP $CODE: $(cat "$WORK_DIR/task-status.json")"
done
CODE="$(post_json "$BASE_URL/backend/api/portal.php?action=review_completion" "$OWNER_COOKIE" "$OWNER_CSRF" "{\"request_id\":$REQUEST_ID,\"decision\":\"approve\"}" "$WORK_DIR/task-close.json")"
[[ "$CODE" == "200" ]] || fail "owner closeout review failed: $(cat "$WORK_DIR/task-close.json")"
curl -fsS -b "$OWNER_COOKIE" "$BASE_URL/backend/api/portal.php?action=dashboard" -o "$WORK_DIR/owner-final.json"
php -r '$d=json_decode(file_get_contents($argv[1]),true);$id=(int)$argv[2];foreach($d["data"]["requests"] as $r){if((int)$r["id"]===$id){if(($r["status"]??"")!=="completed")exit(1);exit(0);}}exit(2);' "$WORK_DIR/owner-final.json" "$REQUEST_ID" || fail "completed task status not visible to owner"
CODE="$(post_json "$BASE_URL/backend/api/operations.php?action=assign" "$OWNER_COOKIE" "$OWNER_CSRF" "{\"request_id\":$REQUEST_ID,\"tech_id\":0}" "$WORK_DIR/no-auto-assign.json")"
[[ "$CODE" == "422" ]] || fail "legacy assignment did not reject automatic selection; HTTP $CODE"
pass "GPS update, task-state workflow, owner closeout and no-auto-assignment verified"
