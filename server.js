const express=require('express'),multer=require('multer'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PASS=process.env.ADMIN_PASSWORD||'admin123',PORT=process.env.PORT||3000;
const D=path.join(__dirname,'storage');fs.mkdirSync(D,{recursive:true});
const DB=path.join(D,'db.json');
const load=()=>fs.existsSync(DB)?JSON.parse(fs.readFileSync(DB)):{orders:[],client:null};
const save=d=>fs.writeFileSync(DB,JSON.stringify(d,null,1));
const up=multer({dest:D,limits:{fileSize:300*1024*1024}});
const PLANS={cheksiz:35000,'3oy':20000,'1oy':8000,hwid:15000};
const app=express();app.use(express.json());app.use(express.static(path.join(__dirname,'public')));
const admin=(q,s,n)=>(q.get('x-admin')||q.query.k)===PASS?n():s.status(401).json({error:'Parol xato'});

// Xaridor: buyurtma + chek
app.post('/api/order',up.single('receipt'),(q,s)=>{
  const{plan,contact}=q.body;
  if(!PLANS[plan]||!q.file||!contact)return s.status(400).json({error:'Aloqa va chek kerak'});
  const d=load(),o={id:crypto.randomUUID(),token:crypto.randomBytes(16).toString('hex'),plan,price:PLANS[plan],contact:String(contact).slice(0,100),receipt:q.file.filename,mime:q.file.mimetype,status:'pending',downloaded:false,at:Date.now()};
  d.orders.push(o);save(d);s.json({token:o.token});
});
app.get('/api/order/:t',(q,s)=>{const o=load().orders.find(x=>x.token===q.params.t);if(!o)return s.status(404).end();s.json({status:o.status,plan:o.plan,downloaded:o.downloaded});});

// Admin
app.get('/api/admin/orders',admin,(q,s)=>{const d=load();s.json({orders:d.orders.slice().reverse(),client:d.client&&d.client.name});});
app.post('/api/admin/orders/:id/:act',admin,(q,s)=>{
  const d=load(),o=d.orders.find(x=>x.id===q.params.id),a=q.params.act;
  if(!o||!['approve','reject','reset'].includes(a))return s.status(400).end();
  if(a==='reject')o.status='rejected';else{o.status='approved';if(a==='reset')o.downloaded=false;}
  save(d);s.json({ok:1});
});
app.get('/api/admin/receipt/:id',admin,(q,s)=>{const o=load().orders.find(x=>x.id===q.params.id);if(!o)return s.status(404).end();s.type(o.mime).sendFile(path.join(D,o.receipt));});
app.post('/api/admin/client',admin,up.single('file'),(q,s)=>{
  if(!q.file)return s.status(400).json({error:'Fayl yo\'q'});
  const d=load();if(d.client)fs.rm(path.join(D,d.client.file),()=>{});
  d.client={file:q.file.filename,name:q.file.originalname};save(d);s.json({ok:1});
});

// 1 martalik yuklab olish
app.get('/download/:t',(q,s)=>{
  const d=load(),o=d.orders.find(x=>x.token===q.params.t);
  if(!o||o.status!=='approved'||o.plan==='hwid'||o.downloaded||!d.client)return s.status(403).send('Yuklab olish mumkin emas: tasdiqlanmagan yoki allaqachon yuklab olingan.');
  o.downloaded=true;save(d);s.download(path.join(D,d.client.file),d.client.name);
});
app.listen(PORT,()=>console.log('http://localhost:'+PORT+'  admin: /admin.html'));
