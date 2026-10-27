(function(){
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches,SLOT=3400,cur=-1,tm;
  var D=[['replica','#replica .cw img[data-i="2"]','Maison Margiela','Replica'],['ball-star','#ball-star .cw img[data-i="1"]','Golden Goose','Ball Star'],['super-star','#super-star .cw img[data-i="0"]','Golden Goose','Super-Star'],['replica','#replica .cw img[data-i="6"]','Maison Margiela','Replica']];
  var W=document.querySelectorAll('.w'),SD=document.querySelectorAll('.sd'),PL=document.querySelectorAll('.pl'),DT=document.querySelectorAll('.dt'),vp=document.querySelector('.vp');
  document.querySelector('.vh').style.setProperty('--slot',SLOT+'ms');
  D.forEach(function(d,i){var src=document.querySelector(d[1]);if(src){SD[i].querySelector('img').src=src.src;SD[i].style.background=src.dataset.bg;SD[i].querySelector('.gl').style.setProperty('--m','url("'+src.src+'")')}});
  function st(el,c){el.classList.remove('in','out');void el.offsetWidth;el.classList.add(c)}
  function go(i){
    i=(i+4)%4;var p=cur;cur=i;
    if(p>=0&&p!==i){W[p].classList.remove('on');st(W[p],'out');st(SD[p],'out')}
    W[i].classList.add('on');st(W[i],'in');st(SD[i],'in');
    PL.forEach(function(l,j){l.classList.toggle('on',j===i)});
    DT.forEach(function(d,j){d.classList.remove('on');if(j===i){void d.offsetWidth;if(!reduce)d.classList.add('on');else d.classList.add('on')}});
    document.getElementById('cn').textContent='0'+(i+1)+' / 04';document.getElementById('cb').textContent=D[i][2];document.getElementById('cm').textContent=D[i][3];
    document.getElementById('cl').href='#c-'+D[i][0];document.getElementById('sbw').classList.toggle('hl',i===3);
    sch();
  }
  function sch(){clearTimeout(tm);if(!reduce&&!document.hidden)tm=setTimeout(function(){go(cur+1)},SLOT)}
  DT.forEach(function(d){d.addEventListener('click',function(){go(+d.dataset.i)})});
  document.addEventListener('visibilitychange',function(){if(document.hidden)clearTimeout(tm);else go(cur)});
  go(0);
  if(matchMedia('(hover:hover) and (pointer:fine)').matches&&!reduce){
    var sp=document.querySelector('.spot'),r=0;
    vp.addEventListener('pointermove',function(e){if(r)return;r=requestAnimationFrame(function(){r=0;var b=vp.getBoundingClientRect();
      sp.style.transform='translate('+((e.clientX-b.left)/b.width-.5)*40+'px,'+((e.clientY-b.top)/b.height-.5)*24+'px)'})});
  }
  var nums=document.querySelectorAll('[data-n]');
  function count(){nums.forEach(function(el){var n=+el.dataset.n,x=el.dataset.x||'',t0=null;
    if(reduce){el.textContent=n+x;return}
    function f(t){if(!t0)t0=t;var k=Math.min((t-t0)/1200,1),e=1-Math.pow(1-k,3);el.textContent=Math.round(n*e)+x;if(k<1)requestAnimationFrame(f)}requestAnimationFrame(f)})}
  var vs=document.querySelector('.vs');
  if('IntersectionObserver' in window){var o=new IntersectionObserver(function(es){if(es[0].isIntersecting){count();o.disconnect()}},{threshold:.4});o.observe(vs)}
})();
