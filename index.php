<?php
declare(strict_types=1);
/**
 * MUTQAN — PHP entry point.
 * The full interaction prototypes are kept under frontend/prototypes/.
 * This landing page submits a client and maintenance request to the modular API.
 */
?><!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#eef4fb"><title>مُتقن | OXYGEN للصيانة والمقاولات</title>
<style>
:root{--bg:#eef4fb;--blue:#0284c7;--navy:#0f172a;--muted:#64748b;--border:#d8e6f6}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--navy);font-family:Tahoma,Arial,sans-serif;line-height:1.7}
header{background:linear-gradient(135deg,#0f172a,#0369a1);color:#fff;padding:28px 20px}main{max-width:1000px;margin:24px auto;padding:0 16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:18px}
.card{background:#fff;border:1px solid var(--border);border-radius:18px;padding:22px;box-shadow:0 6px 20px #0f172a0b}.services{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.service{background:#f0f9ff;padding:14px;border-radius:12px;text-align:center;font-weight:700}
label{display:block;font-size:14px;font-weight:700;margin:12px 0 5px}input,textarea,select{width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:11px;font:inherit;background:#fff}button{border:0;border-radius:10px;background:var(--blue);color:white;padding:12px 18px;font:inherit;font-weight:700;cursor:pointer;margin-top:14px}button:disabled{opacity:.6}#result{white-space:pre-wrap;margin-top:12px;color:#0369a1}a{color:#fff}
small{color:var(--muted)}.toplinks{display:flex;gap:14px;flex-wrap:wrap;margin-top:8px}
</style></head>
<body>
<header><h1>❄ مُتقن MUTQAN</h1><p>منصة خدمات وصيانة ومقاولات — OXYGEN</p><div class="toplinks"><a href="frontend/prototypes/client-app-demo.html">معاينة واجهة العميل</a><a href="frontend/prototypes/operations-room-demo.html">غرفة العمليات</a><a href="frontend/prototypes/ai-whatsapp-invoices-demo.html">الذكاء الاصطناعي والفواتير</a></div></header>
<main>
<section class="card"><h2>خدماتنا</h2><div class="services"><div class="service">❄ التكييف والتبريد</div><div class="service">⚡ الكهرباء</div><div class="service">🔧 السباكة</div><div class="service">🧊 غرف التبريد</div><div class="service">🔒 الأقفال الذكية</div><div class="service">🛠 الصيانة العامة</div></div><p><small>ارسل طلبك عبر النموذج؛ يتطلب ذلك تثبيت قاعدة البيانات من database/schema.sql وضبط إعدادات backend/config/config.local.php.</small></p></section>
<section class="card"><h2>اطلب فني صيانة</h2><form id="requestForm"><label for="name">الاسم</label><input id="name" required maxlength="120"><label for="phone">رقم الهاتف</label><input id="phone" required maxlength="25" inputmode="tel"><label for="address">العنوان</label><input id="address" required maxlength="255"><label for="issue">تفاصيل العطل</label><textarea id="issue" required rows="4" maxlength="5000"></textarea><button id="submitBtn" type="submit">إرسال طلب الصيانة</button></form><div id="result" role="status" aria-live="polite"></div></section>
</main>
<script>
const form=document.getElementById('requestForm'),btn=document.getElementById('submitBtn'),result=document.getElementById('result');
async function api(system,payload){const res=await fetch('backend/api/api.php?system='+encodeURIComponent(system),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await res.json().catch(()=>({status:'error',message:'استجابة غير صالحة من الخادم'}));if(!res.ok||data.status!=='success')throw new Error(data.message||'تعذر تنفيذ الطلب');return data}
form.addEventListener('submit',async e=>{e.preventDefault();btn.disabled=true;result.textContent='جارٍ إرسال الطلب...';try{const client=await api('system_1_clients',{name:document.getElementById('name').value.trim(),phone:document.getElementById('phone').value.trim(),address:document.getElementById('address').value.trim()});const request=await api('system_3_requests',{client_id:client.inserted_id,issue:document.getElementById('issue').value.trim()});result.textContent='تم تسجيل طلب الصيانة رقم '+request.inserted_id;form.reset()}catch(err){result.textContent='لم يتم حفظ الطلب: '+err.message}finally{btn.disabled=false}});
</script></body></html>
