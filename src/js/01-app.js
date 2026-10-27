/* ============ CONFIGURACIÓN (edita aquí) ============ */
var WA_NUM='522295249625';                       // WhatsApp: 52 + tu número
var PROMO={activa:true,descuento:15,hasta:'2 de noviembre',nombre:'Día de Muertos × Halloween'}; // descuento en %; activa:false lo apaga
var CATALOGO={
  'ball-star':{marca:'Golden Goose',modelo:'Ball Star',precio:590},
  'super-star':{marca:'Golden Goose',modelo:'Super-Star',precio:620},
  'stardan':{marca:'Golden Goose',modelo:'Stardan',precio:640},
  'replica':{marca:'Maison Margiela',modelo:'Replica',precio:780}
};
(function(){
  'use strict';
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(q,r){return (r||document).querySelector(q)}function $$(q,r){return Array.prototype.slice.call((r||document).querySelectorAll(q))}
  function money(n){return '$'+Math.round(n).toLocaleString('es-MX')}
  function unit(p){return PROMO.activa?Math.round(p*(1-PROMO.descuento/100)):p}
  /* ----- textos de la promoción ----- */
  $$('[data-pct]').forEach(function(e){e.textContent=PROMO.descuento});$$('[data-hasta]').forEach(function(e){e.textContent=PROMO.hasta});$$('[data-nombre]').forEach(function(e){e.textContent=PROMO.nombre});
  if(!PROMO.activa){$$('.promo,.chip,.hkp').forEach(function(e){e.hidden=true})}
  /* ----- cesta guardada en el navegador (con manejo de errores) ----- */
  var KEY='mv_cesta_v1',mem=[];
  function valid(i){return i&&typeof i.pid==='string'&&CATALOGO[i.pid]&&typeof i.size==='string'&&i.qty>0&&i.qty<=99}
  function load(){try{var r=localStorage.getItem(KEY),a=r?JSON.parse(r):[];return Array.isArray(a)?a.filter(valid):[]}catch(e){return mem.slice()}}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(cart))}catch(e){mem=cart.slice()}}
  var cart=load();
  function img(it){var m=$('#'+it.pid+' .cw img[data-i="'+(+it.vi||0)+'"]');return m?m.src:''}
  function totals(){var sub=0,tot=0,n=0;cart.forEach(function(it){var p=CATALOGO[it.pid].precio;sub+=p*it.qty;tot+=unit(p)*it.qty;n+=it.qty});return{sub:sub,tot:tot,n:n}}
  function render(){
    var t=totals(),ul=$('#cli');ul.innerHTML='';
    cart.forEach(function(it,ix){
      var c=CATALOGO[it.pid],li=document.createElement('li'),im=document.createElement('img'),d=document.createElement('div');
      im.src=img(it);im.alt='';d.className='ci';
      var b=document.createElement('b');b.textContent=c.marca+' '+c.modelo;
      var sp=document.createElement('span');sp.textContent=it.color+' · talla '+it.size;
      var r=document.createElement('div');r.className='cr';
      var q=document.createElement('div');q.className='qty';
      [['-1','Menos','−'],['1','Más','+']].forEach(function(x,k){
        if(k===1){var o=document.createElement('output');o.textContent=it.qty;q.appendChild(o)}
        var bt=document.createElement('button');bt.type='button';bt.textContent=x[2];bt.setAttribute('aria-label',x[1]+' '+c.modelo);bt.dataset.ix=ix;bt.dataset.d=x[0];q.appendChild(bt);
      });
      var pr=document.createElement('span');pr.className='p';pr.textContent=money(unit(c.precio)*it.qty);
      var rm=document.createElement('button');rm.type='button';rm.className='rm';rm.textContent='Quitar';rm.dataset.rm=ix;
      r.appendChild(q);r.appendChild(pr);d.appendChild(b);d.appendChild(sp);d.appendChild(r);d.appendChild(rm);li.appendChild(im);li.appendChild(d);ul.appendChild(li);
    });
    $('#cem').hidden=t.n>0;$('#cf').hidden=t.n===0;ul.hidden=t.n===0;
    $('#csub').textContent=money(t.sub);$('#ctot').textContent=money(t.tot);
    var dr=$('#cdrow');dr.hidden=!PROMO.activa;$('#cdl').textContent='Descuento −'+PROMO.descuento+'%';$('#cdis').textContent='−'+money(t.sub-t.tot);
    $('#cpr').textContent=PROMO.activa?PROMO.nombre+': −'+PROMO.descuento+'% y envío gratis hasta el '+PROMO.hasta:'';
    $$('[data-cc]').forEach(function(e){e.textContent=t.n;e.dataset.n=t.n});
    var L=cart.map(function(it){var c=CATALOGO[it.pid];return '• '+it.qty+' × '+c.marca+' '+c.modelo+' ('+it.color+'), talla '+it.size+' — '+money(unit(c.precio)*it.qty)});
    var msg='Hola, quiero hacer este pedido en Maison Velour:\n'+L.join('\n')+(PROMO.activa?'\nDescuento '+PROMO.nombre+': −'+PROMO.descuento+'%':'')+'\nEnvío: gratis\nTotal: '+money(t.tot);
    $('#cwa').href='https://wa.me/'+WA_NUM+'?text='+encodeURIComponent(msg);
  }
  function bump(){$$('[data-cc]').forEach(function(e){e.classList.remove('bump');void e.offsetWidth;if(!reduce)e.classList.add('bump')})}
  /* ----- panel lateral ----- */
  var dr=$('#cdr'),ov=$('#cov'),last=null;
  function openC(){last=document.activeElement;render();dr.classList.add('open');ov.classList.add('open');dr.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';setTimeout(function(){$('.cx').focus()},30)}
  function closeC(){dr.classList.remove('open');ov.classList.remove('open');dr.setAttribute('aria-hidden','true');document.body.style.overflow='';if(last&&last.focus)last.focus()}
  $$('[data-open-cart]').forEach(function(b){b.addEventListener('click',openC)});
  $('.cx').addEventListener('click',closeC);ov.addEventListener('click',closeC);$('#cgo').addEventListener('click',closeC);
  document.addEventListener('keydown',function(e){
    if(!dr.classList.contains('open'))return;
    if(e.key==='Escape'){closeC();return}
    if(e.key==='Tab'){var f=$$('button,a[href],input',dr).filter(function(x){return !x.closest('[hidden]')&&x.offsetParent!==null});if(!f.length)return;var a=f[0],z=f[f.length-1];
      if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}}
  });
  dr.addEventListener('click',function(e){
    var t=e.target;if(t.dataset.d){var it=cart[+t.dataset.ix];if(it){it.qty=Math.min(99,it.qty+(+t.dataset.d));if(it.qty<1)cart.splice(+t.dataset.ix,1);save();render()}}
    if(t.dataset.rm!==undefined){cart.splice(+t.dataset.rm,1);save();render()}
  });
  $('#cclr').addEventListener('click',function(){cart=[];save();render()});
  /* ----- cada par: color, talla, cantidad, agregar ----- */
  $$('.pair').forEach(function(sec){
    var pid=sec.id,c=CATALOGO[pid],box=$('[data-sizes]',sec),imgs=$$('.cw img',sec),msg=$('.msg',sec),ask=$('.ask',sec),pe=$('[data-price]',sec);
    sec.dataset.vi=0;sec.dataset.qty=1;
    function price(){pe.textContent='';if(PROMO.activa){var s=document.createElement('s');s.textContent=money(c.precio);var b=document.createElement('b');b.textContent=money(unit(c.precio));pe.appendChild(s);pe.appendChild(b)}else pe.textContent=money(c.precio)}price();
    function color(){var v=$('.vn,.vn1',sec);return v?v.textContent:''}
    function link(){var t='Hola, me interesa '+c.marca+' '+c.modelo+' ('+color()+')'+(sec.dataset.size?' talla '+sec.dataset.size:'')+'. ¿Lo tienen disponible?';ask.href='https://wa.me/'+WA_NUM+'?text='+encodeURIComponent(t)}
    [38,39,40,41,42,43,44].forEach(function(n){
      var b=document.createElement('button');b.type='button';b.textContent=n;b.setAttribute('aria-pressed','false');
      b.addEventListener('click',function(){$$('button',box).forEach(function(x){x.setAttribute('aria-pressed','false')});b.setAttribute('aria-pressed','true');sec.dataset.size=n;box.classList.remove('err');msg.textContent='';link()});box.appendChild(b)});
    $$('.sw .c',sec).forEach(function(b){b.addEventListener('click',function(){
      $$('.sw .c',sec).forEach(function(x){x.setAttribute('aria-pressed','false')});b.setAttribute('aria-pressed','true');
      imgs.forEach(function(im){im.classList.toggle('on',im.dataset.i===b.dataset.i)});sec.dataset.vi=b.dataset.i;var mm=sec.closest('.model');if(mm)mm.style.setProperty('--sbg',imgs[+b.dataset.i].dataset.bg);$('.vn',sec).textContent=b.getAttribute('aria-label');link()})});
    $$('.qty button',sec).forEach(function(b){b.addEventListener('click',function(){var q=Math.max(1,Math.min(99,(+sec.dataset.qty)+(+b.dataset.q)));sec.dataset.qty=q;$('.qty output',sec).textContent=q})});
    $('.add',sec).addEventListener('click',function(){
      if(!sec.dataset.size){box.classList.add('err');msg.textContent='Elige tu talla para agregar este par.';return}
      var vi=+sec.dataset.vi,q=+sec.dataset.qty,f=cart.filter(function(i){return i.pid===pid&&i.vi===vi&&i.size===sec.dataset.size})[0];
      if(f)f.qty=Math.min(99,f.qty+q);else cart.push({pid:pid,vi:vi,color:color(),size:String(sec.dataset.size),qty:q});
      save();render();bump();
      var a=$('.add',sec);a.textContent='✓ Agregado';msg.textContent=q+' × '+c.modelo+' ('+color()+') talla '+sec.dataset.size+' en tu cesta.';
      setTimeout(function(){a.textContent='Agregar a la cesta'},1600)});
    link();
  });
  render();
  /* ----- botón flotante de cesta al bajar del inicio ----- */
  var fab=$('.cfab'),vp=$('.vp');
  if('IntersectionObserver' in window&&vp){new IntersectionObserver(function(es){fab.classList.toggle('show',!es[0].isIntersecting)},{threshold:0}).observe(vp)}else fab.classList.add('show');
  /* ----- aparición al hacer scroll, parallax y luz con el cursor ----- */
  var items=$$('.pair,.hook,.promo,.auth');
  if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.2});items.forEach(function(x){io.observe(x)})}else items.forEach(function(x){x.classList.add('in')});
  if(!reduce){
    var ps=$$('[data-p]'),t=false;
    function upd(){t=false;var h=innerHeight;ps.forEach(function(p){var r=p.getBoundingClientRect(),k=(r.top+r.height/2-h/2)/h;p.style.setProperty('--ty',(k*-30).toFixed(1)+'px');p.style.setProperty('--rz',(k*-2).toFixed(2)+'deg')})}
    addEventListener('scroll',function(){if(!t){t=true;requestAnimationFrame(upd)}},{passive:true});upd();
    document.addEventListener('pointermove',function(e){var x=e.target.closest&&e.target.closest('.stage');if(!x)return;var r=x.getBoundingClientRect();x.style.setProperty('--mx',((e.clientX-r.left)/r.width*100).toFixed(1)+'%');x.style.setProperty('--my',((e.clientY-r.top)/r.height*100).toFixed(1)+'%')});
  }
  var go=$('#go'),mi=$('#mail');if(go)go.addEventListener('click',function(){go.href='https://wa.me/'+WA_NUM+'?text='+encodeURIComponent('Hola, avísenme cuando llegue: '+(mi.value.trim()||'mi modelo y talla'))});
})();
