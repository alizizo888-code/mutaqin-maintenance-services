<?php
declare(strict_types=1);
require_once __DIR__ . '/../helpers/portal.php';
require_once __DIR__ . '/../config/db.php';

mutqan_start_session();
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$action = (string)($_GET['action'] ?? 'catalog');
if ($method === 'OPTIONS') { http_response_code(204); exit; }

function pricing_settings(PDO $pdo): array {
    $row = $pdo->query("SELECT * FROM mutqan_pricing_settings WHERE id=1")->fetch();
    return $row ?: ['vat_enabled'=>1,'vat_rate'=>'15.00','prices_include_vat'=>0,'show_customer_prices'=>1,'show_technician_catalog'=>1];
}
function pricing_request(PDO $pdo, int $id): ?array {
    $s=$pdo->prepare("SELECT id,created_by_user_id,assigned_user_id,status FROM system_3_requests WHERE id=:id LIMIT 1");
    $s->execute([':id'=>$id]); return $s->fetch() ?: null;
}
function pricing_can_view(array $user, array $request): bool {
    return in_array($user['role'],['owner','operations'],true)
      || ($user['role']==='technician' && (int)$request['assigned_user_id']===(int)$user['id'])
      || ($user['role']==='client' && (int)$request['created_by_user_id']===(int)$user['id']);
}
try {
    $pdo=getDatabaseConnection();
    if ($method==='GET' && $action==='catalog') {
        $user=mutqan_require_user($pdo,['owner','operations','technician','client']);
        $settings=pricing_settings($pdo);
        if ($user['role']==='client' && empty($settings['show_parts_catalog_to_customer'])) mutqan_json(200,['status'=>'success','visible'=>false,'items'=>[]]);
        if ($user['role']==='technician' && empty($settings['show_technician_catalog'])) mutqan_json(200,['status'=>'success','visible'=>false,'items'=>[]]);
        $service=trim((string)($_GET['service_key']??''));
        $sql="SELECT id,item_code,item_name,category,service_key,item_type,unit_name,base_price,vat_rate,vat_exempt,min_price,max_price FROM mutqan_price_catalog WHERE is_active=1";
        $args=[];
        if ($user['role']==='technician') $sql.=" AND visible_to_technician=1";
        if ($user['role']==='client') $sql.=" AND visible_to_customer=1";
        if ($service!=='') { $sql.=" AND (service_key=:service OR service_key IS NULL OR service_key='')"; $args[':service']=$service; }
        $sql.=" ORDER BY category,item_name LIMIT 500";
        $q=$pdo->prepare($sql); $q->execute($args);
        $items=$q->fetchAll();
        foreach($items as &$item){
            $rate=empty($settings['vat_enabled'])||!empty($item['vat_exempt'])?0.0:(float)$item['vat_rate'];
            if (!empty($settings['prices_include_vat']) && $rate>0) {
                $item['vat_amount']=round((float)$item['base_price']*$rate/(100+$rate),2);
                $item['price_with_vat']=round((float)$item['base_price'],2);
                $item['base_price_ex_vat']=round((float)$item['base_price']-$item['vat_amount'],2);
            } else {
                $item['vat_amount']=round((float)$item['base_price']*$rate/100,2);
                $item['price_with_vat']=round((float)$item['base_price']+$item['vat_amount'],2);
                $item['base_price_ex_vat']=round((float)$item['base_price'],2);
            }
        }
        mutqan_json(200,['status'=>'success','visible'=>true,'settings'=>['vat_enabled'=>(bool)$settings['vat_enabled'],'vat_rate'=>(float)$settings['vat_rate'],'prices_include_vat'=>(bool)$settings['prices_include_vat'],'show_customer_prices'=>(bool)$settings['show_customer_prices'],'show_price_ranges'=>(bool)$settings['show_price_ranges'],'show_parts_catalog_to_customer'=>(bool)$settings['show_parts_catalog_to_customer'],'show_technician_prices'=>(bool)$settings['show_technician_prices'],'show_technician_catalog'=>(bool)$settings['show_technician_catalog']],'items'=>$items]);
    }
    if ($method==='GET' && $action==='ranges') {
        $user=mutqan_require_user($pdo,['owner','operations','technician','client']);
        $settings=pricing_settings($pdo);
        if (($user['role']==='client' && (empty($settings['show_customer_prices']) || empty($settings['show_price_ranges']))) || ($user['role']==='technician' && (empty($settings['show_technician_prices']) || empty($settings['show_price_ranges'])))) mutqan_json(200,['status'=>'success','visible'=>false,'ranges'=>[]]);
        $service=trim((string)($_GET['service_key']??''));
        $q=$pdo->prepare("SELECT service_key,issue_key,issue_label,min_price,max_price,vat_rate FROM mutqan_service_price_ranges WHERE is_active=1 AND (:service='' OR service_key=:service) ORDER BY service_key,issue_label");
        $q->execute([':service'=>$service]);
        mutqan_json(200,['status'=>'success','visible'=>true,'ranges'=>$q->fetchAll()]);
    }
    if ($method==='GET' && $action==='quote') {
        $user=mutqan_require_user($pdo,['owner','operations','technician','client']);
        $requestId=(int)($_GET['request_id']??0); $req=pricing_request($pdo,$requestId);
        if (!$req) mutqan_json(404,['status'=>'error','message'=>'الطلب غير موجود.']);
        if (!pricing_can_view($user,$req)) mutqan_json(403,['status'=>'error','message'=>'لا يمكنك الاطلاع على تسعير هذا الطلب.']);
        $q=$pdo->prepare("SELECT * FROM mutqan_request_quotes WHERE request_id=:id ORDER BY version_no DESC");
        $q->execute([':id'=>$requestId]); $quotes=$q->fetchAll();
        $lines=$pdo->prepare("SELECT l.* FROM mutqan_request_quote_lines l JOIN mutqan_request_quotes q ON q.id=l.quote_id WHERE q.request_id=:id ORDER BY q.version_no DESC,l.id");
        $lines->execute([':id'=>$requestId]);
        mutqan_json(200,['status'=>'success','quotes'=>$quotes,'lines'=>$lines->fetchAll()]);
    }
    if ($method!=='POST') mutqan_json(405,['status'=>'error','message'=>'طريقة الطلب غير مسموحة.']);
    mutqan_require_csrf(); $in=mutqan_input();

    if ($action==='settings') {
        $user=mutqan_require_user($pdo,['owner','operations']);
        $rate=(float)($in['vat_rate']??15);
        if ($rate<0 || $rate>100) mutqan_json(422,['status'=>'error','message'=>'نسبة الضريبة يجب أن تكون بين 0 و100.']);
        $pdo->prepare("UPDATE mutqan_pricing_settings SET vat_enabled=:enabled,vat_rate=:rate,prices_include_vat=:inclusive,show_customer_prices=:customer,show_price_ranges=:ranges,show_parts_catalog_to_customer=:customer_catalog,show_technician_prices=:tech_prices,show_technician_catalog=:tech_catalog,updated_by=:actor WHERE id=1")->execute([
          ':enabled'=>!empty($in['vat_enabled'])?1:0,':rate'=>$rate,':inclusive'=>!empty($in['prices_include_vat'])?1:0,
          ':customer'=>!empty($in['show_customer_prices'])?1:0,':ranges'=>!empty($in['show_price_ranges'])?1:0,':customer_catalog'=>!empty($in['show_parts_catalog_to_customer'])?1:0,
          ':tech_prices'=>!empty($in['show_technician_prices'])?1:0,':tech_catalog'=>!empty($in['show_technician_catalog'])?1:0,':actor'=>$user['id']]);
        mutqan_audit($pdo,(int)$user['id'],'update_pricing_settings','pricing_settings',1,['vat_rate'=>$rate,'vat_enabled'=>!empty($in['vat_enabled']),'show_customer_prices'=>!empty($in['show_customer_prices']),'show_price_ranges'=>!empty($in['show_price_ranges']),'show_parts_catalog_to_customer'=>!empty($in['show_parts_catalog_to_customer']),'show_technician_prices'=>!empty($in['show_technician_prices']),'show_technician_catalog'=>!empty($in['show_technician_catalog'])]);
        mutqan_json(200,['status'=>'success','message'=>'تم حفظ إعدادات التسعير والضريبة.']);
    }
    if ($action==='save_item') {
        $user=mutqan_require_user($pdo,['owner','operations']);
        $id=(int)($in['id']??0); $name=trim((string)($in['item_name']??'')); $code=trim((string)($in['item_code']??''));
        $category=trim((string)($in['category']??'')); $price=(float)($in['base_price']??-1);
        if ($name===''||$code===''||$category===''||$price<0||strlen($code)>40) mutqan_json(422,['status'=>'error','message'=>'أدخل كود القطعة واسمها وتصنيفها وسعراً صحيحاً.']);
        $data=[':code'=>$code,':name'=>$name,':category'=>$category,':service'=>trim((string)($in['service_key']??''))?:null,':type'=>in_array(($in['item_type']??''),['spare_part','service','installation','labor','other'],true)?$in['item_type']:'spare_part',':unit'=>trim((string)($in['unit_name']??'قطعة')),':price'=>$price,':vat'=>(float)($in['vat_rate']??pricing_settings($pdo)['vat_rate']),':exempt'=>!empty($in['vat_exempt'])?1:0,':min'=>isset($in['min_price'])?(float)$in['min_price']:null,':max'=>isset($in['max_price'])?(float)$in['max_price']:null,':customer'=>!empty($in['visible_to_customer'])?1:0,':tech'=>!empty($in['visible_to_technician'])?1:0,':active'=>!isset($in['is_active'])||!empty($in['is_active'])?1:0,':actor'=>$user['id']];
        if ($id>0) { $data[':id']=$id; $pdo->prepare("UPDATE mutqan_price_catalog SET item_code=:code,item_name=:name,category=:category,service_key=:service,item_type=:type,unit_name=:unit,base_price=:price,vat_rate=:vat,vat_exempt=:exempt,min_price=:min,max_price=:max,visible_to_customer=:customer,visible_to_technician=:tech,is_active=:active,updated_by=:actor WHERE id=:id")->execute($data); }
        else { $pdo->prepare("INSERT INTO mutqan_price_catalog (item_code,item_name,category,service_key,item_type,unit_name,base_price,vat_rate,vat_exempt,min_price,max_price,visible_to_customer,visible_to_technician,is_active,created_by,updated_by) VALUES (:code,:name,:category,:service,:type,:unit,:price,:vat,:exempt,:min,:max,:customer,:tech,:active,:actor,:actor)")->execute($data); $id=(int)$pdo->lastInsertId(); }
        mutqan_audit($pdo,(int)$user['id'],'save_catalog_item','price_catalog',$id,['item_code'=>$code,'item_name'=>$name,'base_price'=>$price]);
        mutqan_json(200,['status'=>'success','id'=>$id,'message'=>'تم حفظ بند التسعير.']);
    }
    if ($action==='save_range') {
        $user=mutqan_require_user($pdo,['owner','operations']);
        $service=trim((string)($in['service_key']??'')); $key=trim((string)($in['issue_key']??'')); $label=trim((string)($in['issue_label']??'')); $min=(float)($in['min_price']??-1); $max=(float)($in['max_price']??-1);
        if (!$service||!$key||!$label||$min<0||$max<$min) mutqan_json(422,['status'=>'error','message'=>'بيانات نطاق السعر غير صحيحة.']);
        $pdo->prepare("INSERT INTO mutqan_service_price_ranges (service_key,issue_key,issue_label,min_price,max_price,vat_rate,is_active,created_by,updated_by) VALUES (:service,:key,:label,:min,:max,:vat,1,:actor,:actor) ON DUPLICATE KEY UPDATE issue_label=VALUES(issue_label),min_price=VALUES(min_price),max_price=VALUES(max_price),vat_rate=VALUES(vat_rate),is_active=1,updated_by=VALUES(updated_by)")->execute([':service'=>$service,':key'=>$key,':label'=>$label,':min'=>$min,':max'=>$max,':vat'=>(float)($in['vat_rate']??pricing_settings($pdo)['vat_rate']),':actor'=>$user['id']]);
        mutqan_audit($pdo,(int)$user['id'],'save_service_price_range','service_price_range',null,['service_key'=>$service,'issue_key'=>$key,'min_price'=>$min,'max_price'=>$max]);
        mutqan_json(200,['status'=>'success','message'=>'تم حفظ نطاق سعر الخدمة.']);
    }
    if ($action==='create_quote') {
        $user=mutqan_require_user($pdo,['owner','operations','technician']);
        $requestId=(int)($in['request_id']??0); $req=pricing_request($pdo,$requestId);
        if (!$req) mutqan_json(404,['status'=>'error','message'=>'الطلب غير موجود.']);
        if ($user['role']==='technician' && (int)$req['assigned_user_id']!==(int)$user['id']) mutqan_json(403,['status'=>'error','message'=>'يمكنك تسعير الطلبات المسندة إليك فقط.']);
        if (in_array($req['status'],['completed','cancelled'],true)) mutqan_json(409,['status'=>'error','message'=>'لا يمكن إصدار تسعير لطلب مغلق.']);
        $lines=$in['lines']??[]; if (!is_array($lines)||count($lines)<1||count($lines)>50) mutqan_json(422,['status'=>'error','message'=>'أضف بنداً واحداً على الأقل وبحد أقصى 50 بنداً.']);
        $settings=pricing_settings($pdo); $subtotal=0.0; $vatTotal=0.0; $prepared=[];
        foreach($lines as $line){
            $catalogId=(int)($line['catalog_item_id']??0); $qty=(float)($line['quantity']??1); $price=(float)($line['unit_price']??-1);
            if($qty<=0||$qty>10000||$price<0) mutqan_json(422,['status'=>'error','message'=>'الكمية أو السعر غير صحيح.']);
            $item=null;
            if($catalogId>0){$s=$pdo->prepare("SELECT id,item_code,item_name,base_price,vat_rate,vat_exempt FROM mutqan_price_catalog WHERE id=:id AND is_active=1 LIMIT 1");$s->execute([':id'=>$catalogId]);$item=$s->fetch();if(!$item)mutqan_json(422,['status'=>'error','message'=>'أحد بنود الكتالوج لم يعد متاحاً.']);}
            $name=trim((string)($line['item_name']??($item['item_name']??''))); if($name==='')mutqan_json(422,['status'=>'error','message'=>'اسم البند مطلوب.']);
            $rate=empty($settings['vat_enabled'])?0.0:(float)($item['vat_rate']??$settings['vat_rate']); $exempt=!empty($item['vat_exempt']);
            $entered=round($qty*$price,2);
            if ($exempt || empty($settings['vat_enabled'])) { $net=$entered; $tax=0.0; $total=$entered; }
            elseif (!empty($settings['prices_include_vat'])) { $total=$entered; $tax=round($entered*$rate/(100+$rate),2); $net=round($entered-$tax,2); }
            else { $net=$entered; $tax=round($net*$rate/100,2); $total=round($net+$tax,2); }
            $subtotal+=$net; $vatTotal+=$tax;
            $prepared[]=['catalog_item_id'=>$catalogId?:null,'item_code'=>$item['item_code']??null,'item_name'=>$name,'description'=>trim((string)($line['description']??'')),'quantity'=>$qty,'unit_price'=>$price,'vat_rate'=>$rate,'vat_exempt'=>$exempt?1:0,'line_subtotal'=>$net,'line_vat'=>$tax,'line_total'=>$total,'is_custom'=>$item?0:1];
        }
        $pdo->beginTransaction();
        $v=$pdo->prepare("SELECT COALESCE(MAX(version_no),0)+1 FROM mutqan_request_quotes WHERE request_id=:id");$v->execute([':id'=>$requestId]);$version=(int)$v->fetchColumn();
        $pdo->prepare("UPDATE mutqan_request_quotes SET status='superseded' WHERE request_id=:id AND status='pending_customer'")->execute([':id'=>$requestId]);
        $total=round($subtotal+$vatTotal,2);
        $pdo->prepare("INSERT INTO mutqan_request_quotes (request_id,version_no,created_by,status,subtotal,vat_amount,total_amount,customer_note) VALUES (:request,:version,:actor,'pending_customer',:subtotal,:vat,:total,:note)")->execute([':request'=>$requestId,':version'=>$version,':actor'=>$user['id'],':subtotal'=>$subtotal,':vat'=>$vatTotal,':total'=>$total,':note'=>trim((string)($in['customer_note']??''))]);
        $quoteId=(int)$pdo->lastInsertId();
        $insert=$pdo->prepare("INSERT INTO mutqan_request_quote_lines (quote_id,catalog_item_id,item_code,item_name,description,quantity,unit_price,vat_rate,vat_exempt,line_subtotal,line_vat,line_total,is_custom) VALUES (:quote,:catalog,:code,:name,:description,:qty,:price,:rate,:exempt,:subtotal,:vat,:total,:custom)");
        foreach($prepared as $line)$insert->execute([':quote'=>$quoteId,':catalog'=>$line['catalog_item_id'],':code'=>$line['item_code'],':name'=>$line['item_name'],':description'=>$line['description'],':qty'=>$line['quantity'],':price'=>$line['unit_price'],':rate'=>$line['vat_rate'],':exempt'=>$line['vat_exempt'],':subtotal'=>$line['line_subtotal'],':vat'=>$line['line_vat'],':total'=>$line['line_total'],':custom'=>$line['is_custom']]);
        if(!empty($req['created_by_user_id'])) mutqan_notify($pdo,(int)$req['created_by_user_id'],'تحديث سعر طلب الصيانة','تم إرسال تسعيرة جديدة للطلب رقم '.$requestId.' بإجمالي '.$total.' ريال. يرجى مراجعتها والموافقة أو الرفض.','quote',$quoteId);
        mutqan_audit($pdo,(int)$user['id'],'create_request_quote','request_quote',$quoteId,['request_id'=>$requestId,'version'=>$version,'subtotal'=>$subtotal,'vat'=>$vatTotal,'total'=>$total]);
        $pdo->commit();
        mutqan_json(200,['status'=>'success','quote_id'=>$quoteId,'version_no'=>$version,'subtotal'=>round($subtotal,2),'vat_amount'=>round($vatTotal,2),'total_amount'=>$total,'message'=>'تم إرسال التسعيرة للعميل بانتظار موافقته.']);
    }
    if ($action==='decide_quote') {
        $user=mutqan_require_user($pdo,['client','owner','operations']);
        $quoteId=(int)($in['quote_id']??0); $decision=(string)($in['decision']??'');
        if(!in_array($decision,['approved','rejected'],true))mutqan_json(422,['status'=>'error','message'=>'القرار غير صالح.']);
        $s=$pdo->prepare("SELECT q.*,r.created_by_user_id,r.status AS request_status FROM mutqan_request_quotes q JOIN system_3_requests r ON r.id=q.request_id WHERE q.id=:id LIMIT 1");$s->execute([':id'=>$quoteId]);$quote=$s->fetch();
        if(!$quote)mutqan_json(404,['status'=>'error','message'=>'التسعيرة غير موجودة.']);
        if($user['role']==='client'&&(int)$quote['created_by_user_id']!==(int)$user['id'])mutqan_json(403,['status'=>'error','message'=>'لا يمكنك اتخاذ قرار على تسعيرة طلب لا يخصك.']);
        if($quote['status']!=='pending_customer')mutqan_json(409,['status'=>'error','message'=>'هذه التسعيرة لم تعد بانتظار القرار.']);
        $pdo->beginTransaction();
        $pdo->prepare("UPDATE mutqan_request_quotes SET status=:status,customer_decided_by=:actor,customer_decided_at=NOW() WHERE id=:id")->execute([':status'=>$decision,':actor'=>$user['id'],':id'=>$quoteId]);
        if($decision==='approved')$pdo->prepare("UPDATE mutqan_request_quotes SET status='superseded' WHERE request_id=:request AND id<>:id AND status='pending_customer'")->execute([':request'=>$quote['request_id'],':id'=>$quoteId]);
        mutqan_audit($pdo,(int)$user['id'],'decide_request_quote','request_quote',$quoteId,['decision'=>$decision,'total_amount'=>$quote['total_amount']]);
        $pdo->commit();
        mutqan_json(200,['status'=>'success','message'=>$decision==='approved'?'تم اعتماد التسعيرة.':'تم رفض التسعيرة.']);
    }
    mutqan_json(404,['status'=>'error','message'=>'الإجراء المطلوب غير معروف.']);
} catch (Throwable $e) {
    if(isset($pdo)&&$pdo instanceof PDO&&$pdo->inTransaction())$pdo->rollBack();
    error_log('MUTQAN pricing API: '.$e->getMessage());
    mutqan_json(500,['status'=>'error','message'=>'تعذر تنفيذ عملية التسعير حالياً. راجع سجل الخادم.']);
}
