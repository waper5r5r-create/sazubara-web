/* 연서의 인연 장부 — 시제품.
   1) 계산: 두 사람의 연인 자리(일지)가 어떻게 만나는지, 앞으로 90일 중 여우불이 켜지는 날(두 자리와 합)과 꺼지는 날(충)을 고른다.
   2) 화면: 연서가 메신저처럼 묻고 답을 받은 뒤, 결제 전 맛보기(장부 한 페이지·게이지·90일 달력)를 보여 준다.
   결제는 아직 연결하지 않는다. */
(function(){
'use strict';
var G = typeof globalThis!=='undefined' ? globalThis : window;

/* ---------- 계산 ---------- */
var SYMBOL = {'甲':'큰 소나무','乙':'덩굴과 들꽃','丙':'한낮의 해','丁':'밤의 등불','戊':'큰 산','己':'넓은 들판','庚':'바위','辛':'보석 원석','壬':'큰 강','癸':'새벽 이슬비'};
var LINE_OF = {liuhe:'tied',sanhe:'tied',chong:'cut',xing:'tangled',yuanjin:'tangled',hai:'tangled',same:'plain',none:'plain'};
var DAY_SCORE = {liuhe:2,sanhe:2,same:1,none:0,hai:-1,yuanjin:-1,xing:-1,chong:-2};

function eng(){ return G.YS_ENGINE; }
function tenGod(fromGan, toGan){ var e=eng(),zh=G.LunarUtil&&G.LunarUtil.SHI_SHEN[fromGan+toGan]; return (e&&e.SS_KR[zh])||''; }

/* 두 사람 관계: 연인 자리끼리의 관계, 장부 먹선 모양, 서로에게 어떤 십성인지 */
function pair(me, them){
  if (!them) return { line:'unknown', rel:null, meForThem:'', themForMe:'' };
  var rel = eng().zhiRelation(me.day.zhi, them.day.zhi);
  return { rel:rel, line:LINE_OF[rel]||'plain', meForThem:tenGod(them.day.gan, me.day.gan), themForMe:tenGod(me.day.gan, them.day.gan) };
}

function ymd(d){ return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
function addDays(d,n){ var x=new Date(d.getFullYear(),d.getMonth(),d.getDate()+n); return x; }
function pickSpaced(list, n, gap){
  var out=[];
  list.forEach(function(x){ if(out.length<n && out.every(function(o){ return Math.abs(o.i-x.i)>=gap; })) out.push(x); });
  return out.sort(function(a,b){ return a.i-b.i; });
}

/* 앞으로 90일: 날마다 그날의 땅 글자가 두 연인 자리와 어떻게 만나는지 본다.
   켜지는 날 = 점수가 가장 높은 날 3개(7일 이상 떨어지게), 꺼지는 날 = 어느 한쪽과 충인 날 중 가까운 3개. */
function days(me, them, start, n){
  n = n||90; start = start||addDays(new Date(),1);
  var e=eng(), rows=[];
  for (var i=0;i<n;i++){
    var d=addDays(start,i), g=e.todayGanZhi(d);
    var ra=e.zhiRelation(g.zhi, me.day.zhi), rb=them?e.zhiRelation(g.zhi, them.day.zhi):null;
    var s=DAY_SCORE[ra]+(rb?DAY_SCORE[rb]:0);
    if (rb && DAY_SCORE[ra]>0 && DAY_SCORE[rb]>0) s+=1;
    rows.push({ i:i, date:d, key:ymd(d), gan:g.gan, zhi:g.zhi, ganKr:g.ganKr, zhiKr:g.zhiKr, ra:ra, rb:rb, score:s, cut:ra==='chong'||rb==='chong' });
  }
  /* 두 자리 모두와 맞물리는 날을 먼저, 없으면 한쪽과 맞물리고 다른 쪽과 부딪히지 않는 날까지 */
  var need = 2;
  var bright = rows.filter(function(r){ return r.score>=need; }).sort(function(a,b){ return b.score-a.score||a.i-b.i; });
  var lights = pickSpaced(bright,3,7);
  var darks = pickSpaced(rows.filter(function(r){ return r.cut; }),3,7);
  var warm = rows.filter(function(r){ return r.score>0; }).length;
  return { rows:rows, lights:lights, darks:darks, warm:warm, gauge:Math.max(20,Math.min(95,Math.round(20+warm*1.6))) };
}

var LINE_TEXT = {
  tied:'둘 사이 줄은 아직 이어져 있어. 끝난 이유는 다른 데 있어.',
  cut:'줄이 한 번 세게 끊긴 자리야. 부딪히는 기운이 커서 떨어진 거지, 마음이 없던 건 아니야.',
  tangled:'끊긴 게 아니라 얽혀 있어. 서운함이 쌓여서 매듭이 된 거야.',
  plain:'줄이 느슨하게 걸려 있어. 누가 먼저 당기느냐에 따라 달라져.',
  unknown:'그 사람 생일을 알면 둘 사이 줄 모양까지 볼 수 있어. 지금은 네 쪽 장부만 읽을게.'
};

/* 유료 일곱 장은 서버(api/_yeonseo-content.js)가 엮는다. 화면은 사주 계산 결과(facts)만 보낸다. */
function weakest(r){ var c=r.wxCount||{},best=null,n=Infinity; ['목','화','토','금','수'].forEach(function(w){ var v=c[w]||0; if(v<n){n=v;best=w;} }); return best; }
function band(score){ return score>=4?'up':(score<=-3?'down':'flat'); }
function md(d){ return (d.getMonth()+1)+'월 '+d.getDate()+'일'; }
function rowScore(t,r){ return t+(r.rb?DAY_SCORE[r.rb]:DAY_SCORE[r.ra]); }
function factsOf(me, them, P, D, ans){
  ans=ans||{}; var weak=weakest(me);
  return { me:{gan:me.day.gan,zhi:me.day.zhi,weak:weak},
    them:them?{gan:them.day.gan,zhi:them.day.zhi,fills:((them.wxCount||{})[weak]||0)>=2}:null,
    rel:them?P.rel:null, line:P.line, meForThem:P.meForThem||'', themForMe:P.themForMe||'',
    near:D.rows.slice(0,30).reduce(rowScore,0), gauge:D.gauge,
    lights:D.lights.map(function(r){ return {md:md(r.date),gz:r.ganKr+r.zhiKr,k:(r.rb&&DAY_SCORE[r.ra]>0&&DAY_SCORE[r.rb]>0)?'both':(DAY_SCORE[r.ra]>0?'me':'them')}; }),
    darks:D.darks.map(function(r){ return md(r.date); }),
    months:[0,1,2].map(function(i){ var rs=D.rows.slice(i*30,i*30+30); return {range:md(rs[0].date)+' ~ '+md(rs[rs.length-1].date), band:band(rs.reduce(rowScore,0))}; }),
    ans:{kind:ans.kind||'',why:ans.why||'잘 모르겠어',who:ans.who||'자연스럽게',contact:ans.contact||'연락 안 해',letter:!!ans.letter} };
}

G.YeonseoCalc = { pair:pair, days:days, factsOf:factsOf, SYMBOL:SYMBOL, LINE_TEXT:LINE_TEXT };
if (typeof document==='undefined' || !document.createElement) return;

/* ---------- 화면 ----------
   세 가지 모드를 오간다.
   - 대화: 전면 그림 위 메신저 말풍선 + 아래 입력칸 (.ys-chat / .ys-input)
   - 웹툰 컷: 세로로 이어지는 컷, 그림 위에 둥근 말풍선·네모 내레이션·효과음 (.ys-comic)
   - 연출: 화면 전체 효과 2~4초 (.ys-fx) — 장부 펼침, 먹선, 여우불, 꼬리
   그림은 지금 기준 그림(hero) 한 장을 잘라 쓰고, 없는 컷은 번호표로 자리만 잡는다. */
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function josa(w,a,b){ var c=String(w).charCodeAt(String(w).length-1); return (c>=0xAC00&&c<=0xD7A3&&(c-0xAC00)%28)?a:b; }
var reduce = G.matchMedia && G.matchMedia('(prefers-reduced-motion: reduce)').matches;
var wait = function(ms){ return new Promise(function(r){ setTimeout(r, reduce?0:ms); }); };

var S = { me:null, them:null, name:'', themName:'', answers:{}, tails:0, input:{} };
var root, stage, chat, art, inputBox, tailsEl, vnBox, vnText, vnPrev, vnEcho, vnTap=null, echoTimer=0;

function mount(){
  root=document.createElement('div'); root.className='ys'; root.setAttribute('role','dialog'); root.setAttribute('aria-label','연서의 인연 장부');
  root.innerHTML='<div class="ys-stage"><div class="ys-art" aria-hidden="true"></div>'+
    '<header class="ys-top"><button type="button" class="ys-x ys-back" aria-label="별첩사주 콘텐츠로 돌아가기"><span aria-hidden="true">‹</span> 별첩사주</button><div class="ys-tails" aria-label="진행"></div></header>'+
    '<div class="ys-chat ys-vn"><p class="ys-vn-echo" aria-hidden="true"></p><div class="ys-input"></div>'+
    '<div class="ys-vn-box" role="status" aria-live="polite"><p class="ys-vn-name">연서</p><p class="ys-vn-prev" aria-hidden="true"></p><p class="ys-vn-text"></p></div></div></div>';
  document.body.appendChild(root); document.body.style.overflow='hidden';
  stage=root.querySelector('.ys-stage'); art=root.querySelector('.ys-art'); chat=root.querySelector('.ys-chat'); inputBox=root.querySelector('.ys-input'); tailsEl=root.querySelector('.ys-tails');
  tailsEl.innerHTML=new Array(10).join('<i></i>');
  vnBox=root.querySelector('.ys-vn-box'); vnText=root.querySelector('.ys-vn-text'); vnPrev=root.querySelector('.ys-vn-prev'); vnEcho=root.querySelector('.ys-vn-echo');
  vnBox.addEventListener('click',function(){ if(vnTap) vnTap(); });
  root.addEventListener('ended', onVidEnd, true);
  /* 돌아가기: 장부를 닫고 사이트의 콘텐츠 탭으로 */
  root.querySelector('.ys-x').addEventListener('click',function(){ root.remove(); document.body.style.overflow=''; var e=eng(); if(e&&e.home) e.home(); });
}
/* 장면 바꾸기: crop = 기준 그림을 어디까지 당겨 볼지(full/face/hand/low), mood = 밝기·색 */
function artUrl(id){ return 'url(/assets/yeonseo/'+id+'.webp), url(/assets/yeonseo/hero.webp)'; }
/* 장면 바꾸기: id = 그림 번호(F01…). 그림이 아직 없으면 기준 그림이 대신 보인다. */
/* 영상: 오래 머무는 화면은 처음=끝 장면인 반복 영상, 한 번 일어나는 장면은 한 번 재생 후 반복 영상으로 넘어간다 */
var VID='/assets/yeonseo/video/';
var LOOP={F01:'l-f01',F02:'l-f02',F03:'l-f03',F04:'l-f04',F06:'l-f06',F07:'l-f07',F08:'l-f08',F09:'l-f09',F10:'l-f10'};
var ONCE={};
function vidHtml(name, o){ o=o||{}; return '<video class="ys-v" muted playsinline preload="auto"'+(reduce||o.lazy?'':' autoplay')+(o.loop?' loop':'')+(o.next?' data-next="'+o.next+'"':'')+' poster="'+VID+name+'.webp" src="'+VID+name+'.mp4"></video>'; }
function sceneVid(id, lazy){ var once=ONCE[id], loop=LOOP[id]; if (once) return vidHtml(once,{next:loop,lazy:lazy}); return loop?vidHtml(loop,{loop:true,lazy:lazy}):''; }
function onVidEnd(e){ var v=e.target; if (!v.dataset || !v.dataset.next) return; var n=v.dataset.next; v.removeAttribute('data-next'); v.poster=VID+n+'.webp'; v.loop=true; v.src=VID+n+'.mp4'; v.play().catch(function(){}); }
function scene(id, mood){ art.style.backgroundImage=artUrl(id); art.dataset.crop=''; art.dataset.mood=mood||''; if (art.dataset.vid!==id){ art.dataset.vid=id; art.innerHTML=sceneVid(id); } }
function tail(n){ S.tails=Math.min(9,n==null?S.tails+1:n); var t=tailsEl.children; for(var i=0;i<t.length;i++) t[i].classList.toggle('on', i<S.tails); }

/* ---- 대화 모드 ---- */
/* 대사창: 한 줄씩 한 글자씩 써 내려간다. 창을 누르면 바로 다 보이고, 한 번 더 누르면 다음 줄로.
   누르지 않아도 글 길이만큼 기다렸다가 넘어간다. 마지막 줄은 다음 입력이 뜰 때까지 남겨 둔다. */
function plain(html){ var d=document.createElement('div'); d.innerHTML=html; return d.textContent; }
/* 한 줄씩 먹이 번지듯 나타난다. 바로 앞 줄은 위에 흐리게 남긴다 */
function typeLine(html){
  var text=plain(html);
  if (vnText.textContent){ vnPrev.textContent=vnText.textContent; vnPrev.classList.remove('show'); void vnPrev.offsetWidth; vnPrev.classList.add('show'); }
  vnText.textContent=text; vnText.classList.remove('ink'); void vnText.offsetWidth; vnText.classList.add('ink');
  return Promise.resolve(text);
}
function hold(ms){
  return new Promise(function(res){
    var t=setTimeout(go, reduce?0:ms);
    function go(){ clearTimeout(t); vnTap=null; res(); }
    vnTap=go;
  });
}
async function say(lines){
  vnBox.classList.add('in'); vnPrev.textContent=''; vnPrev.classList.remove('show'); vnText.textContent='';
  for (var i=0;i<lines.length;i++){
    var text=await typeLine(lines[i]);
    if (i<lines.length-1) await hold(Math.max(1500, text.length*60));
  }
}
/* 내 답: 대사창 위에 장부에 적힌 쪽지처럼 잠깐 떠오른다 */
function me(text){
  clearTimeout(echoTimer); vnEcho.textContent=text; vnEcho.classList.remove('show'); void vnEcho.offsetWidth; vnEcho.classList.add('show');
  echoTimer=setTimeout(function(){ vnEcho.classList.remove('show'); }, 2600);
}
function clearInput(){ inputBox.innerHTML=''; }
function validDate(s){ var y=+s.slice(0,4),m=+s.slice(4,6),d=+s.slice(6,8),x=new Date(y,m-1,d); return y>=1930&&y<=2015&&x.getMonth()===m-1&&x.getDate()===d; }
/* 입력 칸: 큰 문장("내 이름은…") 아래 밑줄 칸 하나와 답하는 말투의 버튼.
   o.q 문장, o.ph 자리 글, o.ok 버튼 글, o.skip 건너뛰기 글, o.mode 'text'|'date'|'time' */
function askLine(o){
  return new Promise(function(res){
    var mode=o.mode||'text', num=mode!=='text';
    inputBox.innerHTML='<form class="ys-ask"><p class="ys-ask-q">'+esc(o.q)+'</p><div class="ys-ask-row"><input class="ys-field" autocomplete="off" '+(num?'inputmode="numeric" maxlength="'+(mode==='date'?10:5)+'" ':'maxlength="12" ')+'placeholder="'+esc(o.ph)+'" aria-label="'+esc(o.q.replace(/…$/,''))+'"></div>'+
      '<p class="ys-ask-hint" role="status">'+esc(o.hint||'')+'</p><div class="ys-ask-btns">'+(o.skip?'<button type="button" class="ys-skip">'+esc(o.skip)+'</button>':'')+'<button class="ys-send" disabled>'+esc(o.ok)+'</button></div></form>';
    var form=inputBox.querySelector('form'), inp=form.querySelector('input'), btn=form.querySelector('.ys-send'), hint=form.querySelector('.ys-ask-hint');
    var value=function(){ var d=inp.value.replace(/\D/g,''); return mode==='date'?d:mode==='time'?d:inp.value.trim(); };
    var valid=function(){ var v=value();
      if (mode==='date') return v.length===8&&validDate(v);
      if (mode==='time') return v.length===4&&+v.slice(0,2)<24&&+v.slice(2)<60;
      return !!v; };
    inp.addEventListener('input',function(){
      if (mode==='date'){ var d=inp.value.replace(/\D/g,'').slice(0,8); inp.value=d.length>6?d.slice(0,4)+'.'+d.slice(4,6)+'.'+d.slice(6):d.length>4?d.slice(0,4)+'.'+d.slice(4):d; }
      if (mode==='time'){ var t=inp.value.replace(/\D/g,'').slice(0,4); inp.value=t.length>2?t.slice(0,2)+':'+t.slice(2):t; }
      var ok=valid(); btn.disabled=!ok;
      if (mode==='date'){ var v=value(); hint.textContent=ok?(+v.slice(0,4))+'년 '+(+v.slice(4,6))+'월 '+(+v.slice(6))+'일, 양력이지?':(v.length===8?'날짜를 다시 확인해 줘. 1930~2015년생까지 볼 수 있어.':(o.hint||'')); hint.classList.toggle('ok',ok); }
    });
    form.addEventListener('submit',function(e){ e.preventDefault(); if(btn.disabled) return; var v=value(); clearInput(); res(v); });
    var sk=form.querySelector('.ys-skip'); if(sk) sk.addEventListener('click',function(){ clearInput(); res(null); });
    setTimeout(function(){ inp.focus(); },50);
  });
}
function askText(q, ph, ok){ return askLine({q:q, ph:ph, ok:ok||'알려 주기'}); }/* 고르기: 장부 종이 위 칩. 누르면 붉은 낙관이 찍히고 넘어간다. sub = 칩 아래 작은 글 */
function askChoice(list, o){
  o=o||{};
  return new Promise(function(res){
    var cls=list.length<=3?' is-row':(o.cols===3?' is-grid3':' is-grid2')+(list.length%(o.cols||2)?' odd-last':'');
    inputBox.innerHTML='<div class="ys-choices'+cls+'">'+list.map(function(x,i){ return '<button type="button" data-i="'+i+'"><span>'+esc(x)+'</span>'+(o.sub&&o.sub[i]?'<small>'+esc(o.sub[i])+'</small>':'')+'</button>'; }).join('')+'</div>';
    var done=false;
    inputBox.querySelectorAll('[data-i]').forEach(function(b){ b.addEventListener('click',function(){
      if (done) return; done=true;
      b.classList.add('picked'); b.insertAdjacentHTML('beforeend','<i class="ys-seal" aria-hidden="true">緣</i>');
      inputBox.querySelector('.ys-choices').classList.add('chosen');
      setTimeout(function(){ clearInput(); res(list[+b.dataset.i]); }, reduce?0:520);
    }); });
  });
}
/* 생년월일: 년·월·일 세 칸. 한 칸을 채우면 다음 칸으로 넘어간다. 돌려주는 값은 YYYYMMDD */
function askDate(q, skip){ return askLine({q:q, ph:'1995.05.20', ok:'이 날이야', mode:'date', hint:'양력 생일로 적어 줘.', skip:skip}); }function timeLabel(h,m){ return (h<12?'오전':'오후')+' '+(h%12||12)+'시'+(m?' '+m+'분':''); }
async function askTime(){
  var v=await askLine({q:'내가 태어난 시간은…', ph:'13:30', ok:'이 시간이야', mode:'time', skip:'시간을 몰라'});
  if (!v) return null;
  var h=+v.slice(0,2), m=+v.slice(2);
  return {hour:h, minute:m, label:timeLabel(h,m)+'이야.'};
}function askLetter(){
  return new Promise(function(res){
    inputBox.innerHTML='<div class="ys-letter"><textarea maxlength="300" placeholder="예) 마지막에 내가 너무 차갑게 말한 게 계속 걸려." aria-label="하지 못한 말"></textarea><div class="ys-row"><button type="button" class="ys-skip">건너뛰기</button><button type="button" class="ys-send">장부에 적기</button></div></div>';
    var ta=inputBox.querySelector('textarea');
    inputBox.querySelector('.ys-send').addEventListener('click',function(){ var v=ta.value.trim(); clearInput(); res(v||null); });
    inputBox.querySelector('.ys-skip').addEventListener('click',function(){ clearInput(); res(null); });
  });
}
function chart(s, gender, name, t, city){ var known=!!t; return eng().computeSaju({year:+s.slice(0,4),month:+s.slice(4,6),day:+s.slice(6,8),hour:known?t.hour:12,minute:known?t.minute:0,isLunar:false,isLeapMonth:false,unknownTime:!known,gender:gender,name:name,city:city||'서울',useCorrection:true}); }

/* ---- 연출 모드 ---- */
function layer(cls, html){ var l=document.createElement('div'); l.className='ys-layer '+cls; l.innerHTML=html; stage.appendChild(l); return l; }
function tapToGo(l, label){
  return new Promise(function(res){
    var b=document.createElement('button'); b.type='button'; b.className='ys-go'; b.textContent=label||'계속';
    l.appendChild(b); setTimeout(function(){ b.classList.add('in'); b.focus(); }, reduce?0:400);
    b.addEventListener('click',function(){ l.classList.add('out'); setTimeout(function(){ l.remove(); res(); }, reduce?0:450); });
  });
}
function sparks(n){ var h=''; for(var i=0;i<n;i++) h+='<i style="--x:'+(Math.random()*100).toFixed(0)+'%;--d:'+(Math.random()*1.6).toFixed(2)+'s;--s:'+(0.6+Math.random()*0.8).toFixed(2)+'"></i>'; return '<div class="ys-sparks">'+h+'</div>'; }
async function fxTitle(){
  var l=layer('ys-fx ys-fx-title',vidHtml('v1-title',{loop:true})+'<div class="ys-title"><p>천 년 묵은 여우가 적어 둔</p><h1><img class="ys-logo" src="/assets/yeonseo/title-logo.webp" alt="여우의 인연 장부" width="800" height="475"></h1><small>끊긴 줄, 아직 이어져 있을까</small></div>'+sparks(14));
  await tapToGo(l,'장부 펼치기');
}
function ledgerCard(r){
  var cols=[['년',r.year],['월',r.month],['일',r.day],['시',r.unknownTime?null:r.time]].map(function(p,i){
    var x=p[1], day=p[0]==='일';
    return '<div class="ys-led-col'+(day?' is-day':'')+(x?'':' is-unknown')+'" style="--i:'+i+'"><small>'+p[0]+'</small><b>'+(x?x.gan:'·')+'</b><b>'+(x?x.zhi:'·')+'</b>'+(day?'<i class="ys-seal" aria-hidden="true">我</i>':'')+'</div>';
  }).reverse().join('');
  return '<div class="ys-led"><p class="ys-led-kicker">'+esc(S.name)+'의 장부</p><div class="ys-led-cols">'+cols+'</div>'+
    '<p class="ys-led-say">가운데 낙관 찍힌 기둥이 너야. <b>'+esc(r.day.gan+r.day.zhi)+'</b> · '+esc(SYMBOL[r.day.gan])+(r.unknownTime?'<br><small>태어난 시간을 모르면 시 기둥은 비워 둬.</small>':'')+'</p></div>';
}
async function fxLedger(r){
  var l=layer('ys-fx ys-fx-ledger',vidHtml('v2-ink-bloom')+sparks(18)+'<div class="ys-fx-card">'+ledgerCard(r)+'</div>');
  await wait(3600); l.classList.add('shown'); await tapToGo(l);
}
function lineSvg(line, draw){
  var path={tied:'M20 30 C 90 5, 150 55, 220 30',cut:'M20 30 C 60 18, 90 40, 108 30 M132 30 C 150 22, 180 42, 220 30',tangled:'M20 30 C 60 0, 80 60, 120 30 C 150 5, 160 55, 130 40 C 110 30, 170 20, 220 30',plain:'M20 30 C 90 45, 150 45, 220 30',unknown:'M20 30 C 60 30, 80 30, 110 30'}[line];
  return '<svg class="ys-line is-'+line+(draw?' draw':'')+'" viewBox="0 0 240 60" aria-hidden="true"><defs><filter id="ysBrush'+line+'" x="-5%" y="-30%" width="110%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="2.6"/></filter></defs><circle class="dot" cx="20" cy="30" r="3.4"/><circle class="dot" cx="220" cy="30" r="3.4"/><path pathLength="1" filter="url(#ysBrush'+line+')" d="'+path+'"/></svg>';
}
async function fxLine(P){
  var l=layer('ys-fx ys-fx-line',vidHtml('v6-ink-line')+'<div class="ys-sheet"><div class="ys-names"><span><b>'+esc(S.name)+'</b><small>'+esc(SYMBOL[S.me.day.gan])+'</small></span>'+lineSvg(P.line,true)+'<span><b>'+esc(S.themName)+'</b><small>'+esc(SYMBOL[S.them.day.gan])+'</small></span></div><p class="ys-sheet-say">'+esc(LINE_TEXT[P.line])+'</p></div>'+sparks(8));
  await wait(2600); l.classList.add('lit'); if (P.line==='cut') setTimeout(function(){ l.classList.add('shake'); }, 1300); await wait(2000); l.classList.add('shown'); await tapToGo(l);
}
async function fxFire(n){
  var l=layer('ys-fx ys-fx-fire',vidHtml('v3-calendar')+'<p class="ys-fx-cap"><span>앞으로 90일</span><b>여우불이 내려앉는 날을<br>찾고 있어</b></p>');
  for (var i=S.tails;i<=9;i++){ tail(i); await wait(120); }
  await wait(3200);
  var cap=l.querySelector('.ys-fx-cap'); cap.classList.add('found');
  cap.innerHTML=n?'<span>찾았다</span><b>여우불 '+n+'개</b>':'<span>앞으로 90일 안에는</span><b>여우불이 잘 안 켜져</b>';
  await wait(1900); l.classList.add('out'); await wait(450); l.remove();
}

/* ---- 웹툰 컷 모드 ----
   컷: {ratio, crop, label, bubbles:[{type:'round'|'box'|'sfx', text, pos}], tilt, html} */
function panelHtml(p){
  var b=(p.bubbles||[]).map(function(x){ return '<div class="ys-bb '+x.type+' '+(x.pos||'')+'">'+x.text+'</div>'; }).join('');
  var artPart = p.html ? '<div class="ys-pn-body">'+p.html+'</div>' : '<div class="ys-pn-art" data-crop="'+(p.crop||'full')+'" data-img="'+(p.img||'')+'"'+(p.img?' style="background-image:'+artUrl(p.img)+'"':'')+'>'+(p.label?'<span class="ys-ph">'+esc(p.label)+'</span>':'')+'</div>';
  return '<figure class="ys-pn'+(p.tilt?' tilt':'')+(p.frameless?' frameless':'')+'" style="--ratio:'+(p.ratio||'auto')+'">'+artPart+b+'</figure>';
}
function comic(panels, endLabel){
  return new Promise(function(res){
    var l=layer('ys-comic', panels.map(panelHtml).join('')+(endLabel?'<button type="button" class="ys-go in comic-end">'+esc(endLabel)+'</button>':''));
    var io='IntersectionObserver' in G ? new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('seen'); if(!reduce) e.target.querySelectorAll('video').forEach(function(v){ v.play().catch(function(){}); }); io.unobserve(e.target); } }); },{root:l,threshold:0,rootMargin:'0px 0px -12% 0px'}) : null;
    l.querySelectorAll('.ys-pn').forEach(function(p){ if(io) io.observe(p); else p.classList.add('seen'); });
    var end=l.querySelector('.comic-end');
    if (end) end.addEventListener('click',function(){ l.classList.add('out'); setTimeout(function(){ l.remove(); res(); }, reduce?0:450); });
    else res(l);
  });
}

/* ---- 흐름 (기획서 3장 콘티 순서) ---- */
function ymdKr(v){ return (+v.slice(0,4))+'년 '+(+v.slice(4,6))+'월 '+(+v.slice(6,8))+'일'; }
async function reopen(fromPay){
  var P=pair(S.me,S.them), D=days(S.me,S.them);
  scene('T1','result');
  if (await openPaid(P,D,null)) return true;
  if (fromPay){ showResult(P,D); }
  return false;
}
async function run(){
  mount(); scene('hero','night');
  if (/[?&]resume=1(&|$)/.test(location.search)){
    try { history.replaceState({},'',location.pathname+'?yeonseo=1'); } catch(e){}
    if (loadResume()){ chat.style.display='none'; await reopen(true); return; }
  }
  await fxTitle();                                                     /* 1 연출: 표지 */
  var old=loadResume();
  if (old){
    var oP=pair(S.me,S.them), oD=days(S.me,S.them), owned=null;
    try { owned=await fetchPaid(oP,oD); } catch(e){}
    if (owned&&owned.ok&&owned.paid){
      scene('F01','');
      await say([esc(S.name)+josa(S.name,'이','')+', 다시 왔네.','지난번 장부는 그대로 여기 있어.']);
      var again=await askChoice(['지난 장부 다시 보기','처음부터 새로 보기']);
      if (again==='지난 장부 다시 보기'){ chat.style.display='none'; await reopen(false); return; }
    }
    S={ me:null, them:null, name:'', themName:'', answers:{}, tails:0, input:{} };
  }
  scene('F01','');                                                     /* 2 대화: F01 */
  /* 사이트에 내 사주가 저장돼 있으면 그대로 이어받는다. 이름이 없을 때만 이름을 묻는다. */
  var mine=eng()&&eng().mine?eng().mine():null; if (mine&&!validDate(mine.ymd)) mine=null;
  if (mine){
    await say(['이 밤에 여기까지 찾아왔네.','나는 연서. 천 년 동안 사람들 인연을 이 장부에 적어 왔어.',
      (mine.name?esc(mine.name)+', ':'')+'네 사주는 별첩에 이미 적혀 있더라. '+ymdKr(mine.ymd)+'생, 그걸로 볼까?']);
    var useMine=await askChoice(['응, 그걸로 봐 줘','다른 사람 사주로 볼래']); me(useMine);
    if (useMine!=='응, 그걸로 봐 줘') mine=null;
  }
  if (mine){
    S.name=mine.name;
    if (!S.name){ scene('F02',''); await say(['장부에 적을 이름만 알려 줘.']); S.name=await askText('내 이름은…','이름 또는 별명'); me(S.name+josa(S.name,'이야.','야.')); }
    var mg=mine.gender==='m'?'남성':'여성', mt=mine.time?timeLabel(mine.time.hour,mine.time.minute):null;
    S.me = chart(mine.ymd, mine.gender, S.name, mine.time, mine.city); S.input={bd:mine.ymd,g:mg,bt:mine.time?{hour:mine.time.hour,minute:mine.time.minute,label:mt}:null,city:mine.city}; tail(2);
    scene('F03',''); await say([esc(S.name)+josa(S.name,'이','')+'… 장부에서 찾았어.']);
  } else {
  if (eng()&&eng().mine&&eng().mine()) await say(['좋아. 그럼 처음부터 적어 볼게.','이름부터 들어볼까?']);
  else await say(['이 밤에 여기까지 찾아왔네.','나는 연서. 천 년 동안 사람들 인연을 이 장부에 적어 왔어.','이름부터 들어볼까?']);
  scene('F02','');                                                     /* 3 대화: F02 */
  S.name = await askText('내 이름은…','이름 또는 별명'); me(S.name+josa(S.name,'이야.','야.')); tail();
  scene('F03','');                                                     /* 4 대화: F03 */
  await say([esc(S.name)+josa(S.name,'이','')+'… 좋은 이름이네.','태어난 날을 알려줘. 장부에서 찾아볼게.']);
  var bd = await askDate('내 생일은…'); me(ymdKr(bd)+'이야.');
  await say(['참, 너는 어느 쪽이야?']); var g = await askChoice(['여성','남성']); me(g+josa(g,'이야.','야.'));
  await say(['태어난 시간도 알아? 몰라도 괜찮아.']); var bt = await askTime(); me(bt?bt.label:'시간은 잘 몰라.');
  S.me = chart(bd, g==='남성'?'m':'f', S.name, bt); S.input={bd:bd,g:g,bt:bt}; tail();
  }
  await fxLedger(S.me);                                                /* 5 연출: 장부 펼침 + 원국 */
  await comic([                                                        /* 6~7 웹툰 컷 */
    {ratio:'3/2', img:'F04-a', crop:'eyes', label:'F04-a', bubbles:[{type:'round',text:'찾았다.',pos:'tr'},{type:'sfx',text:'번쩍',pos:'bl'}]},
    {ratio:'1/1', html:symbolHtml(S.me.day.gan), tilt:true, bubbles:[{type:'box',text:'너는 「'+esc(SYMBOL[S.me.day.gan])+'」 같은 사람이야.',pos:'b'}]}
  ],'그 사람 이야기로');
  scene('F04','ears');                                                 /* 8 대화: F04 */
  await say(['이제, 그 사람.','이름이랑 생일을 알면 둘 사이 줄 모양까지 볼 수 있어. 모르면 넘어가도 돼.']);
  /* 궁합 탭에서 넘어왔으면 그때 넣은 상대를 그대로 쓸지 먼저 묻는다. */
  var pre=eng()&&eng().them?eng().them():null; if (pre&&!validDate(pre.ymd)) pre=null;
  var tg, tb;
  if (pre){
    var pn=pre.name||'그 사람';
    await say(['궁합에서 본 '+esc(pn)+', '+ymdKr(pre.ymd)+'생. 그 사람 맞지?']);
    var same=await askChoice(['응, '+pn+josa(pn,'이야','야'),'다른 사람이야']); me(same);
    if (same==='다른 사람이야') pre=null;
  }
  if (pre){
    S.themName=pre.name||'그 사람'; tg=pre.gender==='m'?'남성':'여성'; tb=pre.ymd;
  } else {
  S.themName = await askText('그 사람 이름은…','이름 또는 별명'); me(S.themName+josa(S.themName,'이야.','야.'));
  tg = await askChoice(['남성','여성']); me(tg+josa(tg,'이야.','야.'));
  await say([esc(S.themName)+' 생일은?']);
  tb = await askDate('그 사람 생일은…','생일을 몰라');
  }
  S.input.tb=tb||null; S.input.tg=tg;
  if (tb){ if (!pre) me(ymdKr(tb)+'이야.'); S.them=chart(tb, tg==='여성'?'f':'m', S.themName); } else me('생일은 몰라.');
  tail();
  var P = pair(S.me, S.them);
  if (S.them) await fxLine(P);                                         /* 9 연출: 먹선 */
  scene('F06','');                                                     /* 10 F06 */
  await say(['둘은 어떤 사이였어?']);
  S.answers.kind = await askChoice(['썸','연인','오래된 연인','부부','짝사랑']); me(S.answers.kind); tail();
  scene('F07','rain');                                                 /* 11 F07 */
  await say(['그동안 마음고생 많았겠다.','어쩌다 멀어졌어?']);
  S.answers.why = await askChoice(['성격 차이·잦은 다툼','마음이 식음','일방적인 통보','장거리·취업 같은 바깥 사정','바람','잘 모르겠어']); me(S.answers.why); tail();
  scene('F08','');                                                     /* 12 F08 */
  await say(['누가 먼저 끝냈어?']);
  S.answers.who = await askChoice(['나','그 사람','자연스럽게']); me(S.answers.who); tail();
  scene('F09','fire');                                                 /* 13 F09 */
  await say(['지금 연락은 닿아?']);
  S.answers.contact = await askChoice(['차단됐어','연락 안 해','가끔 해','자주 해']); me(S.answers.contact); tail();
  scene('F10','');                                                     /* 14 F10 */
  await say(['차마 못 한 말 있으면 여기 적어. 그 사람한텐 안 보여.']);
  S.answers.letter = await askLetter(); if (S.answers.letter) me(S.answers.letter);
  var D = days(S.me, S.them);
  await fxFire(D.lights.length);                                       /* 15 연출: 여우불 */
  scene('T1','result');
  showResult(P, D);                                   /* 16~20 웹툰 컷 + 결제 */
}

var MONTHS_KR=['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
function calendarHtml(D){
  var lightKeys={}, darkKeys={};
  D.lights.forEach(function(r,i){ lightKeys[r.key]=i; }); D.darks.forEach(function(r){ darkKeys[r.key]=1; });
  var start=D.rows[0].date, end=D.rows[D.rows.length-1].date, html='', rest='', restHidden=0, y=start.getFullYear(), m=start.getMonth();
  /* 가장 가까운 여우불이 있는 달만 펼쳐 두고, 나머지 달은 접는다(90일 달력이 너무 길어서). */
  var openKey=D.lights.length?D.lights[0].date.getFullYear()+'-'+D.lights[0].date.getMonth():start.getFullYear()+'-'+start.getMonth();
  var s0=new Date(start.getFullYear(),start.getMonth(),start.getDate());
  while (y<end.getFullYear() || (y===end.getFullYear() && m<=end.getMonth())){
    var first=new Date(y,m,1), last=new Date(y,m+1,0).getDate(), cells='';
    for (var b=0;b<first.getDay();b++) cells+='<span></span>';
    for (var d=1; d<=last; d++){
      var k=y+'-'+(m+1)+'-'+d, dt=new Date(y,m,d), inRange=dt>=s0 && dt<=end;
      var cls=!inRange?'out':(k in lightKeys?(lightKeys[k]===0?'fire':'fire hide'):(darkKeys[k]?'dark':''));
      cells+='<span class="'+cls+'">'+(cls==='fire hide'?'?':d)+'</span>';
    }
    var month='<div class="ys-month"><p>'+y+'년 '+MONTHS_KR[m]+'</p><div class="ys-days"><b>일</b><b>월</b><b>화</b><b>수</b><b>목</b><b>금</b><b>토</b>'+cells+'</div></div>';
    if (y+'-'+m===openKey) html+=month; else { rest+=month; restHidden+=(cells.match(/fire hide/g)||[]).length; }
    m++; if (m>11){ m=0; y++; }
  }
  if (rest) html+='<details class="ys-more-months"><summary>다른 달도 보기'+(restHidden?' · 연기에 가린 날 '+restHidden+'개':'')+'</summary>'+rest+'</details>';
  return html;
}
/* 일간 상징: symbols.webp(5칸×2줄)에서 내 칸만 잘라 보여 준다 */
var GAN_ORDER='甲乙丙丁戊己庚辛壬癸';
function symbolHtml(gan){ var i=GAN_ORDER.indexOf(gan); return '<div class="ys-symbol has-art" style="background-position:'+((i%5)*25)+'% '+(i<5?0:100)+'%"><b>'+esc(SYMBOL[gan])+'</b></div>'; }
function fmt(d){ return (d.getMonth()+1)+'월 '+d.getDate()+'일'; }

function showResult(P, D){
  clearInput(); chat.style.display='none';
  var first=D.lights[0], meSym=SYMBOL[S.me.day.gan], themSym=S.them?SYMBOL[S.them.day.gan]:'?';
  var page='<div class="ys-page"><p class="ys-kicker dark">'+esc(S.name)+'의 장부 · 한 페이지</p><div class="ys-names"><span><b>'+esc(S.name)+'</b><small>'+esc(meSym)+'</small></span>'+lineSvg(P.line,true)+'<span><b>'+esc(S.themName||'그 사람')+'</b><small>'+esc(themSym)+'</small></span></div>'+
    '<p class="ys-say">"'+esc(LINE_TEXT[P.line])+'"</p>'+(P.rel?'<p class="ys-basis">근거 · 두 사람의 연인 자리(일지) '+esc(S.me.day.zhiKr||S.me.day.zhi)+' · '+esc(S.them.day.zhiKr||S.them.day.zhi)+'</p>':'')+'</div>';
  var cal='<div class="ys-calwrap"><div class="ys-gauge"><p>앞으로 90일, 여우불의 세기</p><div class="ys-bar"><i style="width:'+D.gauge+'%"></i></div></div>'+
    (first?'<p class="ys-cal-first">가장 가까운 날은 <b>'+fmt(first.date)+'</b>. '+(D.lights.length>1?'나머지 '+(D.lights.length-1)+'개는 연기에 가려 있어.':'')+'</p>':'<p class="ys-cal-first">90일 안에는 여우불이 잘 안 켜져. 왜 그런지는 장부 7장에 적어 뒀어.</p>')+
    calendarHtml(D)+'<p class="ys-legend"><span class="fire">●</span> 켜지는 날 <span class="dark">●</span> 연락을 아낄 날</p></div>';
  var pay='<div class="ys-paywall"><div class="ys-pn-art" data-img="T2" style="background-image:'+artUrl('T2')+'">'+sparks(10)+'</div>'+
    '<div class="ys-bb round tr">나머지 일곱 장은 봉인해 뒀어. 풀어 볼래?</div>'+
    '<div class="ys-locked"><p>장부의 나머지 일곱 장</p><ul><li>그 사람의 지금 마음</li><li>연락해도 되는 날 3개와 그날의 첫 문장</li><li>줄이 끊긴 진짜 이유</li><li>같은 이유로 끝나지 않으려면</li><li>먹을 씻어낼 때, 그리고 다음 이름</li></ul></div>'+
    '<div class="ys-pay"><button type="button" class="ys-open-paid">장부 전체 보기 · 9,900원</button><p>결제 즉시 제공 · 결제일로부터 1년간 다시 보기</p><p class="ys-refund">결제가 끝나면 환불이 제한돼요(오류·중복 결제 제외).</p><p class="ys-proto" role="status"></p></div></div>';
  comic([
    {ratio:'2/3', img:'T3', crop:'face', label:'T3', bubbles:[{type:'round',text:'자, 네 장부 한 페이지.',pos:'tl'},{type:'sfx',text:'펄럭',pos:'br'}]},
    {html:page, frameless:true},
    {html:cal, frameless:true, bubbles:[{type:'box',text:'여우불이 켜지는 날은, 두 사람 자리가 맞물리는 날이야.',pos:'t'}]},
    {ratio:'2/1', img:'F11', crop:'eyes', label:'F11', bubbles:[{type:'round',text:'근데 말이야… 그 사람 마음은 따로 적혀 있어.',pos:'b'},{type:'sfx',text:'스윽',pos:'tr'}]},
    {html:pay, frameless:true}
  ]).then(function(l){ var btn=l.querySelector('.ys-open-paid'); if(btn) btn.addEventListener('click',function(){ openPaid(P,D,l); }); });
}

/* ---- 결제하고 돌아오거나(1년간 다시 보기) 다시 들어왔을 때, 같은 장부를 다시 펼치려고 입력값을 이 기기에만 남긴다.
   못다 한 말(편지)은 남기지 않고, 적었는지만 기억한다. ---- */
var RESUME_KEY='ys-resume';
function saveResume(){
  try { localStorage.setItem(RESUME_KEY, JSON.stringify({name:S.name, themName:S.themName, input:S.input,
    answers:{kind:S.answers.kind, why:S.answers.why, who:S.answers.who, contact:S.answers.contact, letter:!!S.answers.letter}})); } catch(e){}
}
function loadResume(){
  var r=null; try { r=JSON.parse(localStorage.getItem(RESUME_KEY)||'null'); } catch(e){}
  if (!r||!r.input||!r.input.bd||!validDate(r.input.bd)) return null;
  S.name=r.name||''; S.themName=r.themName||''; S.input=r.input; S.answers=r.answers||{};
  S.me=chart(r.input.bd, r.input.g==='남성'?'m':'f', S.name, r.input.bt||null, r.input.city);
  S.them=r.input.tb&&validDate(r.input.tb)?chart(r.input.tb, r.input.tg==='여성'?'f':'m', S.themName):null;
  return r;
}
/* ---- 유료 일곱 장: 서버가 결제를 확인한 기기에만 본문을 내려준다 ---- */
var CONCEPT_ID='20271201-7a3e-4f1b-9c62-5d8e0b4a1f73';
function fetchPaid(P,D){
  var e=eng(), q='conceptId='+encodeURIComponent(CONCEPT_ID)+'&device_id='+encodeURIComponent((e&&e.device&&e.device())||'')+'&ys='+encodeURIComponent(JSON.stringify(factsOf(S.me,S.them,P,D,S.answers)));
  return fetch('/api/reports/list?'+q,{cache:'no-store'}).then(function(r){ if(!r.ok) throw new Error('PAID_FAILED'); return r.json(); });
}
function blockHtml(b){
  if (b.t==='say') return '<div class="ys-bb round in-flow">'+String(b.text).split('\n\n').map(esc).join('<br><br>')+'</div>';
  var paras=function(t){ return String(t).split('\n\n').map(function(p){ return '<p>'+esc(p)+'</p>'; }).join(''); };
  if (b.t==='sec') return '<section class="ys-sec"><h3>'+esc(b.head)+'</h3>'+paras(b.text)+'</section>';
  if (b.t==='months') return '<section class="ys-sec ys-months"><h3>'+esc(b.head)+'</h3>'+b.items.map(function(x,i){ return '<div class="ys-month-row"><b>'+(i+1)+'번째 달 · '+esc(x.range)+'</b>'+paras(x.text)+'</div>'; }).join('')+'</section>';
  if (b.t==='steps') return '<section class="ys-sec"><h3>'+esc(b.head)+'</h3><ol class="ys-steps">'+b.items.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ol></section>';
  if (b.t==='qa') return '<section class="ys-sec ys-qa"><h3>'+esc(b.head)+'</h3>'+b.items.map(function(x){ return '<details><summary>'+esc(x.q)+'</summary><p>'+esc(x.a)+'</p></details>'; }).join('')+'</section>';
  if (b.t==='note') return '<p class="ys-note">'+esc(b.text)+'</p>';
  if (b.t==='lines') return '<div class="ys-letters"><p>첫 문장 예시</p>'+b.items.map(function(x){ return '<div class="ys-b me">'+esc(x)+'</div>'; }).join('')+'</div>';
  if (b.t==='list') return '<div class="ys-signs"><p>'+esc(b.head)+'</p><ul>'+b.items.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul></div>';
  if (b.t==='charm') return '<div class="ys-charm"><p>'+esc(b.text)+'</p><small>저장해서 배경화면으로 써도 좋아.</small></div>';
  if (b.t==='days') return '<div class="ys-daylist">'+b.lights.map(function(x,i){ return '<div class="ys-day fire"><b>'+(i+1)+'번째 여우불 · '+esc(x.md)+'</b><small>'+esc(x.gz)+'일</small>'+paras(x.text)+'</div>'; }).join('')+
    (b.darks.length?'<div class="ys-day dark"><b>연락을 아낄 날 · '+b.darks.map(function(x){ return esc(x.md); }).join(', ')+'</b>'+paras(b.dark)+'</div>':'')+'</div>';
  return '<div class="ys-bb box in-flow">'+String(b.text).split('\n\n').map(esc).join('<br><br>')+'</div>';
}
async function openPaid(P,D,prev){
  var btn=prev&&prev.querySelector('.ys-open-paid'), msg=prev&&prev.querySelector('.ys-proto'), data=null;
  if (btn) btn.disabled=true;
  try { data=await fetchPaid(P,D); } catch(err){ data=null; }
  if (btn) btn.disabled=false;
  var ch=data&&data.ok&&data.paid;
  if (!ch){
    if (!prev) return false;
    if (!(data&&data.ok)){ if(msg) msg.textContent='장부를 가져오지 못했어요. 잠시 뒤 다시 눌러 줘.'; return false; }
    var e=eng(); if (!e||!e.buy){ if(msg) msg.textContent='결제창을 열지 못했어요. 잠시 뒤 다시 눌러 줘.'; return false; }
    saveResume(); G.YS_ON_OWNED=function(){ openPaid(P,D,prev); };
    if (msg) msg.textContent='결제창을 여는 중이에요…';
    e.buy(); setTimeout(function(){ if(msg&&msg.isConnected) msg.textContent=''; }, 6000);
    return false;
  }
  saveResume();
  if (prev){ prev.classList.add('out'); setTimeout(function(){ prev.remove(); }, reduce?0:450); }
  var panels=[{ratio:'2/3', img:'T3', label:'T3', bubbles:[{type:'round',text:'좋아. 이제 장부 전부 펼쳐 줄게.',pos:'tl'}]}];
  ch.forEach(function(c){
    panels.push({html:'<div class="ys-chap"><div class="ys-chap-art" style="background-image:'+artUrl(c.img)+'"><span>'+(c.no?c.no+'장':'덤')+'</span><h2>'+esc(c.title)+'</h2></div>'+c.blocks.map(blockHtml).join('')+'</div>', frameless:true});
  });
  if (typeof G.reviewSlot === 'function') panels.push({html: G.reviewSlot('20271201-7a3e-4f1b-9c62-5d8e0b4a1f73'), frameless: true});
  comic(panels); return true;
}


if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ run(); }); else run();
})();
