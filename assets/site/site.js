/* OPIIUS site behaviour: menu, scroll reveal, hero search, car availability sheet and the "get matched" request form.
   Requests open WhatsApp to the OPIIUS number in assets/opiius/config.js. If config.bookingLog is set, each request is
   also logged (reference, agency, car, dates; never the customer's name or number). */
(function(){
  var CFG=window.OPIIUS_CONFIG||{}, WA=CFG.whatsapp||"918638830682";
  var $=function(s,el){return (el||document).querySelector(s)}, $$=function(s,el){return [].slice.call((el||document).querySelectorAll(s))};
  var inr=function(n){return "₹"+Number(n).toLocaleString("en-IN")};
  var esc=function(s){return String(s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
  var iso=function(d){return new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)};
  var fmt=function(v){return v?new Date(v+"T00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}):""};
  function ref(){var d=new Date();return "OP-"+String(d.getFullYear()).slice(2)+("0"+(d.getMonth()+1)).slice(-2)+("0"+d.getDate()).slice(-2)+"-"+Math.random().toString(36).slice(2,7).toUpperCase()}
  function openWA(text){window.open("https://wa.me/"+WA+"?text="+encodeURIComponent(text),"_blank","noopener")}
  function log(rec){
    if(!CFG.bookingLog)return;
    var body=JSON.stringify(Object.assign({},rec,{page:location.pathname.slice(0,120),ua:/Mobi/i.test(navigator.userAgent)?"mobile":"desktop"}));
    try{if(navigator.sendBeacon&&navigator.sendBeacon(CFG.bookingLog,new Blob([body],{type:"text/plain"})))return}catch(e){}
    try{fetch(CFG.bookingLog,{method:"POST",mode:"no-cors",keepalive:true,headers:{"Content-Type":"text/plain"},body:body})}catch(e){}
  }
  document.documentElement.classList.add("js");

  /* splash: keep the logo up for at least ~1.3 s, then fade out once the page has loaded (CSS hides it after 3.2 s regardless) */
  var sp=document.getElementById("splash");
  if(sp&&document.documentElement.classList.contains("splash")){
    var t0=Date.now(),shown=matchMedia("(prefers-reduced-motion: reduce)").matches?500:1300;
    var hide=function(){setTimeout(function(){sp.classList.add("out");setTimeout(function(){document.documentElement.classList.remove("splash")},600)},Math.max(0,shown-(Date.now()-t0)))};
    if(document.readyState==="complete")hide();else window.addEventListener("load",hide);
  }

  /* links from the old single-page site (opiius.online/#/...) */
  var h=location.hash;
  if(/^#\//.test(h)){
    var to=/^#\/(agency\/rd|vehicle\/rd-)/.test(h)?"/agency/real-drive-ghy/":/^#\/(rentals|vehicle|agencies|brand|compare)/.test(h)?"/rentals/self-drive-cars/guwahati/":
      /^#\/(tours|destination|package|operator)/.test(h)?"/rentals/":/^#\/partners/.test(h)?"/for-agencies/":null;
    if(to){location.replace(to);return}
  }

  /* background video: still image for reduced motion or data saver */
  var vid=$(".vbg");
  if(vid){var still=(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches)||(navigator.connection&&navigator.connection.saveData);
    if(still){vid.removeAttribute("autoplay");vid.pause();vid.preload="none"}else{var pl=vid.play();if(pl&&pl.catch)pl.catch(function(){})}}

  /* brand line: moves on its own, and can be swiped, dragged, scrolled or stepped with the arrows */
  $$(".brands").forEach(function(sec){
    var mq=sec.querySelector(".marquee"),tr=mq&&mq.querySelector(".track");if(!tr)return;
    var still=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
    var setW=function(){return tr.scrollWidth/4},pos=setW(),hold=0,drag=null,moved=false,last=0;
    mq.scrollLeft=pos;
    var pause=function(ms){hold=Math.max(hold,performance.now()+(ms||0))};
    /* keep the view inside the middle copies so it loops forever in both directions; returns the jump made */
    function wrap(){var w=setW(),d=0;if(w<=0)return 0;if(mq.scrollLeft>=w*2.5)d=-w;else if(mq.scrollLeft<w*0.5)d=w;if(d)mq.scrollLeft+=d;return d}
    function tick(t){
      var dt=last?Math.min(t-last,50):16;last=t;
      if(Math.abs(mq.scrollLeft-pos)>2)pos=mq.scrollLeft;          /* the visitor scrolled: follow them */
      if(!still&&!drag&&t>hold&&!sec.matches(":hover")){pos+=dt*0.035;mq.scrollLeft=pos}
      pos+=wrap();
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    mq.addEventListener("touchstart",function(){pause(2500)},{passive:true});
    mq.addEventListener("touchmove",function(){pause(2500)},{passive:true});
    mq.addEventListener("wheel",function(){pause(2000)},{passive:true});
    mq.addEventListener("focusin",function(){pause(4000)});
    mq.addEventListener("pointerdown",function(e){if(e.pointerType!=="mouse")return;drag={x:e.clientX,l:mq.scrollLeft};moved=false;mq.classList.add("drag")});
    window.addEventListener("pointermove",function(e){if(!drag)return;var dx=e.clientX-drag.x;if(Math.abs(dx)>4)moved=true;mq.scrollLeft=drag.l-dx;var d=wrap();drag.l+=d;pos=mq.scrollLeft});
    window.addEventListener("pointerup",function(){if(!drag)return;drag=null;mq.classList.remove("drag");pause(1500)});
    mq.addEventListener("click",function(e){if(moved){e.preventDefault();moved=false}},true);
    mq.addEventListener("dragstart",function(e){e.preventDefault()});
    sec.querySelectorAll("[data-bscroll]").forEach(function(b){b.addEventListener("click",function(){
      pause(900);mq.scrollBy({left:+b.dataset.bscroll*Math.max(300,mq.clientWidth*0.6),behavior:"smooth"})})});
  });

  /* mobile menu */
  var mb=$(".menu-btn"),mn=$(".mnav");
  if(mb&&mn){mb.addEventListener("click",function(){var o=mn.classList.toggle("open");mb.setAttribute("aria-expanded",o);document.body.style.overflow=o?"hidden":""})}

  /* reveal on scroll */
  if("IntersectionObserver" in window){
    var ro=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");ro.unobserve(e.target)}})},{rootMargin:"0px 0px -8% 0px"});
    $$(".rv").forEach(function(el){ro.observe(el)});
  }else $$(".rv").forEach(function(el){el.classList.add("in")});

  /* hero search: the "what" option carries the destination URL */
  var hs=$("#hsearch");
  if(hs)hs.addEventListener("submit",function(e){e.preventDefault();location.href=hs.querySelector("[name=what]").value});

  /* category chips: highlight the block in view */
  var chips=$$(".stick [data-nav]");
  if(chips.length&&"IntersectionObserver" in window){
    var co=new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;
      chips.forEach(function(a){a.setAttribute("aria-current",String(a.dataset.nav===e.target.id))});
      /* scroll only the chip bar sideways; scrollIntoView here would interrupt the page's own smooth scroll */
      var on=$('.stick [aria-current="true"]'),bar=on&&on.parentNode;if(bar)bar.scrollTo({left:on.offsetLeft-(bar.clientWidth-on.offsetWidth)/2,behavior:"smooth"})})},{rootMargin:"-40% 0px -55% 0px"});
    chips.forEach(function(a){var t=document.getElementById(a.dataset.nav);if(t)co.observe(t)});
  }

  /* ---------- car availability sheet ---------- */
  var fleetEl=$("#fleet-data"),dlg=$("#ask");
  if(fleetEl&&dlg){
    var cars=JSON.parse(fleetEl.textContent),byId={};cars.forEach(function(c){byId[c.id]=c});
    var sel=$("#aCar"),from=$("#aFrom"),to=$("#aTo");
    var today=iso(new Date());from.min=today;to.min=today;
    var days=function(){if(!from.value||!to.value)return 0;var n=Math.round((new Date(to.value)-new Date(from.value))/864e5);return n<0?-1:Math.max(1,n)};
    var update=function(){
      var c=byId[sel.value];if(!c)return;
      $("#aSel").innerHTML='<div class="t">'+(c.photo?'<img src="'+esc(c.photo)+'" alt="">':"")+'</div><div><b>'+esc(c.name)+'</b><span>'+esc(c.agencyName)+" · "+c.seats+" seats"+(c.trans?" · "+esc(c.trans):"")+" · "+inr(c.price)+" / day</span></div>";
      var n=days();$("#aDays").textContent=n>0?"Estimate for "+n+(n===1?" day":" days"):"Estimate";$("#aEst").textContent=n>0?inr(n*c.price):"—";
    };
    var open=function(id){
      if(id&&byId[id])sel.value=id;
      if(!from.value){var d=new Date();d.setDate(d.getDate()+1);from.value=iso(d);d.setDate(d.getDate()+2);to.value=iso(d)}
      $("#aErr").textContent="";update();
      if(dlg.showModal)dlg.showModal();else dlg.setAttribute("open","");
    };
    document.addEventListener("click",function(e){var b=e.target.closest("[data-ask]");if(b){e.preventDefault();open(b.dataset.ask)}});
    $("[data-close]",dlg).addEventListener("click",function(){dlg.close()});
    dlg.addEventListener("click",function(e){if(e.target===dlg)dlg.close()});
    sel.addEventListener("change",update);to.addEventListener("change",update);
    from.addEventListener("change",function(){to.min=from.value;if(to.value&&to.value<=from.value){var d=new Date(from.value);d.setDate(d.getDate()+1);to.value=iso(d)}update()});
    $("#askF").addEventListener("submit",function(e){
      e.preventDefault();
      var c=byId[sel.value],n=days(),name=$("#aName").value.trim(),err=$("#aErr");
      if(!from.value||!to.value){err.textContent="Please choose your pickup and return dates.";return}
      if(n<0){err.textContent="The return date is before the pickup date.";return}
      if(!name){err.textContent="Please add your name.";$("#aName").focus();return}
      var r=ref(),where=$("#aWhere").value;
      log({type:"rental",ref:r,agency:c.agency,agencyName:c.agencyName,vehicle:c.name,city:c.city,from:from.value,to:to.value,days:n,pricePerDay:c.price,total:n*c.price,pickup:where});
      openWA(["Hi OPIIUS, I'd like to book a car from "+c.agencyName+".","","Car: "+c.name+" ("+inr(c.price)+"/day)","Pickup: "+fmt(from.value)+", "+where,"Return: "+fmt(to.value),
        "Estimate: "+inr(n*c.price)+" for "+n+(n===1?" day":" days"),"Name: "+name,"","Ref: "+r].join("\n"));
      dlg.close();
    });
  }

  /* ---------- get matched ---------- */
  $$("form[data-match]").forEach(function(f){
    var need=f.querySelector("[name=need]"),fd=f.querySelector("[name=from]"),td=f.querySelector("[name=to]");
    var q=new URLSearchParams(location.search).get("need");
    if(q&&need&&[].some.call(need.options,function(o){return o.value===q}))need.value=q;
    if(fd){fd.min=iso(new Date());fd.addEventListener("change",function(){if(td){td.min=fd.value;if(td.value&&td.value<fd.value)td.value=fd.value}})}
    f.addEventListener("submit",function(e){
      e.preventDefault();
      var v=function(n){var el=f.querySelector("[name="+n+"]");return el?el.value.trim():""},err=f.querySelector(".err");
      if(!v("name")){err.textContent="Please add your name.";f.querySelector("[name=name]").focus();return}
      err.textContent="";
      var r=ref(),needTxt=need?need.options[need.selectedIndex].text:"";
      var dates=v("from")?(fmt(v("from"))+(v("to")&&v("to")!==v("from")?" to "+fmt(v("to")):"")):"Flexible";
      log({type:"request",ref:r,agency:"",agencyName:"Get matched",vehicle:needTxt,city:v("city"),from:v("from"),to:v("to")});
      var lines=["Hi OPIIUS, please match me with a trusted local agency.","","Need: "+needTxt,"Where: "+(v("city")||"Guwahati"),"Dates: "+dates];
      if(v("people"))lines.push("People: "+v("people"));
      if(v("budget"))lines.push("Budget: "+v("budget"));
      lines.push("Name: "+v("name"));
      if(v("msg"))lines.push("Details: "+v("msg"));
      lines.push("","Ref: "+r);
      openWA(lines.join("\n"));
    });
  });
  /* buttons that prefill the request form on the same page */
  document.addEventListener("click",function(e){
    var b=e.target.closest("[data-need]");if(!b)return;
    var f=$("form[data-match]");if(!f)return;e.preventDefault();
    var s=f.querySelector("[name=need]");if(s)s.value=b.dataset.need;
    var hdr=($(".hdr")||{offsetHeight:0}).offsetHeight+(($(".stick")||{offsetHeight:0}).offsetHeight||0);
    var box=f.closest(".panel")||f;window.scrollTo({top:box.getBoundingClientRect().top+window.pageYOffset-hdr-12,behavior:"smooth"});
    setTimeout(function(){var n=f.querySelector("[name=name]");if(n)n.focus({preventScroll:true})},700);
  });
})();
