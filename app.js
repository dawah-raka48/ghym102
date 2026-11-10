/* Transfer portal frontend. Set API_URL after deploying Code.gs. */
const API_URL = "https://script.google.com/macros/s/AKfycbz-wChA5irsqcVjnGw_2G8aAadrEpCKwfQqHW0DkFuGHPGLpJAHZTWNhE12rUS21STHjQ/exec";
const $ = (id) => document.getElementById(id);
const state = { token:"", user:null, transfers:[], view:"", filters:{status:"",query:""} };
const statuses = { PENDING:"قيد المراجعة", ACCEPTED:"تم التأكد من التحويل", INVOICE_PENDING:"بانتظار إصدار الفاتورة", COMPLETED:"تم التأكد من الفاتورة", RETURNED:"معاد للتصحيح", REJECTED:"مرفوض" };
function esc(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function money(v){return new Intl.NumberFormat("ar-SA",{style:"currency",currency:"SAR",maximumFractionDigits:2}).format(Number(v)||0)}
function today(){return new Date().toLocaleDateString("ar-SA",{weekday:"long",year:"numeric",month:"long",day:"numeric"});}
function toast(msg){const el=$("toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),3200);}
function statusTag(s){const cls={PENDING:"pending",ACCEPTED:"accepted",INVOICE_PENDING:"invoice",COMPLETED:"done",RETURNED:"returned",REJECTED:"rejected"}[s]||"pending";return '<span class="status '+cls+'">'+esc(statuses[s]||s)+'</span>';}
async function api(action,data={}){
  if(!API_URL) throw new Error("لم يتم إعداد رابط الخادم. تواصل مع مسؤول النظام.");
  let response;
  try {
    response = await fetch(API_URL,{
      method:"POST",
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify({action,token:state.token,...data})
    });
  } catch (_) {
    throw new Error("تعذر الاتصال بالخادم. تحقق من نشر Apps Script كتطبيق ويب وإتاحة الوصول إليه.");
  }
  let result;
  try { result = await response.json(); }
  catch (_) { throw new Error("استجابة الخادم غير صالحة. تحقق من نشر آخر إصدار من Apps Script."); }
  if(!result || result.ok!==true) throw new Error(result?.error||"تعذر تنفيذ الطلب.");
  return result;
}
function saveSession(){try{sessionStorage.setItem("ghaymPortalSession",JSON.stringify({token:state.token,user:state.user}));}catch(_){}}
function clearSession(){try{sessionStorage.removeItem("ghaymPortalSession");}catch(_){}}

function showLogin(){ $("loginView").classList.remove("hidden");$("dashboardView").classList.add("hidden");$("logoutBtn").classList.add("hidden");state.token="";state.user=null;clearSession();clearOtpFields();focusOtp(0);}
function showDashboard(user){clearOtpFields();state.user=user;$("loginView").classList.add("hidden");$("dashboardView").classList.remove("hidden");$("logoutBtn").classList.remove("hidden");$("welcomeTitle").textContent="أهلًا، "+state.user.name;$("welcomeSub").textContent=state.user.role==="ACCOUNTANT"?"مراجعة التحويلات وتأكيد الفواتير":"رفع التحويلات ومتابعة حالتها";$("roleBadge").textContent=state.user.role==="ACCOUNTANT"?"المحاسب العام":"موظف إدخال البيانات";actions();}
function renderStats(){const all=state.transfers;const total=all.reduce((a,t)=>a+Number(t.amount||0),0);const pending=all.filter(t=>t.status==="PENDING").length;const invoiced=all.filter(t=>t.status==="COMPLETED").length;const cards=[["إجمالي التحويلات",all.length],["إجمالي المبالغ",money(total)],["قيد المراجعة",pending],["فواتير مؤكدة",invoiced]];$("statsGrid").innerHTML=cards.map(([l,v])=>'<article class="stat-card"><span>'+l+'</span><b>'+esc(v)+'</b><small>حسب صلاحيتك</small></article>').join("");}
function actions(){const isAcc=state.user.role==="ACCOUNTANT";const list=isAcc?[["review","مراجعة التحويلات","مراجعة الإيصالات وتحديث الحالة","✓"],["reports","التقارير الأسبوعية","تقرير أسبوعي للتحويلات والمبالغ والحالات بصيغة PDF","▤"],["audit","سجل التدقيق","متابعة التغييرات والإجراءات","◷"]]:[["new","رفع تحويل جديد","إدخال بيانات الطالب وإيصال PDF","＋"],["mine","تحويلاتي","متابعة الطلبات التي رفعتها","▤"],["reports","التقارير الأسبوعية","تقرير أسبوعي لعملياتك ومبالغها بصيغة PDF","◷"]];$("actionGrid").innerHTML=list.map(([v,t,d,i])=>'<button class="action-card" data-view="'+v+'"><span class="action-icon">'+i+'</span><b>'+t+'</b><small>'+d+'</small></button>').join("");const icons={review:"▤",reports:"▥",audit:"◷",new:"＋",mine:"▣"};$("sidebarNav").innerHTML='<button class="sidebar-link active" data-home><span class="sidebar-link-icon">⌂</span><span>الرئيسية</span></button>'+list.map(([v,t])=>'<button class="sidebar-link" data-view="'+v+'"><span class="sidebar-link-icon">'+icons[v]+'</span><span>'+t+'</span></button>').join("");$("topUserName").textContent=state.user.name;$("topUserRole").textContent=isAcc?"المحاسب العام":"المساعدة الإدارية";}
function table(items,withActions=false){if(!items.length)return '<div class="empty">لا توجد عمليات مطابقة حتى الآن.</div>';const isAcc=state.user&&state.user.role==="ACCOUNTANT",isEntry=state.user&&state.user.role==="DATA_ENTRY";return '<div class="table-wrap"><table><thead><tr><th>الرقم المرجعي</th><th>اسم الطالب</th><th>المبلغ</th><th>الفترة المسددة</th><th>الحالة</th><th>تاريخ الرفع</th><th>الإجراء</th></tr></thead><tbody>'+items.map(t=>'<tr><td data-label="الرقم المرجعي">'+esc(t.transferId)+'</td><td data-label="اسم الطالب">'+esc(t.studentName)+'</td><td data-label="المبلغ">'+money(t.amount)+'</td><td data-label="الفترة المسددة">'+esc(t.period)+'</td><td data-label="الحالة">'+statusTag(t.status)+'</td><td data-label="تاريخ الرفع">'+esc(t.createdAt||"")+'</td><td data-label="الإجراء"><div class="row-actions"><button class="btn ghost small" data-detail="'+esc(t.transferId)+'" title="التفاصيل" aria-label="التفاصيل">التفاصيل</button>'+(withActions?'<button class="btn primary small" data-review="'+esc(t.transferId)+'">مراجعة</button>':"")+(isAcc?'<button class="btn ghost small icon-action edit-action" data-edit="'+esc(t.transferId)+'" title="تعديل العملية" aria-label="تعديل العملية">✎</button><button class="btn ghost small icon-action delete-action" data-delete="'+esc(t.transferId)+'" title="حذف العملية" aria-label="حذف العملية">⌫</button>':(isEntry&&t.status==="RETURNED"?'<button class="btn ghost small icon-action edit-action" data-edit-returned="'+esc(t.transferId)+'" title="تصحيح العملية المعادة" aria-label="تصحيح العملية المعادة">✎ تصحيح</button>':""))+'</div></td></tr>').join("")+'</tbody></table></div>';}
function renderRecent(){
 const all=state.transfers;
 const defs=[["COMPLETED","تم التأكد من الفاتورة","#0b8b78"],["PENDING","قيد المراجعة","#e2ad4e"],["ACCEPTED","تم التأكد من التحويل","#4e91d8"],["INVOICE_PENDING","بانتظار الفاتورة","#9874d8"],["RETURNED","معاد للتصحيح","#d97878"],["REJECTED","مرفوض","#87939d"]];
 const data=defs.map(([key,label,color])=>({key,label,color,count:all.filter(t=>t.status===key).length})).filter(x=>x.count>0);
 const total=all.length, sum=data.reduce((a,x)=>a+x.count,0);
 const segments=data.map(x=>x.count).join(" ");
 const gradient=[];let cursor=0;
 data.forEach(x=>{const end=cursor+(total?x.count/total*100:0);gradient.push(x.color+" "+cursor.toFixed(2)+"% "+end.toFixed(2)+"%");cursor=end;});
 const chart=$("statusChart"),bars=$("statusBars");
 if(!chart||!bars)return;
 chart.innerHTML=total?'<div class="donut-wrap"><div class="donut-chart" style="background:conic-gradient('+gradient.join(",")+')"><div class="donut-hole"><b>'+total+'</b><small>إجمالي التحويلات</small></div></div><div class="chart-legend">'+data.map(x=>'<div class="legend-item"><span class="legend-dot" style="background:'+x.color+'"></span><span>'+esc(x.label)+'</span><b>'+x.count+'</b></div>').join("")+'</div></div>':'<div class="chart-empty">لا توجد تحويلات مسجلة حتى الآن</div>';
 const max=Math.max(1,...data.map(x=>x.count));
 bars.innerHTML=data.length?data.map(x=>'<div class="bar-row"><div class="bar-label"><span>'+esc(x.label)+'</span><b>'+x.count+'</b></div><div class="bar-track"><span style="width:'+(x.count/max*100).toFixed(1)+'%;background:'+x.color+'"></span></div></div>').join(""):'<div class="chart-empty">ستظهر المقارنة بعد تسجيل التحويلات</div>';
}
async function loadTransfers(){const r=await api("listTransfers");state.transfers=r.transfers||[];renderStats();renderRecent();}
function openView(view){state.view=view;$("recentPanel").classList.add("hidden");$("contentPanel").classList.remove("hidden");$("contentTitle").textContent=({new:"رفع تحويل جديد",mine:"تحويلاتي",reports:"ملخص التقرير المالي",review:"مراجعة التحويلات",audit:"سجل التدقيق"})[view]||"التحويلات";const body=$("contentBody");if(view==="new"){body.innerHTML='<form id="transferForm"><div class="form-grid"><div class="field"><label for="studentName">اسم الطالب *</label><input id="studentName" required maxlength="160" placeholder="الاسم الكامل"></div><div class="field"><label for="amount">قيمة التحويل (ريال) *</label><input id="amount" type="number" min="0.01" step="0.01" required placeholder="0.00"></div><div class="field"><label for="period">الفترة المسددة *</label><input id="period" required maxlength="120" placeholder="مثال: سبتمبر 2026 أو الفصل الأول"></div><div class="field"><label for="receipt">إيصال التحويل PDF *</label><input id="receipt" type="file" accept="application/pdf,.pdf" required><small>PDF فقط، الحد الأقصى 8 ميجابايت.</small></div><div class="field full-row"><label for="notes">ملاحظات</label><textarea id="notes" maxlength="1500" placeholder="ملاحظات إضافية إن وجدت"></textarea></div></div><div class="form-actions"><button class="btn primary" type="submit">رفع التحويل وإرساله للمراجعة</button><button class="btn ghost" type="reset">مسح الحقول</button></div></form>';$("transferForm").addEventListener("submit",submitTransfer);return;}
if(view==="review"||view==="mine"){const list=state.transfers.filter(t=>view!=="review"||["PENDING","RETURNED","ACCEPTED","INVOICE_PENDING"].includes(t.status));body.innerHTML='<div class="filters"><input class="filter-input" id="searchFilter" placeholder="بحث باسم الطالب أو رقم التحويل"><select class="filter-input" id="statusFilter"><option value="">كل الحالات</option>'+Object.entries(statuses).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join("")+'</select></div><div id="viewTable">'+table(list,view==="review")+'</div>';$("searchFilter").addEventListener("input",filterTable);$("statusFilter").addEventListener("change",filterTable);return;}
if(view==="reports"){const all=state.transfers,total=all.reduce((a,t)=>a+Number(t.amount||0),0);body.innerHTML='<div class="filters"><input class="filter-input" id="reportSearch" placeholder="بحث بالطالب أو الرقم"><select class="filter-input" id="reportStatus"><option value="">كل الحالات</option>'+Object.entries(statuses).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join("")+'</select><button class="btn primary" id="exportPdf">تصدير التقرير PDF</button></div><div id="reportTable">'+table(all)+'</div>';$("reportSearch").addEventListener("input",filterReport);$("reportStatus").addEventListener("change",filterReport);$("exportPdf").addEventListener("click",exportPdf);return;}
if(view==="audit"){body.innerHTML='<p class="muted">جارٍ تحميل سجل التدقيق…</p>';api("listAudit").then(r=>{body.innerHTML=tableAudit(r.events||[])}).catch(e=>toast(e.message));}}
function filterTable(){const q=$("searchFilter").value.toLowerCase(),s=$("statusFilter").value;const a=state.transfers.filter(t=>(state.view!=="review"||["PENDING","RETURNED","ACCEPTED","INVOICE_PENDING"].includes(t.status))&&(!s||t.status===s)&&((t.studentName+" "+t.transferId).toLowerCase().includes(q)));$("viewTable").innerHTML=table(a,state.view==="review");}
function filterReport(){const q=$("reportSearch").value.toLowerCase(),s=$("reportStatus").value;const a=state.transfers.filter(t=>(!s||t.status===s)&&((t.studentName+" "+t.transferId).toLowerCase().includes(q)));$("reportTable").innerHTML=table(a);}
function tableAudit(items){if(!items.length)return '<div class="empty">لا توجد أحداث مسجلة.</div>';return '<div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>المستخدم</th><th>الإجراء</th><th>رقم التحويل</th><th>التفاصيل</th></tr></thead><tbody>'+items.map(x=>'<tr><td>'+esc(x.at)+'</td><td>'+esc(x.userName)+'</td><td>'+esc(x.action)+'</td><td>'+esc(x.transferId||"—")+'</td><td>'+esc(x.details||"")+'</td></tr>').join("")+'</tbody></table></div>';}
async function submitTransfer(e){e.preventDefault();const f=$("receipt").files[0];if(!f||f.type!=="application/pdf"&&!f.name.toLowerCase().endsWith(".pdf"))return toast("اختر إيصالًا بصيغة PDF");if(f.size>8*1024*1024)return toast("حجم الملف يتجاوز 8 ميجابايت");const b=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(",")[1]);r.onerror=rej;r.readAsDataURL(f)});const btn=e.submitter;btn.disabled=true;btn.textContent="جارٍ الرفع…";try{await api("createTransfer",{studentName:$("studentName").value.trim(),amount:Number($("amount").value),period:$("period").value.trim(),notes:$("notes").value.trim(),fileName:f.name,mimeType:"application/pdf",fileBase64:b});toast("تم رفع التحويل بنجاح، والحالة الآن: قيد المراجعة. تم إرساله للمحاسب العام.");await loadTransfers();openView("mine");}catch(err){toast(err.message)}finally{btn.disabled=false;btn.textContent="رفع التحويل وإرساله للمراجعة";}}
async function showDetail(id){const t=state.transfers.find(x=>x.transferId===id);if(!t)return;const body=$("contentBody");$("contentPanel").classList.remove("hidden");$("contentTitle").textContent="تفاصيل التحويل "+id;body.innerHTML=(t.status==="COMPLETED"?'<div class="notice">تم التأكد من الفاتورة، نأمل مراجعة النظام المحاسبي لطباعة الفاتورة.</div>':"")+'<div class="detail-grid">'+[['الطالب',t.studentName],['قيمة التحويل',money(t.amount)],['الفترة المسددة',t.period],['الحالة',statuses[t.status]||t.status],['تاريخ الرفع',t.createdAt],['الموظف',t.createdByName],['رقم الفاتورة',t.invoiceNumber||"لم تسجل بعد"],['ملاحظات',t.notes||"لا توجد"]].map(([k,v])=>'<div class="detail-item"><small>'+k+'</small><b>'+esc(v)+'</b></div>').join("")+'</div><div class="form-actions"><button class="btn ghost" id="receiptBtn">عرض إيصال PDF</button>'+(state.user.role==="ACCOUNTANT"&&t.status!=="COMPLETED"?'<button class="btn primary" id="reviewBtn">إجراءات المحاسب</button>':"")+'</div>'+(t.reviewNotes?'<p class="muted">ملاحظات المراجعة: '+esc(t.reviewNotes)+'</p>':"");$("receiptBtn").onclick=()=>getReceipt(id);if(t.invoiceAttached){body.querySelector(".form-actions").insertAdjacentHTML("beforeend",'<button class="btn ghost" id="invoiceReceiptBtn">عرض الفاتورة PDF</button>');$("invoiceReceiptBtn").onclick=()=>getInvoice(id);}if($("reviewBtn"))$("reviewBtn").onclick=()=>reviewActions(t);}
async function editReturnedTransfer(id){if(state.user?.role!=="DATA_ENTRY")return toast("التصحيح متاح لموظف الإدخال فقط");const t=state.transfers.find(x=>x.transferId===id);if(!t||t.status!=="RETURNED")return toast("هذه العملية ليست معادة للتصحيح");const body=$("contentBody");$("contentPanel").classList.remove("hidden");$("contentTitle").textContent="تصحيح العملية "+id;body.innerHTML='<div class="notice">سبب الإعادة من المحاسب: '+esc(t.reviewNotes||"يرجى مراجعة بيانات التحويل")+'</div><form id="returnedEditForm"><div class="form-grid"><div class="field"><label for="fixStudent">اسم الطالب *</label><input id="fixStudent" required maxlength="160" value="'+esc(t.studentName)+'"></div><div class="field"><label for="fixAmount">المبلغ (ريال) *</label><input id="fixAmount" type="number" min="0.01" step="0.01" required value="'+esc(t.amount)+'"></div><div class="field"><label for="fixPeriod">الفترة المسددة *</label><input id="fixPeriod" required maxlength="120" value="'+esc(t.period)+'"></div><div class="field"><label for="fixReceipt">استبدال إيصال PDF (اختياري)</label><input id="fixReceipt" type="file" accept="application/pdf,.pdf"><small>اتركه فارغًا للاحتفاظ بالإيصال الحالي.</small></div><div class="field full-row"><label for="fixNotes">ملاحظات</label><textarea id="fixNotes" maxlength="1500">'+esc(t.notes||"")+'</textarea></div></div><div class="form-actions"><button class="btn primary" type="submit">حفظ التصحيح وإعادة الإرسال للمحاسب</button><button class="btn ghost" type="button" id="cancelFix">إلغاء</button></div></form>';$("cancelFix").onclick=()=>showDetail(id);$("returnedEditForm").onsubmit=async e=>{e.preventDefault();const btn=e.submitter;btn.disabled=true;try{const f=$("fixReceipt").files[0];let fileBase64="";if(f){if(f.type!=="application/pdf"&&!f.name.toLowerCase().endsWith(".pdf"))throw new Error("اختر إيصال PDF فقط");if(f.size>8*1024*1024)throw new Error("حجم الملف يتجاوز 8 ميجابايت");fileBase64=String(await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f)})).split(",")[1];}await api("correctReturnedTransfer",{transferId:id,studentName:$("fixStudent").value.trim(),amount:Number($("fixAmount").value),period:$("fixPeriod").value.trim(),notes:$("fixNotes").value.trim(),fileName:f?.name||"",mimeType:f?"application/pdf":"",fileBase64});toast("تم حفظ التصحيح وإعادة العملية للمحاسب");await loadTransfers();openView("mine");}catch(err){toast(err.message)}finally{btn.disabled=false;}};}
async function editTransfer(id){if(state.user?.role!=="ACCOUNTANT")return toast("التعديل متاح للمحاسب العام فقط");const t=state.transfers.find(x=>x.transferId===id);if(!t)return;const body=$("contentBody");$("contentPanel").classList.remove("hidden");$("contentTitle").textContent="تعديل العملية "+id;body.innerHTML='<form id="editTransferForm"><div class="detail-grid"><div class="field"><label for="editStudentName">اسم الطالب</label><input id="editStudentName" required maxlength="160" value="'+esc(t.studentName)+'"></div><div class="field"><label for="editAmount">المبلغ (ريال)</label><input id="editAmount" type="number" min="0.01" step="0.01" required value="'+esc(t.amount)+'"></div><div class="field"><label for="editPeriod">الفترة المسددة</label><input id="editPeriod" required maxlength="120" value="'+esc(t.period)+'"></div><div class="field"><label for="editInvoice">رقم الفاتورة</label><input id="editInvoice" maxlength="120" value="'+esc(t.invoiceNumber||"")+'"></div><div class="field" style="grid-column:1/-1"><label for="editNotes">ملاحظات</label><textarea id="editNotes" maxlength="1500">'+esc(t.notes||"")+'</textarea></div></div><div class="form-actions"><button class="btn primary" type="submit">حفظ التعديلات</button><button class="btn ghost" type="button" id="cancelEdit">إلغاء</button></div></form>';$("cancelEdit").onclick=()=>showDetail(id);$("editTransferForm").onsubmit=async e=>{e.preventDefault();const btn=e.submitter;btn.disabled=true;try{await api("updateTransfer",{transferId:id,studentName:$("editStudentName").value.trim(),amount:Number($("editAmount").value),period:$("editPeriod").value.trim(),invoiceNumber:$("editInvoice").value.trim(),notes:$("editNotes").value.trim()});toast("تم حفظ تعديلات العملية");await loadTransfers();showDetail(id);}catch(err){toast(err.message)}finally{btn.disabled=false;}};}
async function deleteTransfer(id){if(state.user?.role!=="ACCOUNTANT")return toast("الحذف متاح للمحاسب العام فقط");const t=state.transfers.find(x=>x.transferId===id);if(!t)return;if(!confirm("تأكيد حذف العملية "+id+" للطالب "+t.studentName+"؟ سيتم حذف سجل العملية وإيصال PDF نهائيًا."))return;try{await api("deleteTransfer",{transferId:id});toast("تم حذف العملية بنجاح");await loadTransfers();if(state.view)openView(state.view);}catch(err){toast(err.message)}}
let activeReceiptUrl=null;
function closeReceiptViewer(){const modal=$("receiptViewer");if(modal)modal.remove();if(activeReceiptUrl){URL.revokeObjectURL(activeReceiptUrl);activeReceiptUrl=null;}}
async function getInvoice(id){try{const r=await api("getInvoice",{transferId:id});showPdfInModal(r,id,"الفاتورة المحاسبية");}catch(e){toast(e.message)}}
function showPdfInModal(r,id,label){const raw=atob(r.base64),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);const blob=new Blob([bytes],{type:"application/pdf"});if(activeReceiptUrl)URL.revokeObjectURL(activeReceiptUrl);activeReceiptUrl=URL.createObjectURL(blob);const modal=document.createElement("div");modal.id="receiptViewer";modal.className="receipt-modal";modal.innerHTML='<section class="receipt-dialog" role="dialog" aria-modal="true"><header class="receipt-toolbar"><div><b>'+esc(label)+'</b><small>'+esc(r.fileName||id+".pdf")+'</small></div><div class="receipt-tools"><button type="button" class="btn primary" id="receiptDownload">تنزيل PDF</button><button type="button" class="btn ghost" id="receiptClose">إغلاق ✕</button></div></header><iframe class="receipt-frame" title="معاينة PDF"></iframe></section>';document.body.appendChild(modal);modal.querySelector("iframe").src=activeReceiptUrl;modal.querySelector("#receiptClose").onclick=closeReceiptViewer;modal.querySelector("#receiptDownload").onclick=()=>{const link=document.createElement("a");link.href=activeReceiptUrl;link.download=r.fileName||id+".pdf";document.body.appendChild(link);link.click();link.remove();};modal.addEventListener("click",e=>{if(e.target===modal)closeReceiptViewer();});}
async function getReceipt(id){try{const r=await api("getReceipt",{transferId:id});showPdfInModal(r,id,"إيصال التحويل البنكي");}catch(e){toast(e.message)}}
async function reviewActions(t){const body=$("contentBody");body.insertAdjacentHTML("beforeend",'<div class="panel" style="padding:16px;margin-top:18px"><h3>مراجعة التحويل وإصدار الفاتورة</h3><p class="muted">راجع إيصال التحويل، ثم أدخل رقم الفاتورة وأرفقها. سيتم اعتماد العملية وإكمالها بضغطة واحدة.</p><div class="field"><label for="invoiceNo">رقم الفاتورة الصادرة من النظام المحاسبي *</label><input id="invoiceNo" value="'+esc(t.invoiceNumber||"")+'" placeholder="رقم الفاتورة" required></div><div class="field"><label for="invoiceFile">إرفاق نسخة الفاتورة PDF *</label><input id="invoiceFile" type="file" accept="application/pdf,.pdf"><small>'+(t.invoiceAttached?'الفاتورة مرفقة حاليًا؛ يمكنك اختيار ملف جديد لاستبدالها.':'يجب إرفاق الفاتورة قبل إكمال العملية.')+'</small></div><div class="field"><label for="reviewNotes">ملاحظات المحاسب (اختياري)</label><textarea id="reviewNotes">'+esc(t.reviewNotes||"")+'</textarea></div><div class="form-actions"><button class="btn primary" id="completeInvoiceBtn">تم التأكيد وتسجيل الفاتورة</button><button class="btn ghost" id="returnBtn">إعادة للموظف للتصحيح</button></div></div>');$("completeInvoiceBtn").onclick=()=>completeWithInvoice(t);$("returnBtn").onclick=()=>{if(!$("reviewNotes").value.trim())return toast("اكتب سبب الإعادة");updateStatus(t,"RETURNED")};}
async function completeWithInvoice(t){const number=$("invoiceNo").value.trim(),file=$("invoiceFile").files[0];if(!number)return toast("أدخل رقم الفاتورة أولًا");if(!file&&!t.invoiceAttached)return toast("أرفق نسخة الفاتورة PDF");if(file){if(file.type!=="application/pdf"&&!file.name.toLowerCase().endsWith(".pdf"))return toast("الفاتورة يجب أن تكون PDF");if(file.size>8*1024*1024)return toast("حجم الفاتورة يتجاوز 8 ميجابايت");}const btn=$("completeInvoiceBtn");btn.disabled=true;btn.textContent="جارٍ اعتماد التحويل وحفظ الفاتورة…";try{let fileBase64="";if(file)fileBase64=String(await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)})).split(",")[1];await api("completeWithInvoice",{transferId:t.transferId,invoiceNumber:number,reviewNotes:$("reviewNotes").value.trim(),fileName:file?.name||"",mimeType:file?"application/pdf":"",fileBase64});toast("تم تأكيد التحويل وتسجيل الفاتورة بنجاح");await loadTransfers();openView("review");}catch(e){toast(e.message);btn.disabled=false;btn.textContent="تم التأكيد وتسجيل الفاتورة";}}
async function updateStatus(t,status){try{await api("updateStatus",{transferId:t.transferId,status,invoiceNumber:$("invoiceNo")?.value.trim()||"",reviewNotes:$("reviewNotes")?.value.trim()||""});toast("تم تحديث حالة التحويل");await loadTransfers();openView("review");}catch(e){toast(e.message)}}
function exportPdf(){
 const q=($("reportSearch")?.value||"").trim().toLowerCase(),s=$("reportStatus")?.value||"";
 const items=state.transfers.filter(t=>(!s||t.status===s)&&((t.studentName+" "+t.transferId).toLowerCase().includes(q)));
 const total=items.reduce((sum,t)=>sum+Number(t.amount||0),0);
 const date=new Date().toLocaleDateString("ar-SA",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
 const issuedAt=new Date().toLocaleTimeString("ar-SA",{hour:"2-digit",minute:"2-digit"});
 const pending=items.filter(t=>t.status==="PENDING").length;
 const completed=items.filter(t=>t.status==="COMPLETED").length;
 const rows=items.map((t,i)=>'<tr><td class="center">'+(i+1)+'</td><td class="ref">'+esc(t.transferId)+'</td><td class="student">'+esc(t.studentName)+'</td><td>'+esc(t.period)+'</td><td class="amount">'+esc(money(t.amount))+'</td><td class="center">'+esc(t.invoiceNumber||"—")+'</td><td class="center"><span class="status status-'+esc(t.status).toLowerCase()+'">'+esc(statuses[t.status]||t.status)+'</span></td><td class="date">'+esc(t.createdAt||"—")+'</td></tr>').join("");
 const win=window.open("","_blank");
 if(!win){toast("اسمح بالنوافذ المنبثقة لإصدار التقرير PDF");return;}
 win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Almarai:wght@300;400;700;800&display=swap" rel="stylesheet"><title>تقرير تحويلات رسوم الطلاب | مركز غيم</title>
<style>
@page{size:A4 landscape;margin:9mm}*{box-sizing:border-box}
:root{--teal:#087c7c;--deep:#103b50;--gold:#c99a3b;--muted:#6e8492;--line:#dce7ec;--pale:#f2f8f9}
html,body{margin:0;padding:0;background:#fff;color:var(--deep);font-family:"Almarai",Tahoma,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-size:10px;line-height:1.55}.sheet{width:100%;margin:0 auto}
.masthead{display:flex;align-items:center;justify-content:space-between;padding:0 0 11px;border-bottom:3px solid var(--gold)}
.brand{display:flex;align-items:center;gap:11px}.brand-mark{width:45px;height:45px;border-radius:14px;background:linear-gradient(145deg,#0a9e99,#07516a);color:#fff;display:grid;place-items:center;font-size:27px;font-weight:900;box-shadow:0 4px 12px #0a687322}
.brand-name{font-size:19px;font-weight:900;color:var(--teal)}.brand-sub{font-size:9px;color:#a27a2c;font-weight:700;margin-top:2px}
.meta{text-align:left;color:var(--muted);font-size:9px;line-height:1.9}.meta b{color:var(--deep)}
.heading{text-align:center;padding:11px 0 8px}.heading h1{font-size:18px;margin:0;color:var(--deep);font-weight:900}.heading p{font-size:9px;color:var(--muted);margin:4px 0 0}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin:7px 0 13px}
.stat{position:relative;border:1px solid var(--line);border-radius:10px;background:linear-gradient(135deg,#f8fbfc,#eef7f6);padding:8px 12px;text-align:center;overflow:hidden}
.stat:before{content:"";position:absolute;right:0;top:0;bottom:0;width:3px;background:var(--teal)}
.stat span{display:block;color:var(--muted);font-size:9px}.stat b{display:block;color:var(--teal);font-size:15px;font-weight:900;margin-top:3px}
.table-title{display:flex;justify-content:space-between;align-items:center;margin:0 0 6px}.table-title b{font-size:11px}.table-title span{color:var(--muted);font-size:9px}
table{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;border:1px solid var(--line);border-radius:8px;overflow:hidden}
thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}
th{background:#0c6664;color:#fff;font-size:9px;font-weight:800;padding:8px 6px;text-align:right}
td{border-bottom:1px solid #e4ecef;padding:7px 6px;text-align:right;vertical-align:middle;font-size:9px;color:#294b5d;overflow-wrap:anywhere}
tbody tr:nth-child(even){background:#f4f8fa}tbody tr:last-child td{border-bottom:0}
th:nth-child(1){width:3%}th:nth-child(2){width:16%}th:nth-child(3){width:13%}th:nth-child(4){width:16%}th:nth-child(5){width:10%}th:nth-child(6){width:8%}th:nth-child(7){width:13%}th:nth-child(8){width:21%}
.center{text-align:center}.ref{font-size:8px;direction:ltr;text-align:center}.student{font-weight:700}.amount{font-weight:900;color:#087c7c;white-space:nowrap}.date{font-size:8px;color:#647d8c}
.status{display:inline-block;padding:3px 6px;border-radius:20px;background:#edf3f5;color:#45616f;font-size:8px;font-weight:700;white-space:nowrap}
.status-completed{background:#e2f4ed;color:#147452}.status-pending,.status-invoice_pending{background:#fff3dc;color:#946316}.status-returned,.status-rejected{background:#fdebec;color:#a43c46}.status-accepted{background:#e7f2ff;color:#28649a}
tfoot th{background:#0b4f59;font-size:10px;padding:9px 7px}.empty{padding:26px;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:10px}
.signatures{display:grid;grid-template-columns:1fr 1fr;gap:34px;margin:19px 0 12px}.signature{border-top:1px solid #9aadb7;padding-top:7px;text-align:center;color:#536e7c;font-size:9px}
.footer{display:flex;justify-content:space-between;border-top:1px solid var(--line);padding-top:7px;color:#8295a0;font-size:8px}
@media print{.no-print{display:none!important}thead{display:table-header-group}tr{break-inside:avoid}}
</style></head><body><main class="sheet">
<header class="masthead"><div class="brand"><div class="brand-mark">غ</div><div><div class="brand-name">مركز غيم لضيافة الأطفال</div><div class="brand-sub">GHAYM CENTER · FINANCE</div></div></div><div class="meta"><b>تاريخ إصدار التقرير:</b> ${esc(date)}<br><b>وقت الإصدار:</b> ${esc(issuedAt)}<br><b>نوع التقرير:</b> ${esc(s?(statuses[s]||s):"جميع الحالات")}</div></header>
<section class="heading"><h1>تقرير تحويلات رسوم الطلاب</h1><p>ملخص العمليات المالية المسجلة ومتابعة حالة التحويلات والفواتير</p></section>
<section class="stats"><div class="stat"><span>إجمالي العمليات</span><b>${items.length}</b></div><div class="stat"><span>إجمالي المبالغ</span><b>${esc(money(total))}</b></div><div class="stat"><span>قيد المراجعة</span><b>${pending}</b></div><div class="stat"><span>فواتير مؤكدة</span><b>${completed}</b></div></section>
<div class="table-title"><b>تفاصيل التحويلات</b><span>عدد السجلات: ${items.length}</span></div>
${items.length?'<table><thead><tr><th>م</th><th>الرقم المرجعي</th><th>اسم الطالب</th><th>الفترة المسددة</th><th>المبلغ</th><th>رقم الفاتورة</th><th>الحالة</th><th>تاريخ الرفع</th></tr></thead><tbody>'+rows+'</tbody><tfoot><tr><th colspan="4">إجمالي المبالغ</th><th>'+esc(money(total))+'</th><th colspan="3">إجمالي عدد العمليات: '+items.length+'</th></tr></tfoot></table>':'<div class="empty">لا توجد عمليات مطابقة لمعايير التقرير.</div>'}
<section class="signatures"><div class="signature">إعداد المساعدة الإدارية</div><div class="signature">مراجعة واعتماد المحاسب العام</div></section>
<footer class="footer"><span>مركز غيم لضيافة الأطفال · تقرير داخلي للاستخدام الإداري</span><span>تم إنشاء التقرير إلكترونيًا من منصة رسوم الطلاب</span></footer>
</main><script>window.onload=()=>setTimeout(()=>window.print(),450);<\/script></body></html>`);
 win.document.close();
}

const otpDigits=[1,2,3,4].map(n=>$("otpDigit"+n));
let otpSubmitting=false;
function otpCode(){return otpDigits.map(el=>el.value).join("");}
function syncOtp(){
 const code=otpCode();
 $("accessCode").value=code;
 otpDigits.forEach(el=>el.classList.toggle("filled",!!el.value));
 $("otpStatus").textContent=code.length===4?"جاري فتح القفل…":"أدخل الأرقام الأربعة للمتابعة";
}
function focusOtp(index=0){
 const target=otpDigits[index];
 if(target){target.focus();target.select();}
}
function clearOtpFields(){
 otpDigits.forEach(el=>{el.value="";el.classList.remove("filled","otp-invalid");});
 $("accessCode").value="";
 $("otpStatus").textContent="أدخل الأرقام الأربعة للمتابعة";
 $("loginError").textContent="";
 $("loginForm").classList.remove("otp-unlock","otp-error-shake");
}
async function submitOtpLogin(){
 if(otpSubmitting)return;
 const code=otpCode();
 if(!/^[0-9]{4}$/.test(code))return;
 otpSubmitting=true;
 const card=$("loginForm");
 card.classList.remove("otp-unlock","otp-error-shake");
 void card.offsetWidth;
 card.classList.add("otp-unlock");
 $("otpStatus").textContent="تم إدخال الرمز… جارٍ التحقق";
 $("loginError").textContent="";
 try{
  const r=await api("login",{accessCode:code});
  $("otpStatus").textContent="تم فتح القفل بنجاح";
  await new Promise(resolve=>setTimeout(resolve,520));
  state.token=r.token;state.user=r.user;saveSession();showDashboard(state.user);try{await loadTransfers();}catch(loadError){toast("تم تسجيل الدخول، لكن تعذر تحميل البيانات: "+loadError.message);}
 }catch(err){
  card.classList.remove("otp-unlock");
  card.classList.add("otp-error-shake");
  $("loginError").textContent=err.message||"رمز الدخول غير صحيح";
  $("otpStatus").textContent="الرمز غير صحيح، حاول مرة أخرى";
  otpDigits.forEach(el=>el.classList.add("otp-invalid"));
  setTimeout(()=>{clearOtpFields();card.classList.remove("otp-error-shake");focusOtp(0);},650);
 }finally{otpSubmitting=false;}
}
otpDigits.forEach((el,index)=>{
 el.addEventListener("input",()=>{
  const digits=el.value.replace(/[^0-9]/g,"");
  el.value=digits.slice(-1);
  syncOtp();
  if(el.value&&index<3)focusOtp(index+1);
  if(otpCode().length===4)submitOtpLogin();
 });
 el.addEventListener("keydown",e=>{
  if(e.key==="Backspace"){
   if(el.value){el.value="";syncOtp();}
   else if(index>0){otpDigits[index-1].value="";syncOtp();focusOtp(index-1);}
   e.preventDefault();return;
  }
  if(e.key==="ArrowLeft"&&index<3){e.preventDefault();focusOtp(index+1);}
  if(e.key==="ArrowRight"&&index>0){e.preventDefault();focusOtp(index-1);}
  if(e.key==="Enter"){e.preventDefault();submitOtpLogin();}
 });
 el.addEventListener("paste",e=>{
  const pasted=(e.clipboardData||window.clipboardData).getData("text").replace(/[^0-9]/g,"").slice(0,4);
  if(!pasted)return;
  e.preventDefault();
  otpDigits.forEach((input,i)=>input.value=pasted[i]||"");
  syncOtp();
  if(pasted.length===4)submitOtpLogin();else focusOtp(pasted.length);
 });
});
$("loginForm").addEventListener("submit",e=>{e.preventDefault();submitOtpLogin();});
document.addEventListener("click",e=>{const home=e.target.closest("[data-home]");if(home){$("contentPanel").classList.add("hidden");$("recentPanel").classList.remove("hidden");state.view="";document.querySelectorAll(".sidebar-link").forEach(x=>x.classList.remove("active"));home.classList.add("active");}const v=e.target.closest("[data-view]");if(v){openView(v.dataset.view);document.querySelectorAll(".sidebar-link").forEach(x=>x.classList.toggle("active",x===v));}const d=e.target.closest("[data-detail]");if(d)showDetail(d.dataset.detail);const rv=e.target.closest("[data-review]");if(rv){const t=state.transfers.find(x=>x.transferId===rv.dataset.review);if(t)showDetail(t.transferId).then(()=>reviewActions(t));}const ed=e.target.closest("[data-edit]");if(ed)editTransfer(ed.dataset.edit);const er=e.target.closest("[data-edit-returned]");if(er)editReturnedTransfer(er.dataset.editReturned);const del=e.target.closest("[data-delete]");if(del)deleteTransfer(del.dataset.delete);});
$("backBtn").onclick=()=>{$("contentPanel").classList.add("hidden");$("recentPanel").classList.remove("hidden");state.view="";};$("refreshBtn").onclick=()=>loadTransfers().then(()=>toast("تم تحديث البيانات")).catch(e=>toast(e.message));$("logoutBtn").onclick=async()=>{try{await api("logout")}catch(_){}showLogin();$("accessCode").value="";toast("تم تسجيل الخروج");};
(async function restoreSession(){let saved=null;try{saved=JSON.parse(sessionStorage.getItem("ghaymPortalSession")||"null");}catch(_){}if(!saved?.token||!saved?.user)return;state.token=saved.token;state.user=saved.user;showDashboard(saved.user);try{await loadTransfers();}catch(_){showLogin();}})();
if($("today"))$("today").textContent=today();if($("year"))$("year").textContent=new Date().getFullYear();
if(!API_URL)$("configNotice").classList.remove("hidden");