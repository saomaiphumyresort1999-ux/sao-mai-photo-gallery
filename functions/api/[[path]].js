const json=(v,status=200,extra={})=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...extra}});
const err=(s,m)=>json({error:m},s);
const enc=new TextEncoder();
async function digest(s){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('')}
async function hmac(s,key){const k=await crypto.subtle.importKey('raw',enc.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',k,enc.encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('')}
async function isAdmin(req,env){const raw=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('sm_session='))?.slice(11);if(!raw||!env.SESSION_SECRET)return false;const [exp,sig]=raw.split('.');if(!exp||!sig||Number(exp)<Date.now())return false;return (await hmac(exp,env.SESSION_SECRET))===sig}
const MAX_TOTAL=8*1000*1000*1000, MAX_FILE=15*1024*1024, MAX_PREVIEW=2*1024*1024;
const allowedTypes=new Map([['image/jpeg',[0xff,0xd8,0xff]],['image/png',[0x89,0x50,0x4e,0x47]],['image/webp',[0x52,0x49,0x46,0x46]],['image/gif',[0x47,0x49,0x46,0x38]]]);
async function validImage(file){const magic=allowedTypes.get(file.type);if(!magic)return false;const b=new Uint8Array(await file.slice(0,16).arrayBuffer());if(!magic.every((v,i)=>b[i]===v))return false;if(file.type==='image/webp'&&String.fromCharCode(...b.slice(8,12))!=='WEBP')return false;return true}
const clean=(s)=>String(s||'').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,100);
function sameOrigin(req){const origin=req.headers.get('Origin');if(!origin)return false;try{return new URL(origin).origin===new URL(req.url).origin}catch{return false}}
function cookieValue(req,name){return (req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||''}
async function albumAuthorized(req,env,id){if(!env.SESSION_SECRET)return false;const raw=cookieValue(req,'sm_album');const parts=raw.split('.');if(parts.length!==3)return false;const [album,exp,sig]=parts;if(album!==id||!/^\d+$/.test(exp)||Number(exp)<Date.now())return false;return (await hmac(album+'.'+exp,env.SESSION_SECRET))===sig}
async function loginLimited(env,req){const ip=req.headers.get('CF-Connecting-IP')||'unknown';const key=await digest('login:'+ip);const now=Date.now();const row=await env.DB.prepare('SELECT attempts,window_start,blocked_until FROM auth_limits WHERE key=?').bind(key).first();if(row&&row.blocked_until>now)return true;return false}
async function recordFailure(env,req){const ip=req.headers.get('CF-Connecting-IP')||'unknown',key=await digest('login:'+ip),now=Date.now();await env.DB.prepare(`INSERT INTO auth_limits(key,attempts,window_start,blocked_until) VALUES(?,1,?,0) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN ?-window_start>900000 THEN 1 ELSE attempts+1 END, window_start=CASE WHEN ?-window_start>900000 THEN ? ELSE window_start END,blocked_until=CASE WHEN ?-window_start>900000 THEN 0 WHEN attempts+1>=5 THEN ?+900000 ELSE blocked_until END`).bind(key,now,now,now,now,now,now).run()}
export async function onRequest({request,env,params}){
 try{
  if(!env.DB)return err(503,'Chưa cấu hình D1');
  const path='/'+(params.path||[]).join('/');const url=new URL(request.url);const method=request.method; if(!['GET','HEAD','OPTIONS'].includes(method)&&!sameOrigin(request))return err(403,'Origin không hợp lệ'); const admin=await isAdmin(request,env);
  if(path==='/login'&&method==='POST'){
   if(!env.ADMIN_PASSWORD||!env.SESSION_SECRET)return err(503,'Thiếu ADMIN_PASSWORD/SESSION_SECRET');
   if(await loginLimited(env,request))return err(429,'Đăng nhập tạm khóa 15 phút');const {password}=await request.json();if((await digest(String(password||'')))!==(await digest(env.ADMIN_PASSWORD))){await recordFailure(env,request);return err(401,'Sai mật khẩu')}
   const exp=String(Date.now()+7*86400000),sig=await hmac(exp,env.SESSION_SECRET);
   return json({ok:true},200,{'set-cookie':`sm_session=${exp}.${sig}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`});
  }
  if(path==='/logout'&&method==='POST')return json({ok:true},200,{'set-cookie':'sm_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'});
  if(path==='/me')return json({admin});
  if(path==='/albums'&&method==='GET'){
   const rows=(await env.DB.prepare('SELECT a.id,a.title,a.category,a.description,a.private,a.created_at,COUNT(p.id) AS count FROM albums a LEFT JOIN photos p ON p.album_id=a.id GROUP BY a.id ORDER BY CASE WHEN a.category=\'services\' THEN 0 ELSE 1 END,a.created_at').all()).results;
   return json({albums:rows});
  }
  if(path==='/albums'&&method==='POST'){
   if(!admin)return err(401,'Cần đăng nhập');const body=await request.json();const title=String(body.title||'').trim().slice(0,120);if(!title)return err(400,'Thiếu tên album');
   const id=crypto.randomUUID();const category=body.category==='room-types'?'room-types':'events';const privateFlag=body.private?1:0;if(privateFlag&&String(body.password||'').length<12)return err(400,'Mật khẩu album phải có ít nhất 12 ký tự');const hash=privateFlag&&body.password?await hmac('album-password:'+body.password,env.SESSION_SECRET||''):null;
   await env.DB.prepare('INSERT INTO albums(id,title,category,description,private,password_hash) VALUES(?,?,?,?,?,?)').bind(id,title,category,String(body.description||'').slice(0,500),privateFlag,hash).run();return json({id});
  }
  if(path==='/album'&&method==='GET'){
   const id=url.searchParams.get('id');const album=await env.DB.prepare('SELECT * FROM albums WHERE id=?').bind(id).first();if(!album)return err(404,'Không có album');
   if(album.private&&!admin&&!await albumAuthorized(request,env,id))return err(403,'Album cần mật khẩu');
   const photos=(await env.DB.prepare('SELECT id,album_id,filename,mime,bytes,created_at FROM photos WHERE album_id=? ORDER BY created_at DESC').bind(id).all()).results;
   return json({album:{id:album.id,title:album.title,category:album.category,description:album.description,private:album.private},photos});
  }
  if(path==='/album-access'&&method==='POST'){
   if(!env.SESSION_SECRET)return err(503,'Thiếu SESSION_SECRET');const body=await request.json(),id=String(body.id||''),password=String(body.password||'');const album=await env.DB.prepare('SELECT private,password_hash FROM albums WHERE id=?').bind(id).first();if(!album)return err(404,'Không có album');if(!album.private)return json({ok:true});if(!album.password_hash||await hmac('album-password:'+password,env.SESSION_SECRET)!==album.password_hash)return err(403,'Mật khẩu album không đúng');const exp=String(Date.now()+3600000),sig=await hmac(id+'.'+exp,env.SESSION_SECRET);return json({ok:true},200,{'set-cookie':`sm_album=${id}.${exp}.${sig}; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=3600`});
  }
  if(path==='/quota'&&method==='GET'){
   if(!admin)return err(401,'Cần đăng nhập');const q=await env.DB.prepare('SELECT used_bytes,reserved_bytes,max_bytes FROM storage_quota WHERE id=1').first();if(!q)return err(503,'Chưa chạy sql/upgrade-v1.4.sql');return json({quota:q});
  }
  if(path==='/upload'&&method==='POST'){
   if(!admin)return err(401,'Cần đăng nhập');if(!env.PHOTOS)return err(503,'R2 chưa kích hoạt');const len=Number(request.headers.get('content-length')||0);if(len>18*1024*1024)return err(413,'Yêu cầu quá lớn');const form=await request.formData();const file=form.get('file');const preview=form.get('preview');const albumId=String(form.get('albumId')||'');if(!file||typeof file==='string')return err(400,'Thiếu file');
   if(file.size<1||file.size>MAX_FILE)return err(413,'Ảnh phải từ 1 byte đến 15 MB');
   if(!await validImage(file))return err(415,'Chỉ chấp nhận JPEG, PNG, WebP, GIF hợp lệ');
   if(preview&&(typeof preview==='string'||preview.size>MAX_PREVIEW||preview.type!=='image/webp'||!await validImage(preview)))return err(415,'Preview WebP không hợp lệ hoặc vượt 2 MB');
   if(!await env.DB.prepare('SELECT id FROM albums WHERE id=?').bind(albumId).first())return err(404,'Không có album');
   // Atomic compare-and-reserve prevents simultaneous requests from exceeding the 8 GB application cap.
   // Fail closed if the migration has not been applied. Reservations are intentionally NOT auto-expired:
   // a crashed upload can leave an R2 object behind, and auto-release would undercount storage.
   const reserve=file.size+(preview?preview.size:0);
   const reservation=await env.DB.prepare('UPDATE storage_quota SET reserved_bytes=reserved_bytes+? WHERE id=1 AND used_bytes+reserved_bytes+?<=max_bytes').bind(reserve,reserve).run();
   if(!reservation.meta?.changes)return err(507,'Kho ảnh đã đạt giới hạn 8 GB hoặc chưa cập nhật cơ sở dữ liệu v1.4');
   const id=crypto.randomUUID(),key=`original/${albumId}/${id}-${clean(file.name)}`,pk=preview?`preview/${albumId}/${id}.webp`:null;
   let originalWritten=false,previewWritten=false;
   try{
    await env.PHOTOS.put(key,file.stream(),{httpMetadata:{contentType:file.type}});originalWritten=true;
    if(pk){await env.PHOTOS.put(pk,preview.stream(),{httpMetadata:{contentType:'image/webp'}});previewWritten=true}
    await env.DB.prepare('INSERT INTO photos(id,album_id,filename,original_key,preview_key,mime,bytes) VALUES(?,?,?,?,?,?,?)').bind(id,albumId,file.name,key,pk,file.type,file.size).run();
    // If this DB update fails, reservation remains held (fail closed), preventing over-cap uploads.
    await env.DB.prepare('UPDATE storage_quota SET used_bytes=used_bytes+?,reserved_bytes=reserved_bytes-? WHERE id=1').bind(reserve,reserve).run();
    return json({id});
   }catch(e){
    // Do not release quota unless every possibly-written object was successfully removed.
    let cleaned=true;
    try{await env.PHOTOS.delete([key,...(pk?[pk]:[])]);}catch(_){cleaned=false}
    if(cleaned){
     try{await env.DB.prepare('DELETE FROM photos WHERE id=?').bind(id).run();await env.DB.prepare('UPDATE storage_quota SET reserved_bytes=reserved_bytes-? WHERE id=1').bind(reserve).run()}catch(_){/* fail closed; admin reconciliation required */}
    }
    return err(500,'Upload lỗi; dung lượng dự phòng có thể đang được giữ. Kiểm tra R2/D1 trước khi thử lại.');
   }
  }
  if(path==='/photo'&&method==='GET'){
   const id=url.searchParams.get('id');const photo=await env.DB.prepare('SELECT p.*,a.private,a.password_hash FROM photos p JOIN albums a ON a.id=p.album_id WHERE p.id=?').bind(id).first();if(!photo)return err(404,'Không có ảnh');
   if(photo.private&&!admin&&!await albumAuthorized(request,env,photo.album_id))return err(403,'Album cần mật khẩu');if(!env.PHOTOS)return err(503,'R2 chưa kích hoạt');
   const original=url.searchParams.get('original')==='1';const obj=await env.PHOTOS.get(original||!photo.preview_key?photo.original_key:photo.preview_key);if(!obj)return err(404,'Không tìm thấy ảnh');
   const headers=new Headers({'content-type':original||!photo.preview_key?photo.mime:'image/webp','cache-control':photo.private?'private, max-age=300':'public, max-age=86400','x-content-type-options':'nosniff'});
   if(url.searchParams.get('download')==='1')headers.set('content-disposition',`attachment; filename*=UTF-8''${encodeURIComponent(photo.filename)}`);
   return new Response(obj.body,{headers});
  }
  if(path==='/photo'&&method==='DELETE'){
   if(!admin)return err(401,'Cần đăng nhập');if(!env.PHOTOS)return err(503,'R2 chưa kích hoạt');const id=url.searchParams.get('id');const p=await env.DB.prepare('SELECT * FROM photos WHERE id=?').bind(id).first();if(!p)return err(404,'Không có ảnh');
   await env.PHOTOS.delete([p.original_key,...(p.preview_key?[p.preview_key]:[])]);await env.DB.prepare('DELETE FROM photos WHERE id=?').bind(id).run();/* Conservative: deleted bytes are not auto-credited; prevents accidental undercount. Reconcile manually when needed. */return json({ok:true});
  }
  return err(404,'Không tìm thấy API');
 }catch(e){return err(500,'Lỗi máy chủ; kiểm tra nhật ký Cloudflare')}
}
