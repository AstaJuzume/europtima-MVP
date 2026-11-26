(function () {
'use strict';
const KEY = 'europtima-phase-i-mvp-v1';
const MONEY = ['PLN','EUR'];
const ROLES = ['Management','Project Director','Finance / Administration'];
const DIRECTORS = ['Manager 01','Manager 02','Manager 03','Manager 04','Manager 05','Manager 06'];
const STATUS = ['Active','Pipeline','Completed'];
const defaultMonth = '2026-11';
const labels = {
  revenue:'Forecast revenue', staff:'Staff costs', sub:'Subcontractor costs',
  expense:'Other expenses', cost:'Total project costs', profit:'Forecast gross margin', margin:'Gross margin %'
};
const columns = Object.keys(labels);
function initial() {
  const projects = [
    ['Atlas','Warsaw',0,'PLN','Active'],['Beacon','Warsaw',1,'PLN','Active'],
    ['Cedar','Gdańsk',2,'PLN','Active'],['Delta','Kraków',3,'EUR','Active'],
    ['Echo','Warsaw',4,'PLN','Active'],['Foxtrot','Warsaw',5,'PLN','Pipeline']
  ].map(([name,portfolio,director,currency,status],i)=>({id:'p'+(i+1),code:'EP-10'+(i+1),name:'Project '+name,portfolio,director:DIRECTORS[director],currency,status}));
  const staff = [
    ['Structural Engineer','Employment',22100,5200],['Cost Consultant','B2B',26300,6100],
    ['Project Coordinator','Employment',19000,4400],['Design Engineer','B2B',20200,4750],
    ['Technical Specialist','Employment',17000,3950],['Site Consultant','Employment',21500,5050],
  ].map(([position,type,PLN,EUR],i)=>({id:'e'+(i+1),name:'Employee 0'+(i+1),position,type,rates:{PLN,EUR}}));
  const allocations=[], revenue=[], costs=[];
  const pairs = [[1,1,55],[1,2,45],[2,2,75],[2,4,35],[3,3,70],[3,1,30],[4,4,60],[4,2,40],[5,5,75],[5,1,25],[6,2,60],[6,6,40]];
  ['2026-09','2026-10','2026-11','2026-12','2027-01','2027-02'].forEach((month,ix)=>{
    pairs.forEach(([e,p,pct])=>allocations.push({person:'e'+e,project:'p'+p,month,pct}));
    projects.forEach((p,j)=>revenue.push({project:p.id,month,amount:Math.round([75000,94000,39000,28500,61000,53000][j]*(.8+((ix*3+j*2)%7)/13))}));
    costs.push(
      {id:'c'+ix+'a',project:'p1',kind:'sub',amount:16500,month,label:'Architectural partner'},
      {id:'c'+ix+'b',project:'p2',kind:'sub',amount:22000,month,label:'Design services'},
      {id:'c'+ix+'c',project:'p4',kind:'sub',amount:5100,month,label:'Engineering support'},
      {id:'c'+ix+'d',project:'p1',kind:'expense',amount:1650,month,label:'Travel'},
      {id:'c'+ix+'e',project:'p4',kind:'expense',amount:340,month,label:'Site travel'}
    );
  });
  return {projects,staff,allocations,revenue,costs};
}
let db; try { db=JSON.parse(localStorage.getItem(KEY))||initial(); } catch { db=initial(); }
const state={role:'Management',director:DIRECTORS[0],tab:'overview',month:defaultMonth,portfolio:'',project:'',search:'',status:'',staffSearch:'',staffType:'',modal:null,error:'',notice:''};
const fmt = new Intl.NumberFormat('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
const esc = v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cash=(n,c)=>c+' '+fmt.format(n);
const pct=n=>n==null?'N/A':Number(n).toLocaleString('en-GB',{maximumFractionDigits:2})+'%';
const cents=n=>Math.round((Number(n)+Number.EPSILON)*100);
const formatMonth=m=>new Date(m+'-01T12:00:00Z').toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'});
const isDirector=()=>state.role==='Project Director';
const isFinance=()=>state.role==='Finance / Administration';
const permitted=()=>db.projects.filter(p=>!isDirector()||p.director===state.director);
const viewProjects=()=>permitted().filter(p=>(!state.portfolio||state.portfolio===p.portfolio)&&(!state.project||state.project===p.id));
const canEditProject=p=>Boolean(p && isDirector() && p.director===state.director);
const portfolios=()=>[...new Set(permitted().map(p=>p.portfolio))].sort();
const byProject=id=>db.projects.find(p=>p.id===id);
const byStaff=id=>db.staff.find(e=>e.id===id);
const allocTotal=(e,month)=>db.allocations.filter(a=>a.person===e&&a.month===month).reduce((t,a)=>t+a.pct,0);
function calc(p,month) {
  const revenue=db.revenue.filter(a=>a.project===p.id&&a.month===month).reduce((s,x)=>s+cents(x.amount),0);
  const staff=db.allocations.filter(a=>a.project===p.id&&a.month===month).reduce((s,a)=>s+Math.round(cents(byStaff(a.person)?.rates[p.currency]??0)*a.pct/100),0);
  const entries=db.costs.filter(x=>x.project===p.id&&x.month===month);
  const sub=entries.filter(x=>x.kind==='sub').reduce((s,x)=>s+cents(x.amount),0);
  const expense=entries.filter(x=>x.kind==='expense').reduce((s,x)=>s+cents(x.amount),0);
  return finish({revenue,staff,sub,expense});
}
function finish(v) {
  const cost=v.staff+v.sub+v.expense,profit=v.revenue-cost;
  return {...v,cost,profit,margin:v.revenue?profit/v.revenue*100:null};
}
function totals(ps,month,currency) {
  const values={revenue:0,staff:0,sub:0,expense:0};
  ps.filter(p=>p.currency===currency).forEach(p=>{const a=calc(p,month); Object.keys(values).forEach(k=>values[k]+=a[k]);});
  return finish(values);
}
function persist() {
  try { localStorage.setItem(KEY,JSON.stringify(db)); return true; }
  catch { state.notice='This browser could not save changes permanently. Changes remain available in this session.';return false; }
}
const button=(label,action,cls='primary')=>'<button type="button" class="btn '+cls+'" data-act="'+esc(action)+'">'+esc(label)+'</button>';
const option=(value,text,current)=>'<option value="'+esc(value)+'"'+(value===current?' selected':'')+'>'+esc(text)+'</option>';
const options=(pairs,current)=>pairs.map(x=>Array.isArray(x)?option(x[0],x[1],current):option(x,x,current)).join('');
const filter=(label,name,list,current)=>'<label class="field">'+esc(label)+'<select id="'+esc(name)+'">'+options(list,current)+'</select></label>';
const field=(label,name,value,type='text',spec='')=>'<label class="field">'+esc(label)+'<input required type="'+type+'" name="'+name+'" value="'+esc(value)+'" '+spec+'></label>';
const selectField=(label,name,list,current)=>'<label class="field">'+esc(label)+'<select required name="'+name+'">'+options(list,current)+'</select></label>';
const searchField=(label,id,value,placeholder)=>'<label class="field">'+label+'<input type="search" id="'+id+'" value="'+esc(value)+'" placeholder="'+placeholder+'"></label>';
const top=(title,desc,action='')=>'<div class="row-head tab-title"><div><h1>'+esc(title)+'</h1><p class="subtle">'+esc(desc)+'</p></div>'+action+'</div>';
const table=(heads,rows,empty='Nothing to show for this selection.')=>rows.length?'<div class="table-wrap" tabindex="0" aria-label="Scrollable data table"><table><thead><tr>'+heads.map(h=>'<th scope="col">'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>':'<p class="empty">'+esc(empty)+'</p>';
const td=v=>'<td>'+esc(v)+'</td>';
const amount=(v,c)=>'<td class="number">'+cash(v/100,c)+'</td>';
const financialCells=(v,c)=>columns.map(k=>k==='margin'?'<td class="number">'+pct(v[k])+'</td>':amount(v[k],c)).join('');
const hazard=(v)=>'<span class="pill '+(v>100?'alloc-warning':'green')+'">'+pct(v)+(v>100?' · Overallocated':'')+'</span>';
function currencyCards(ps) {
  const cc=MONEY.filter(c=>ps.some(p=>p.currency===c));
  return cc.length?'<div class="summary-grid">'+cc.map(c=>{
    const v=totals(ps,state.month,c);
    return '<article class="card currency-card '+c.toLowerCase()+'"><h2>'+c+' forecast <span class="pill">'+ps.filter(p=>p.currency===c).length+' project(s)</span></h2><dl>'+columns.map(k=>'<dt>'+labels[k]+'</dt><dd>'+ (k==='margin'?pct(v[k]):cash(v[k]/100,c))+'</dd>').join('')+'</dl></article>';
  }).join('')+'</div>':'<div class="card"><p class="empty">No projects match these filters.</p></div>';
}
function projectRows(ps) {
  return ps.map(p=>'<tr>'+td(p.code)+'<td><button type="button" class="text-button" data-open-project="'+esc(p.id)+'">'+esc(p.name)+'</button></td>'+td(p.portfolio)+td(p.currency)+financialCells(calc(p,state.month),p.currency)+'</tr>');
}
function overview() {
  const ps=viewProjects();
  return top('Management overview','Monthly forecast · '+formatMonth(state.month))+
    '<p class="help">Values are reported in the project currency. PLN and EUR are never combined or converted.</p>'+currencyCards(ps)+
    '<section class="card overview-row"><h2>Project forecast</h2>'+table(['Code','Project','Portfolio','Currency',...Object.values(labels)],projectRows(ps))+'</section>';
}
function projects() {
  const needle=state.search.trim().toLowerCase(),ps=viewProjects().filter(p=>(!state.status||p.status===state.status)&&(!needle||[p.code,p.name,p.director].some(v=>v.toLowerCase().includes(needle))));
  return top('Projects','Project register and monthly financial summary',isFinance()?button('Add project','new-project'):'')+
    '<div class="filters">'+searchField('Search projects','search',state.search,'Code, name or director')+filter('Status','status',[['','All statuses'],...STATUS],state.status)+'</div>'+
    (state.project?currencyCards(ps):'')+'<section class="card">'+table(['Code','Project','Portfolio','Project Director','Currency','Status','Forecast revenue','Forecast gross margin','Actions'],
       ps.map(p=>{const v=calc(p,state.month);return '<tr>'+td(p.code)+'<td><button type="button" class="text-button" data-open-project="'+esc(p.id)+'">'+esc(p.name)+'</button></td>'+td(p.portfolio)+td(p.director)+td(p.currency)+td(p.status)+amount(v.revenue,p.currency)+amount(v.profit,p.currency)+'<td>'+(isFinance()?button('Edit','project:'+p.id,'small')+(db.revenue.some(a=>a.project===p.id)||db.allocations.some(a=>a.project===p.id)||db.costs.some(a=>a.project===p.id)?'':' '+button('Delete','delete-project:'+p.id,'small')):'')+'</td></tr>';}))+ '</section>';
}
function reports() {
  const ps=viewProjects();
  const summary=[...new Set(ps.map(p=>p.portfolio))].sort().flatMap(portfolio=>MONEY.flatMap(c=>{
    const group=ps.filter(p=>p.portfolio===portfolio&&p.currency===c);
    return group.length?['<tr>'+td(portfolio)+td(c)+financialCells(totals(group,state.month,c),c)+'</tr>']:[];
  }));
  return top('Project P&L forecast','Project, portfolio and all-project forecasts · '+formatMonth(state.month))+currencyCards(ps)+
  '<section class="card"><h2>Project breakdown</h2>'+table(['Code','Project','Portfolio','Currency',...Object.values(labels)],projectRows(ps))+'</section>'+
  '<section class="card"><h2>Portfolio totals by currency</h2>'+table(['Portfolio','Currency',...Object.values(labels)],summary)+'</section>';
}
function staffPage() {
  const q=state.staffSearch.trim().toLowerCase();
  const list=db.staff.filter(e=>(!state.staffType||state.staffType===e.type)&&(!q||[e.name,e.position].some(v=>v.toLowerCase().includes(q))));
  return top('Staff register','Employment and B2B staff records · confidential internal rates',button('Add staff member','new-staff'))+
    '<div class="filters">'+searchField('Search staff','staffSearch',state.staffSearch,'Name or specialty')+filter('Arrangement','staffType',[['','All arrangements'],'Employment','B2B'],state.staffType)+'</div>'+
    '<section class="card"><p class="help">Enter independent monthly cost rates for each project currency. The demo does not convert rates or calculate payroll.</p>'+
    table(['Staff member','Specialty','Arrangement','Monthly rate PLN','Monthly rate EUR','Actions'],list.map(e=>'<tr>'+td(e.name)+td(e.position)+td(e.type)+td(cash(e.rates.PLN,'PLN'))+td(cash(e.rates.EUR,'EUR'))+'<td>'+button('Edit','staff:'+e.id,'small')+'</td></tr>'))+'</section>';
}
function allocationPage() {
  const ps=viewProjects(),ids=new Set(ps.map(p=>p.id));
  const records=db.allocations.filter(a=>a.month===state.month&&ids.has(a.project)&&a.pct>0);
  const visibleStaff=new Set(records.map(a=>a.person));
  const summary=db.staff.filter(e=>visibleStaff.has(e.id)).map(e=>{
    const t=allocTotal(e.id,state.month);
    return '<tr>'+td(e.name)+'<td>'+hazard(t)+'</td>'+td(pct(Math.max(0,100-t)))+'</tr>';
  });
  return top('Staff allocation','Monthly allocation percentages · '+formatMonth(state.month),isDirector()&&ps.length?button('Add allocation','new-allocation'):'')+
    '<section class="card"><h2>Allocations by project</h2>'+table(['Staff member','Project','Portfolio','Allocation','Actions'],records.map(a=>{
      const p=byProject(a.project); return '<tr>'+td(byStaff(a.person)?.name)+td(p.name)+td(p.portfolio)+td(pct(a.pct))+'<td>'+(canEditProject(p)?button('Edit','allocation:'+p.id+':'+a.person,'small')+' '+button('Remove','remove-allocation:'+p.id+':'+a.person,'small'):'')+'</td></tr>';
    }))+'</section><section class="card"><h2>Capacity check by staff member</h2><p class="help">Totals include assignments on other projects in this month. Directors see the total, not the details of unassigned projects.</p>'+table(['Staff member','Total allocation','Available'],summary)+'</section>';
}
function financialInputs() {
  const ps=viewProjects(),ids=new Set(ps.map(p=>p.id));
  const rows=db.costs.filter(a=>a.month===state.month&&ids.has(a.project));
  return top('Financial inputs','Enter forecasts in each project’s currency · '+formatMonth(state.month))+
  '<section class="card"><h2>Revenue forecast</h2>'+table(['Project','Currency','Forecast revenue','Actions'],ps.map(p=>{
    const v=db.revenue.find(a=>a.project===p.id&&a.month===state.month);
    return '<tr>'+td(p.name)+td(p.currency)+td(v?cash(v.amount,p.currency):'Not entered')+'<td>'+(canEditProject(p)?button(v?'Edit revenue':'Enter revenue','revenue:'+p.id,'small'):'')+'</td></tr>';
  }))+'</section>'+
  ['sub','expense'].map(kind=>'<section class="card"><div class="row-head"><h2>'+labels[kind]+'</h2>'+(isDirector()&&ps.length?button(kind==='sub'?'Add subcontractor cost':'Add expense','new-cost:'+kind):'')+'</div>'+table(['Project','Description','Amount','Actions'],rows.filter(a=>a.kind===kind).map(a=>{
    const p=byProject(a.project);return '<tr>'+td(p.name)+td(a.label)+td(cash(a.amount,p.currency))+'<td>'+(canEditProject(p)?button('Edit','cost:'+a.id,'small')+' '+button('Remove','remove-cost:'+a.id,'small'):'')+'</td></tr>';
  }))+'</section>').join('');
}
const navItems=[['overview','Overview'],['projects','Projects'],['allocations','Staff allocation'],['inputs','Financial inputs'],['reports','P&L forecast'],['staff','Staff register']];
const pages={overview,projects,allocations:allocationPage,inputs:financialInputs,reports,staff:staffPage};
const allowedTab=tab=>tab in pages && (tab!=='staff'||isFinance());
function allowedProjectsList() { return viewProjects().map(p=>[p.id,p.code+' · '+p.name+' ('+p.currency+')']); }
function modalFields(m) {
  if(m.kind==='remove')return '<p>'+esc(m.description)+'</p>';
  const p=byProject(m.project), e=byStaff(m.id), a=db.allocations.find(x=>x.project===m.project&&x.person===m.person&&x.month===state.month), c=db.costs.find(x=>x.id===m.id);
  const numberSpec='min="0" max="1000000000" step="0.01"';
  if(m.kind==='project'){
    const row=byProject(m.id);
    const linked=row && (db.revenue.some(x=>x.project===row.id)||db.costs.some(x=>x.project===row.id)||db.allocations.some(x=>x.project===row.id));
    return field('Project code','code',row?.code,'text','maxlength="32"')+field('Project name','name',row?.name,'text','maxlength="100"')+
      field('Portfolio','portfolio',row?.portfolio,'text','maxlength="64" list="portfolio-options"')+
      '<datalist id="portfolio-options">'+portfolios().map(x=>'<option value="'+esc(x)+'"></option>').join('')+'</datalist>'+
      selectField('Project Director','director',DIRECTORS,row?.director??DIRECTORS[0])+
      (linked?'<label class="field">Project currency<input readonly value="'+esc(row.currency)+'"><span class="help">Currency is fixed after data is entered.</span></label>':selectField('Project currency','currency',MONEY,row?.currency??'PLN'))+
      selectField('Status','status',STATUS,row?.status??'Active');
  }
  if(m.kind==='staff')return field('Staff name','name',e?.name,'text','maxlength="100"')+field('Specialty','position',e?.position,'text','maxlength="80"')+
    selectField('Arrangement','type',['Employment','B2B'],e?.type??'Employment')+
    field('Monthly rate (PLN)','PLN',e?.rates.PLN,'number',numberSpec)+field('Monthly rate (EUR)','EUR',e?.rates.EUR,'number',numberSpec);
  if(m.kind==='revenue')return '<p class="note">'+esc(p.name)+' · '+formatMonth(state.month)+'</p>'+field('Forecast revenue ('+p.currency+')','amount',db.revenue.find(x=>x.project===p.id&&x.month===state.month)?.amount,'number',numberSpec);
  if(m.kind==='cost')return selectField('Project','project',allowedProjectsList(),c?.project??state.project)+
    field('Description','label',c?.label,'text','maxlength="120"')+field('Fixed amount in project currency','amount',c?.amount,'number',numberSpec)+'<p class="note">'+formatMonth(state.month)+'</p>';
  if(m.kind==='allocation')return (a?'<p class="note">'+esc(byStaff(a.person)?.name)+' · '+esc(p.name)+'</p>':
    selectField('Project','project',allowedProjectsList(),state.project)+selectField('Staff member','person',db.staff.map(x=>[x.id,x.name]),''))+
    field('Monthly allocation (%)','pct',a?.pct??25,'number','min="0" max="100" step="1"')+'<p class="note">'+formatMonth(state.month)+'</p>';
  return '';
}
function renderModal() {
  const m=state.modal; if(!m)return '';
  return '<div class="overlay" id="overlay"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><h2 id="modal-title">'+esc(m.title)+'</h2><form id="edit-form">'+modalFields(m)+(state.error?'<p class="field-error" role="alert">'+esc(state.error)+'</p>':'')+'<div class="buttons">'+button('Cancel','close','')+'<button class="btn primary" type="submit">'+(m.kind==='remove'?'Remove':'Save changes')+'</button></div></form></div></div>';
}
function render() {
  if(!allowedTab(state.tab))state.tab='overview';
  const possible=permitted().filter(p=>!state.portfolio||p.portfolio===state.portfolio);
  if(!possible.some(p=>p.id===state.project))state.project='';
  document.getElementById('app').innerHTML='<div class="layout"><aside class="side"><div class="logo">EUROPTIMA</div><div class="tag">PHASE I · P&amp;L FORECAST</div><nav class="side-links" aria-label="Main navigation">'+
    navItems.filter(x=>allowedTab(x[0])).map(([key,label])=>'<button type="button" class="nav '+(state.tab===key?'active':'')+'" data-tab="'+key+'" '+(state.tab===key?'aria-current="page"':'')+'>'+label+'</button>').join('')+
    '</nav><div class="bottom">Interactive prototype<br>Fictional data · browser storage</div></aside><div class="content">'+
    '<header class="top"><div class="brand">Project financial planning</div><div class="context">'+filter('Demo role','role',ROLES,state.role)+(isDirector()?filter('Director','director',DIRECTORS,state.director):'')+'</div></header>'+
    '<main class="container"><div class="notice">Fictional data only. Role switching simulates permissions; this demo has no sign-in or shared database.</div>'+
    '<div class="filters"><label class="field">Reporting month<input id="month" type="month" value="'+esc(state.month)+'"></label>'+
    filter('Portfolio','portfolio',[['','All portfolios'],...portfolios()],state.portfolio)+
    filter('Project','project',[['','All projects'],...possible.map(p=>[p.id,p.code+' · '+p.name])],state.project)+'</div>'+
    (state.notice?'<div class="notice" role="status">'+esc(state.notice)+'</div>':'')+pages[state.tab]()+'</main></div></div>'+renderModal();
}
const app=document.getElementById('app');
const getText=(f,key)=>String(f.get(key)??'').trim();
const getMoney=(f,key)=>{const value=getText(f,key);const n=Number(value);if(!value||!Number.isFinite(n)||n<0||n>1e9)throw Error('Enter a valid non-negative amount.');return cents(n)/100;};
const uid=prefix=>prefix+(globalThis.crypto?.randomUUID?.()??(Date.now().toString(36)+Math.random().toString(36).slice(2)));
function setModal(m) {
  state.error='';state.modal=m;render();
  document.querySelector('.modal input:not([readonly]), .modal select, .modal button')?.focus();
}
function action(key) {
  const [cmd,x,y]=key.split(':');
  const p=byProject(x), cost=db.costs.find(a=>a.id===x&&a.month===state.month);
  if(cmd==='close')return setModal(null);
  if((cmd==='new-project'||(cmd==='project'&&p))&&isFinance())return setModal({kind:'project',id:p?.id,title:p?'Edit project':'Add project'});
  if((cmd==='new-staff'||(cmd==='staff'&&byStaff(x)))&&isFinance())return setModal({kind:'staff',id:x,title:x?'Edit staff member':'Add staff member'});
  if(cmd==='revenue'&&canEditProject(p))return setModal({kind:'revenue',project:x,title:'Edit revenue forecast'});
  if((cmd==='new-allocation'||(cmd==='allocation'&&canEditProject(p)&&byStaff(y)))&&isDirector()&&viewProjects().length)
    return setModal({kind:'allocation',project:x,person:y,title:y?'Edit allocation':'Add staff allocation'});
  if(cmd==='new-cost'&&isDirector()&&['sub','expense'].includes(x)&&viewProjects().length)return setModal({kind:'cost',costKind:x,title:x==='sub'?'Add subcontractor cost':'Add expense'});
  if(cmd==='cost'&&cost&&canEditProject(byProject(cost.project)))return setModal({kind:'cost',costKind:cost.kind,id:cost.id,title:'Edit project cost'});
  if(cmd==='remove-allocation'&&canEditProject(p))return setModal({kind:'remove',target:cmd,x,y,title:'Remove allocation',description:'Remove this allocation from the selected month?'});
  if(cmd==='remove-cost'&&cost&&canEditProject(byProject(cost.project)))return setModal({kind:'remove',target:cmd,x,title:'Remove project cost',description:'Remove this cost from the selected month?'});
  if(cmd==='delete-project'&&isFinance()&&p)return setModal({kind:'remove',target:cmd,x,title:'Remove project',description:'Remove '+p.name+' from this demo?'});
}
function submit(form) {
  const m=state.modal;if(!m)return;
  const f=new FormData(form), v=key=>getText(f,key);
  try {
    if(m.kind==='project'&&isFinance()) {
      const old=byProject(m.id), code=v('code'),name=v('name'),portfolio=v('portfolio'),director=v('director'),status=v('status');
      const currency=v('currency')||old?.currency;
      if(!code||!name||!portfolio||!DIRECTORS.includes(director)||!STATUS.includes(status)||!MONEY.includes(currency))throw Error('Complete the project fields.');
      if(db.projects.some(p=>p.id!==m.id&&p.code.toLowerCase()===code.toLowerCase()))throw Error('This project code is already in use.');
      const row={id:old?.id??uid('p'),code,name,portfolio,director,currency,status};
      if(old)Object.assign(old,row);else db.projects.push(row);
      state.portfolio='';state.project='';state.search='';state.status='';
    } else if(m.kind==='staff'&&isFinance()) {
      const old=byStaff(m.id),name=v('name'),position=v('position'),type=v('type');
      if(!name||!position||!['Employment','B2B'].includes(type))throw Error('Complete the staff fields.');
      const row={id:old?.id??uid('e'),name,position,type,rates:{PLN:getMoney(f,'PLN'),EUR:getMoney(f,'EUR')}};
      if(old)Object.assign(old,row);else db.staff.push(row);
      state.staffSearch='';state.staffType='';
    } else if(m.kind==='revenue'&&canEditProject(byProject(m.project))) {
      const amount=getMoney(f,'amount'), a=db.revenue.find(x=>x.project===m.project&&x.month===state.month);
      if(a)a.amount=amount;else db.revenue.push({project:m.project,month:state.month,amount});
    } else if(m.kind==='cost'&&isDirector()) {
      const project=v('project'),label=v('label'),amount=getMoney(f,'amount'),old=db.costs.find(x=>x.id===m.id);
      if(!label||!canEditProject(byProject(project))||(old&&!canEditProject(byProject(old.project))))throw Error('Choose an assigned project and enter a description.');
      const row={id:old?.id??uid('c'),project,kind:m.costKind,month:state.month,label,amount};
      if(old)Object.assign(old,row);else db.costs.push(row);
    } else if(m.kind==='allocation'&&isDirector()) {
      const project=m.project||v('project'),person=m.person||v('person'),raw=v('pct'),pct=Number(raw);
      if(!canEditProject(byProject(project))||!byStaff(person)||!raw||!Number.isInteger(pct)||pct<0||pct>100)throw Error('Choose an assigned project and enter a percentage from 0 to 100.');
      const a=db.allocations.find(x=>x.project===project&&x.person===person&&x.month===state.month);
      if(a)a.pct=pct;else db.allocations.push({project,person,month:state.month,pct});
      const total=allocTotal(person,state.month);
      if(total>100)state.notice=byStaff(person).name+' is allocated '+total+'% in '+formatMonth(state.month)+'.';
    } else if(m.kind==='remove') {
      if(m.target==='remove-allocation'&&canEditProject(byProject(m.x)))db.allocations=db.allocations.filter(x=>x.project!==m.x||x.person!==m.y||x.month!==state.month);
      else if(m.target==='remove-cost'&&db.costs.some(x=>x.id===m.x&&canEditProject(byProject(x.project))))db.costs=db.costs.filter(x=>x.id!==m.x);
      else if(m.target==='delete-project'&&isFinance()&&![...db.costs,...db.allocations,...db.revenue].some(a=>a.project===m.x))db.projects=db.projects.filter(p=>p.id!==m.x);
      else throw Error('This record cannot be removed.');
    } else throw Error('This demo role cannot change this record.');
    if(!state.notice)state.notice=m.kind==='remove'?'Record removed.':'Changes saved.';
    persist();setModal(null);
  } catch(error) {
    state.error=error.message;
    const oldError=form.querySelector('.field-error');if(oldError)oldError.remove();
    const msg=document.createElement('p');msg.className='field-error';msg.setAttribute('role','alert');msg.textContent=state.error;form.querySelector('.buttons').before(msg);
  }
}
app.addEventListener('click',e=>{
  const target=e.target.closest('button');if(!target)return;
  if(target.dataset.tab&&allowedTab(target.dataset.tab)){state.tab=target.dataset.tab;state.notice='';render();return;}
  if(target.dataset.openProject&&permitted().some(p=>p.id===target.dataset.openProject)){
    state.project=target.dataset.openProject;state.tab='reports';state.notice='';render();return;
  }
  if(target.dataset.act){state.notice='';action(target.dataset.act);}
});
app.addEventListener('change',e=>{
  const id=e.target.id, value=e.target.value;
  if(['role','director','portfolio','project','month','status','staffType'].includes(id)&&value!==state[id]){
    if(id==='month'&&!/^\d{4}-\d{2}$/.test(value))return;
    state[id]=value;state.notice='';if(['role','director'].includes(id)){state.portfolio='';state.project='';state.modal=null;}
    if(id==='portfolio')state.project='';
    render();document.getElementById(id)?.focus();
  }
});
app.addEventListener('input',e=>{
  const id=e.target.id;if(!['search','staffSearch'].includes(id))return;
  const n=e.target.selectionStart;state[id]=e.target.value;render();const input=document.getElementById(id);input.focus();input.setSelectionRange(n,n);
});
app.addEventListener('submit',e=>{if(e.target.id==='edit-form'){e.preventDefault();submit(e.target);}});
document.addEventListener('keydown',e=>{
  if(state.modal&&e.key==='Escape'){setModal(null);return;}
  if(!state.modal||e.key!=='Tab')return;
  const items=[...document.querySelectorAll('.modal button,.modal input,.modal select')].filter(i=>!i.disabled);
  const first=items[0],last=items[items.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
});
render();
})();
