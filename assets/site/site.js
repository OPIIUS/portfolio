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

  /* phone tab bar: the bar has a notch, and a circle carrying the active icon springs from tab to tab.
     Tapping a tab plays the motion, then opens the page; the next page starts where the last one ended. */
  var tbar=$(".tabbar");
  if(tbar){
    var tabs=$$(".tb",tbar),ball=$(".tb-ball",tbar),svg=$(".tb-bg",tbar),path=$("path",svg),TK="op-tab";
    var still=matchMedia("(prefers-reduced-motion: reduce)").matches;
    var tabKey=function(){var p=location.pathname.replace(/index\.html$/,""),h=location.hash;
      if(mn&&mn.classList.contains("open"))return "menu";
      if(p==="/")return "home";
      if(p==="/get-matched/"&&/cars-with-driver/.test(location.search))return "driver";
      if(p==="/rentals/")return h==="#cars-with-driver"?"driver":h==="#liked"?"liked":"rentals";
      if(/^\/(rentals|agency)\//.test(p))return "rentals";
      return ""};
    var idx=function(k){for(var i=0;i<tabs.length;i++)if(tabs[i].dataset.tab===k)return i;return -1};
    var W=0,H=0,cx=0,v=0,tx=0,dep=0,dT=0,raf=0,last=0,D=30;
    var centre=function(i){var r=tabs[i].getBoundingClientRect(),b=tbar.getBoundingClientRect();return r.left-b.left+r.width/2};
    var draw=function(){
      var r=30,s0=cx-r*1.7,e0=cx+r*1.7,f=function(n){return Math.round(n*10)/10};
      /* the bar runs past both screen edges so the notch can sit over the first or last tab */
      path.setAttribute("d","M-90 0H"+f(s0)+"C"+f(s0+r*.75)+" 0 "+f(cx-r*1.05)+" "+f(dep)+" "+f(cx)+" "+f(dep)+"C"+f(cx+r*1.05)+" "+f(dep)+" "+f(e0-r*.75)+" 0 "+f(e0)+" 0H"+(W+90)+"V"+H+"H-90Z");
      var sq=Math.min(.2,Math.abs(v)/4000),k=dep/D;
      ball.style.transform="translate("+f(cx-26)+"px,"+f(-26+(1-k)*44)+"px) scale("+(1+sq).toFixed(3)+","+(1-sq).toFixed(3)+")";
      ball.style.opacity=k;
    };
    var step=function(t){
      var dt=Math.min(.032,(t-last)/1000||.016);last=t;
      var a=-260*(cx-tx)-21*v;v+=a*dt;cx+=v*dt;dep+=(dT-dep)*Math.min(1,dt*14);
      draw();
      if(Math.abs(cx-tx)>.3||Math.abs(v)>3||Math.abs(dep-dT)>.3)raf=requestAnimationFrame(step);
      else{cx=tx;v=0;dep=dT;draw();raf=0}
    };
    var setTab=function(i,anim){
      tabs.forEach(function(t,j){t.classList.toggle("on",j===i);if(t.tagName==="A"){if(j===i)t.setAttribute("aria-current","page");else t.removeAttribute("aria-current")}});
      if(i>-1)tx=centre(i);dT=i>-1?D:0;
      if(!anim||still){tbar.classList.add("still");cx=tx;v=0;dep=dT;draw();void tbar.offsetWidth;requestAnimationFrame(function(){requestAnimationFrame(function(){tbar.classList.remove("still")})});return}
      if(!raf){last=performance.now();raf=requestAnimationFrame(step)}
    };
    var size=function(){W=tbar.clientWidth;H=tbar.clientHeight;svg.setAttribute("viewBox","0 0 "+W+" "+H)};
    var save=function(k){try{sessionStorage.setItem(TK,k)}catch(e){}};
    size();
    var prev="";try{prev=sessionStorage.getItem(TK)||""}catch(e){}
    var now=tabKey();
    if(prev&&prev!==now&&idx(prev)>-1&&idx(prev)<4){setTab(idx(prev),false);requestAnimationFrame(function(){setTab(idx(now),true)})}
    else setTab(idx(now),false);
    save(now);
    addEventListener("resize",function(){size();var i=idx(tabKey());if(i>-1)tx=centre(i);cx=tx;draw()});
    addEventListener("hashchange",function(){setTab(idx(tabKey()),true)});
    if(mn&&window.MutationObserver)new MutationObserver(function(){var o=mn.classList.contains("open");tabs[4].setAttribute("aria-expanded",o);setTab(idx(tabKey()),true)}).observe(mn,{attributes:true,attributeFilter:["class"]});
    tbar.addEventListener("click",function(e){
      var t=e.target.closest(".tb");if(!t)return;
      var k=t.dataset.tab;
      if(k==="menu"){if(mb)mb.click();return}
      if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
      if(mn&&mn.classList.contains("open")&&mb)mb.click();
      var u=new URL(t.href,location.href);e.preventDefault();
      setTab(tabs.indexOf(t),true);save(k);
      if(u.pathname.replace(/index\.html$/,"")===location.pathname.replace(/index\.html$/,"")){
        if(u.hash){if(location.hash!==u.hash)history.pushState(null,"",u.hash);dispatchEvent(new Event("op:hash"));var el=document.getElementById(u.hash.slice(1));if(el&&u.hash!=="#liked")el.scrollIntoView({behavior:still?"auto":"smooth"})}
        else{if(location.hash)history.pushState(null,"",u.pathname);dispatchEvent(new Event("op:hash"));scrollTo({top:0,behavior:still?"auto":"smooth"})}
        return}
      setTimeout(function(){location.href=t.href},still?0:340);
    });
    addEventListener("pageshow",function(e){if(e.persisted){var i=idx(tabKey());setTab(i,false);save(tabKey())}});
  }

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
      var ag=v("agency"),agName=v("agencyName");
      log({type:"request",ref:r,agency:ag,agencyName:agName||"Get matched",vehicle:needTxt,city:v("city"),from:v("from"),to:v("to")});
      var lines=[ag?"Hi OPIIUS, I'd like to ask "+agName+" about this.":"Hi OPIIUS, please match me with a trusted local agency.","","Need: "+needTxt,"Where: "+(v("city")||"Guwahati"),"Dates: "+dates];
      if(v("people"))lines.push("People: "+v("people"));
      if(v("budget"))lines.push("Budget: "+v("budget"));
      lines.push("Name: "+v("name"));
      if(v("msg"))lines.push("Details: "+v("msg"));
      lines.push("","Ref: "+r);
      openWA(lines.join("\n"));
    });
  });
  /* likes: kept in this browser only (localStorage), shared by the rentals list and agency pages */
  var LK="op-liked",liked=[];
  try{liked=JSON.parse(localStorage.getItem(LK))||[]}catch(e){}
  var paintLikes=function(){
    $$("[data-like]").forEach(function(b){b.setAttribute("aria-pressed",liked.indexOf(b.dataset.like)>-1?"true":"false")});
    var n=$("#flikedN");if(n)n.textContent=$$(".arow-w .like").filter(function(b){return liked.indexOf(b.dataset.like)>-1}).map(function(b){return b.dataset.like}).filter(function(v,i,a){return a.indexOf(v)===i}).length;
  };
  paintLikes();
  document.addEventListener("click",function(e){
    var b=e.target.closest("[data-like]");if(!b)return;e.preventDefault();
    var id=b.dataset.like,i=liked.indexOf(id);if(i>-1)liked.splice(i,1);else liked.push(id);
    try{localStorage.setItem(LK,JSON.stringify(liked))}catch(err){}
    paintLikes();if(window.__opFilter)window.__opFilter();
  });

  /* rentals: search agencies, price per day, people going, liked only */
  var fq=$("#fq");
  if(fq){
    var fmin=$("#fmin"),fmax=$("#fmax"),fppl=$("#fppl"),fl=$("#fliked"),fc=$("#fcount"),ftown=$("#ftown"),fnear=$("#fnear"),me=null;
    var rows=$$(".arow-w").map(function(w,i){var c=[];try{c=JSON.parse(w.dataset.cars)}catch(e){}var ll=(w.dataset.ll||"").split(",").map(Number);
      return {w:w,i:i,q:w.dataset.q||"",c:c,town:w.dataset.town||"",ll:ll.length===2&&!isNaN(ll[0])?ll:null,id:(w.querySelector("[data-like]")||{dataset:{}}).dataset.like,fit:w.querySelector(".fit")}});
    /* Near me: distance on a sphere, km; the location never leaves the phone */
    var km=function(a,b){var R=6371,r=Math.PI/180,dl=(b[0]-a[0])*r,dn=(b[1]-a[1])*r,x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dn/2)*Math.sin(dn/2);return 2*R*Math.asin(Math.sqrt(x))};
    var order=function(){
      rows.forEach(function(r){r.d=me&&r.ll?km(me,r.ll):null;var loc=r.w.querySelector(".loc"),s=loc&&loc.querySelector(".dist");
        if(loc&&!s){s=document.createElement("span");s.className="dist";loc.appendChild(s)}
        if(s){s.hidden=r.d==null;s.textContent=r.d==null?"":(r.d<1.5?"under 2 km away":"about "+(r.d<20?Math.round(r.d):Math.round(r.d/5)*5)+" km away")}});
      $$(".arows").forEach(function(box){rows.filter(function(r){return r.w.parentNode===box}).sort(function(a,b){return me?((a.d==null?1e9:a.d)-(b.d==null?1e9:b.d))||a.i-b.i:a.i-b.i}).forEach(function(r){box.appendChild(r.w)})});
    };
    var run=function(){
      var q=fq.value.trim().toLowerCase(),town=ftown?ftown.value:"",lo=+fmin.value||0,hi=+fmax.value||Infinity,p=+fppl.value||0,onlyLiked=fl.getAttribute("aria-pressed")==="true";
      if(hi<lo){hi=Infinity;fmax.value="0"}
      var narrowed=lo||hi<Infinity||p,shown=0,ids={};
      rows.forEach(function(r){
        var fits=r.c.filter(function(x){return x[0]>=lo&&x[0]<=hi&&(!p||!x[1]||x[1]>=p)});
        var ok=(!q||q.split(/\s+/).every(function(t){return r.q.indexOf(t)>-1}))&&(!town||r.town===town)&&(!onlyLiked||liked.indexOf(r.id)>-1)&&(!r.c.length||fits.length);
        r.w.hidden=!ok;if(ok&&!ids[r.id]){ids[r.id]=1;shown++}
        if(r.fit){r.fit.hidden=!(ok&&narrowed&&r.c.length);var why=[p?p+"+ seats":"",lo&&hi<Infinity?inr(lo)+"–"+inr(hi)+"/day":lo?"from "+inr(lo)+"/day":hi<Infinity?"up to "+inr(hi)+"/day":""].filter(Boolean).join(", ");
          r.fit.textContent=fits.length+" of "+r.c.length+(r.c.length===1?" car matches":" cars match")+": "+why}
      });
      $$(".atype").forEach(function(sec){var ws=$$(".arow-w",sec),none=$(".anone",sec);if(none)none.hidden=!ws.length||ws.some(function(w){return !w.hidden})});
      var total=rows.map(function(r){return r.id}).filter(function(v,i,a){return a.indexOf(v)===i}).length;
      fc.textContent=(q||town||narrowed||onlyLiked)?(shown?"Showing "+shown+" of "+total+(total===1?" agency":" agencies"):"No agency matches. Try a wider price range or fewer filters."):"";
    };
    window.__opFilter=run;
    [fq,fmin,fmax,fppl,ftown].forEach(function(el){if(el){el.addEventListener("input",run);el.addEventListener("change",run)}});
    if(fnear)fnear.addEventListener("click",function(){
      if(me){me=null;fnear.setAttribute("aria-pressed","false");order();fc.textContent="";run();return}
      if(!navigator.geolocation){fc.textContent="Your browser can't share location. Pick your town instead.";return}
      fnear.setAttribute("aria-busy","true");fc.textContent="Finding agencies near you…";
      navigator.geolocation.getCurrentPosition(function(pos){
        fnear.removeAttribute("aria-busy");me=[pos.coords.latitude,pos.coords.longitude];fnear.setAttribute("aria-pressed","true");
        if(ftown)ftown.value="";order();run();var n=rows.filter(function(r){return r.d!=null&&!r.w.hidden}).sort(function(a,b){return a.d-b.d})[0];
        fc.textContent=n?"Nearest first. Distances are approximate; agencies share the exact pickup point when they confirm.":"";
      },function(err){fnear.removeAttribute("aria-busy");fc.textContent=err&&err.code===1?"Location is turned off for this site. Pick your town instead.":"Couldn't get your location. Pick your town instead."},{enableHighAccuracy:false,timeout:10000,maximumAge:600000});
    });
    fl.addEventListener("click",function(){fl.setAttribute("aria-pressed",fl.getAttribute("aria-pressed")==="true"?"false":"true");run()});
    var fromHash=false,byHash=function(){var on=location.hash==="#liked";
      if(on){fl.setAttribute("aria-pressed","true");fromHash=true;run();fl.scrollIntoView({block:"center",behavior:"smooth"})}
      else if(fromHash){fl.setAttribute("aria-pressed","false");fromHash=false;run()}};
    addEventListener("hashchange",byHash);addEventListener("op:hash",byHash);
    document.addEventListener("click",function(e){if(!e.target.closest("[data-fclear]"))return;fq.value="";fmin.value=fmax.value=fppl.value="0";if(ftown)ftown.value="";fl.setAttribute("aria-pressed","false");run()});
    run();if(location.hash==="#liked")byHash();
    if(location.hash==="#near"&&fnear){fnear.scrollIntoView({block:"center"});fnear.click()}
  }

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
