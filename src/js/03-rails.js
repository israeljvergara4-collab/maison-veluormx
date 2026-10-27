(function(){
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $$(q,r){return Array.prototype.slice.call((r||document).querySelectorAll(q))}
  $$('.hki img').forEach(function(i){var s=document.querySelector(i.dataset.from);if(s)i.src=s.src});
  $$('.model').forEach(function(m){
    var rail=m.querySelector('.rail'),sl=$$('.slide',rail),bt=$$('.rseg button',m),t=0,cur=0;
    function fit(){rail.style.height=sl[cur].offsetHeight+'px'}
    function upd(){t=0;var i=Math.round(rail.scrollLeft/rail.clientWidth);if(i!==cur){cur=i;fit()}bt.forEach(function(b,j){b.setAttribute('aria-pressed',j===cur?'true':'false')})}
    function go(i){rail.scrollTo({left:i*rail.clientWidth,behavior:reduce?'auto':'smooth'})}
    rail.addEventListener('scroll',function(){if(!t)t=requestAnimationFrame(upd)},{passive:true});
    bt.forEach(function(b,j){b.addEventListener('click',function(){go(j)})});
    $$('[data-go]',m).forEach(function(b){b.addEventListener('click',function(){go(1)})});
    if('ResizeObserver' in window){var ro=new ResizeObserver(fit);sl.forEach(function(s){ro.observe(s)})}
    addEventListener('resize',function(){rail.scrollLeft=cur*rail.clientWidth;fit()});
    fit();
  });
})();
