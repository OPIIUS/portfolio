/* OPIIUS marketplace data: real partner agencies only.
   Every listing points at an agency, a place, a brand and a model. Real Drive Ghy's models, photos and day prices
   come from the owner. Agencies and tour operators added through the onboarding forms arrive via partners.js.
   After editing, run  node tools/build-site.mjs  to regenerate the static pages. */
(function(){
const IMG = "rideme/img/";

/* ---------- places (rental locations and tour destinations share this table) ---------- */
const PLACES = {
  guwahati:{name:"Guwahati", state:"Assam", lat:26.14, lon:91.74, tagline:"Gateway to the Northeast",
    about:"The Northeast's biggest city and where most trips begin. Pick up at the airport, the railway station or in town.",
    pickups:["LGBI Airport, Borjhar","Guwahati Railway Station, Paltan Bazar","GS Road, Six Mile","Zoo Road","Beltola / Dispur","Fancy Bazar"], art:"guwahati"},
  barama:{name:"Barama", state:"Assam", lat:26.53, lon:91.40, tagline:"Baksa district",
    about:"A town in Baksa district, Lower Assam, about 2 hours from Guwahati by road.",
    pickups:["Barama town"], art:"guwahati"},
  shillong:{name:"Shillong", state:"Meghalaya", lat:25.57, lon:91.88, tagline:"The hill capital",
    about:"Pine hills, cafes and the base for Sohra, Dawki and the living root bridges. About 3 hours from Guwahati.",
    pickups:["Police Bazar","Laitumkhrah","Umiam Lake road"], art:"shillong"},
  kaziranga:{name:"Kaziranga", state:"Assam", lat:26.58, lon:93.40, tagline:"Home of the one-horned rhino",
    about:"Grasslands and wetlands with the world's largest population of one-horned rhinos. The park usually opens for safaris from November to April.",
    pickups:["Kohora","Bagori"], art:"kaziranga"},
  sohra:{name:"Sohra (Cherrapunji)", short:"Sohra", state:"Meghalaya", lat:25.27, lon:91.73, tagline:"Waterfalls and caves",
    about:"Nohkalikai and Seven Sisters falls, Mawsmai cave and the trek to Nongriat. One of the wettest places on earth.",
    pickups:["Sohra market"], art:"sohra"},
  dawki:{name:"Dawki", state:"Meghalaya", lat:25.18, lon:92.02, tagline:"The glass-clear Umngot river",
    about:"Boating on the Umngot near the Bangladesh border. The water is clearest from about November to April.",
    pickups:[], nearest:"shillong", art:"dawki"},
  mawlynnong:{name:"Mawlynnong", state:"Meghalaya", lat:25.20, lon:91.92, tagline:"A village in the forest",
    about:"A tidy Khasi village with a bamboo sky walk and the Riwai root bridge, usually paired with Dawki.",
    pickups:[], nearest:"shillong", art:"mawlynnong"},
  tawang:{name:"Tawang", state:"Arunachal Pradesh", lat:27.59, lon:91.87, tagline:"Monasteries above the clouds",
    about:"A high Himalayan town reached over Sela Pass. Indian visitors need an Inner Line Permit for Arunachal Pradesh.",
    pickups:["Tawang town","Old Market"], art:"tawang"},
  meghalaya:{name:"Meghalaya", state:"Meghalaya", lat:25.47, lon:91.87, tagline:"The abode of clouds", region:true,
    about:"Cloud-covered hills, root bridges grown by hand and rivers so clear the boats look like they float. Most trips start in Guwahati and take 3 to 6 days.",
    pickups:[], nearest:"shillong", art:"meghalaya", photo:"https://commons.wikimedia.org/wiki/Special:FilePath/Double_Decker_Living_Tree_Root_Bridges%2C_Meghalaya.jpg?width=1600",
    photoCredit:"Double Decker Living Tree Root Bridges, Meghalaya (Wikimedia Commons, CC licence)"},
  umiam:{name:"Umiam Lake", state:"Meghalaya", lat:25.65, lon:91.89, point:true},
  laitlum:{name:"Laitlum", state:"Meghalaya", lat:25.47, lon:91.98, point:true},
  nongriat:{name:"Nongriat", state:"Meghalaya", lat:25.25, lon:91.68, point:true},
  shnongpdeng:{name:"Shnongpdeng", state:"Meghalaya", lat:25.21, lon:92.01, point:true},
  tezpur:{name:"Tezpur", state:"Assam", lat:26.63, lon:92.80, point:true},
  bomdila:{name:"Bomdila", state:"Arunachal Pradesh", lat:27.26, lon:92.42, point:true},
  dirang:{name:"Dirang", state:"Arunachal Pradesh", lat:27.36, lon:92.24, point:true},
  sela:{name:"Sela Pass", state:"Arunachal Pradesh", lat:27.50, lon:92.10, point:true}
};
const RENTAL_CITIES = ["guwahati","barama","shillong","kaziranga","sohra","dawki","tawang"];
const DESTINATIONS = ["meghalaya","shillong","sohra","dawki","mawlynnong","kaziranga","tawang"];
const DEST_FACTS = {
  meghalaya:{best:"October to May", time:"3 to 6 days", from:"Shillong is ~100 km from Guwahati", note:"June to September brings very heavy rain"},
  shillong:{best:"October to May", time:"2 to 3 days", from:"~100 km, 3 hrs from Guwahati", note:"Base for most Meghalaya trips"},
  sohra:{best:"October to May", time:"1 to 2 days", from:"~55 km from Shillong", note:"Mornings are often foggy"},
  dawki:{best:"November to April", time:"1 day", from:"~82 km from Shillong", note:"Clearest water in the dry months"},
  mawlynnong:{best:"October to May", time:"Half a day", from:"~78 km from Shillong", note:"Usually paired with Dawki"},
  kaziranga:{best:"November to April", time:"2 to 3 days", from:"~200 km, 5 hrs from Guwahati", note:"Park safaris pause in the monsoon"},
  tawang:{best:"March to May, September to November", time:"6 to 8 days", from:"~450 km from Guwahati over two days", note:"Inner Line Permit required"}
};

/* ---------- brands and vehicle models ---------- */
const BRANDS = {
  toyota:{name:"Toyota"}, mahindra:{name:"Mahindra"}, maruti:{name:"Maruti Suzuki"}, hyundai:{name:"Hyundai"},
  kia:{name:"Kia"}, tata:{name:"Tata"}, honda:{name:"Honda"}, royalenfield:{name:"Royal Enfield"}
};
/* kind: car|bike · type drives the filter · studio: photo on a white background (shown whole) */
const MODELS = {
  innova:{brand:"toyota", name:"Innova Crysta", kind:"car", type:"MUV", trans:"Manual", fuel:"Diesel", seats:7, photo:IMG+"innova.jpg",
    features:["AC","Bluetooth","Rear AC vents","Luggage space"], about:"The family and group favourite for hill roads: roomy, sturdy and easy on long days."},
  scorpio:{brand:"mahindra", name:"Scorpio", kind:"car", type:"SUV", trans:"Manual", fuel:"Diesel", seats:7, photo:IMG+"scorpio.png", studio:true,
    features:["AC","Bluetooth","High ground clearance"], about:"A tough seven-seater that handles broken hill roads well. Popular for Meghalaya and Tawang."},
  thar:{brand:"mahindra", name:"Thar 4x4", kind:"car", type:"SUV", trans:"Manual", fuel:"Diesel", seats:4, photo:IMG+"thar.png",
    features:["AC","Bluetooth","4x4","High ground clearance"], about:"The off-roader. Four-wheel drive for rough tracks and the most fun you can have on the Sela road."},
  xuv700:{brand:"mahindra", name:"XUV700", kind:"car", type:"SUV", trans:"Automatic", fuel:"Diesel", seats:7, photo:IMG+"xuv700.png", studio:true,
    features:["AC","Bluetooth","Sunroof","GPS","Cruise control"], about:"Premium seven-seat SUV with an automatic gearbox, sunroof and built-in navigation."},
  swift:{brand:"maruti", name:"Swift", kind:"car", type:"Hatchback", trans:"Manual", fuel:"Petrol", seats:5, photo:IMG+"swift.png", studio:true,
    features:["AC","Bluetooth"], about:"Light, economical and easy to park. Ideal for the city and short trips to Shillong."},
  brezza:{brand:"maruti", name:"Brezza", kind:"car", type:"SUV", trans:"Manual", fuel:"Petrol", seats:5, photo:IMG+"breeza.jpg",
    features:["AC","Bluetooth","High ground clearance"], about:"A compact SUV with good clearance for hill roads and space for four adults."},
  xl6:{brand:"maruti", name:"XL6", kind:"car", type:"MUV", trans:"Manual", fuel:"Petrol", seats:6, photo:IMG+"xl6.jpg",
    features:["AC","Bluetooth","Captain seats"], about:"Six comfortable seats with individual middle-row chairs. Good for small families."},
  i20:{brand:"hyundai", name:"i20", kind:"car", type:"Hatchback", trans:"Manual", fuel:"Petrol", seats:5, photo:IMG+"i20-studio.png", studio:true,
    features:["AC","Bluetooth","Touchscreen"], about:"A comfortable premium hatchback for city driving and easy highway runs."},
  carens:{brand:"kia", name:"Carens", kind:"car", type:"MUV", trans:"Manual", fuel:"Diesel", seats:7, photo:IMG+"carens.jpg",
    features:["AC","Bluetooth","Rear AC vents"], about:"A practical seven-seater that is easier to drive than it looks."},
  punch:{brand:"tata", name:"Punch", kind:"car", type:"SUV", trans:"Manual", fuel:"Petrol", seats:5, photo:IMG+"punch.jpg",
    features:["AC","Bluetooth","High ground clearance"], about:"A small SUV with a big-car stance. Nimble in traffic, confident on hills."},
  nios:{brand:"hyundai", name:"Grand i10 Nios", kind:"car", type:"Hatchback", trans:"Manual", fuel:"Petrol", seats:5, photo:"",
    features:["AC","Bluetooth","Touchscreen"], about:"A compact, easy-going hatchback for city errands and short trips out of town."},
  ignis:{brand:"maruti", name:"Ignis", kind:"car", type:"Hatchback", trans:"Manual", fuel:"Petrol", seats:5, photo:"",
    features:["AC","Bluetooth","High seating position"], about:"A small car with a tall, SUV-like stance. Easy to park, comfortable on hill roads."},
  baleno:{brand:"maruti", name:"Baleno", kind:"car", type:"Hatchback", trans:"Manual", fuel:"Petrol", seats:5, photo:"",
    features:["AC","Bluetooth","Touchscreen","Spacious boot"], about:"A roomy premium hatchback with a big boot. Comfortable for four adults on longer drives."},
  glanza:{brand:"toyota", name:"Glanza", kind:"car", type:"Hatchback", trans:"Manual", fuel:"Petrol", seats:5, photo:"",
    features:["AC","Bluetooth","Touchscreen","Spacious boot"], about:"Toyota's premium hatchback: spacious, smooth and economical on highway runs."},
  fronx:{brand:"maruti", name:"Fronx", kind:"car", type:"SUV", trans:"Manual", fuel:"Petrol", seats:5, photo:"",
    features:["AC","Bluetooth","Touchscreen","High ground clearance"], about:"A stylish compact SUV crossover with extra ground clearance for broken roads."},
  urbancruiser:{brand:"toyota", name:"Urban Cruiser", kind:"car", type:"SUV", trans:"Manual", fuel:"Petrol", seats:5, photo:"",
    features:["AC","Bluetooth","High ground clearance"], about:"A compact SUV with good clearance for hill roads and space for four adults."},
  dzire:{brand:"maruti", name:"Dzire", kind:"car", type:"Sedan", trans:"Manual", fuel:"Petrol", seats:5, photo:"",
    features:["AC","Bluetooth","Touchscreen","Spacious boot"], about:"A comfortable, economical sedan with a proper boot. Easy in the city and relaxed on highway runs."},
  creta:{brand:"hyundai", name:"Creta", kind:"car", type:"SUV", trans:"Manual", fuel:"Petrol", seats:5, photo:"",
    features:["AC","Bluetooth","Touchscreen","High ground clearance"], about:"A roomy, refined SUV with good clearance for hill roads and space for five adults."},
  activa:{brand:"honda", name:"Activa 6G", kind:"bike", type:"Scooter", trans:"Automatic", fuel:"Petrol", seats:2, photo:IMG+"activa.png", studio:true,
    features:["Helmet included","Under-seat storage"], about:"The easiest way around town. No gears, light and economical."},
  shine:{brand:"honda", name:"Shine 125", kind:"bike", type:"Motorcycle", trans:"Manual", fuel:"Petrol", seats:2, photo:IMG+"shine.png", studio:true,
    features:["Helmet included"], about:"A reliable commuter bike with excellent mileage for city and short trips."},
  classic:{brand:"royalenfield", name:"Classic 350", kind:"bike", type:"Motorcycle", trans:"Manual", fuel:"Petrol", seats:2, photo:IMG+"classic.png", studio:true,
    features:["Helmet included","Luggage rack on request"], about:"The Northeast road-trip classic. Relaxed, torquey and loved on the Shillong highway."},
  gt650:{brand:"royalenfield", name:"Continental GT 650", kind:"bike", type:"Motorcycle", trans:"Manual", fuel:"Petrol", seats:2, photo:IMG+"gt650.png", studio:true,
    features:["Helmet included","Twin-cylinder 650 cc"], about:"A twin-cylinder cafe racer for experienced riders who want real power."},
  himalayan:{brand:"royalenfield", name:"Himalayan 450", kind:"bike", type:"Motorcycle", trans:"Manual", fuel:"Petrol", seats:2, photo:"",
    features:["Helmet included","Luggage rack","Long-travel suspension"], about:"Built for the mountains. The go-to bike for Tawang and Sela Pass."}
};

/* ---------- rental agencies ---------- */
const P = (deposit,km,fuel,cancel,docs)=>({deposit,km,fuel,cancel,docs});
const STD_DOCS = "Original driving licence and a government photo ID";
const AGENCIES = {
  rd:{name:"Real Drive Guwahati", slug:"real-drive-ghy", category:"self-drive-cars", city:"guwahati", area:"Hatigaon, Puberun Path", real:true, founding:true, verified:true, verifiedOn:"Oct 2026",
    cover:"assets/partners/real-drive-ghy/logo-card.jpg", coverAlt:"Real Drive Ghy logo", coverPos:"50% 50%", trims:{i20:"Elite i20", scorpio:"Scorpio S11"}, trans:{swift:"Automatic", fronx:"Automatic"},
    travel:"Meghalaya and Arunachal Pradesh allowed (Arunachal needs an Inner Line Permit)", deliveryNote:"Airport, railway station or your address in Guwahati, for a delivery charge",
    rating:null, reviews:0, bookings:0, since:2024, hue:48,
    about:"Well-maintained, clean self-drive cars from Hatigaon, Guwahati, with a hassle-free booking process. City hatchbacks, compact SUVs and 7-seaters, including an automatic Swift and Fronx. Take the car to Meghalaya or Arunachal, or have it delivered to the airport, railway station or your door.",
    policies:P("₹2,000","300 km per day, then ₹10 per extra km","Same level as pick-up","Confirmed by the agency","Original driving licence and a passport or voter ID"),
    pickups:["Hatigaon, Guwahati (exact address shared on confirmation)"], delivery:true},
};

/* ---------- listings: [agency, model, price/day, units, rating, trips, year] ---------- */
const L = [
  /* Real Drive Ghy: prices, years and terms from the owner's onboarding block (Oct 2026). One car of each model.
     Photos: the agency's own cars, cropped 4:3. All 13 models have the agency's own photo. */
  ["rd","i20",1500,1,null,0,2017,"assets/partners/real-drive-ghy/i20.jpg"], ["rd","nios",1600,1,null,0,2023,"assets/partners/real-drive-ghy/nios.jpg"], ["rd","ignis",1600,1,null,0,2024,"assets/partners/real-drive-ghy/ignis.jpg"],
  ["rd","swift",1700,1,null,0,2022,"assets/partners/real-drive-ghy/swift.jpg"], ["rd","baleno",1800,1,null,0,2025,"assets/partners/real-drive-ghy/baleno.jpg"], ["rd","glanza",1800,1,null,0,2026,"assets/partners/real-drive-ghy/glanza.jpg"],
  ["rd","punch",1800,1,null,0,2022,"assets/partners/real-drive-ghy/punch.jpg"], ["rd","fronx",2200,1,null,0,2024,"assets/partners/real-drive-ghy/fronx.jpg"], ["rd","urbancruiser",2400,1,null,0,null,"assets/partners/real-drive-ghy/urbancruiser.jpg"],
  ["rd","scorpio",3000,1,null,0,2018,"assets/partners/real-drive-ghy/scorpio.jpg"], ["rd","xl6",3000,1,null,0,2023,"assets/partners/real-drive-ghy/xl6.jpg"], ["rd","carens",3300,1,null,0,2023,"assets/partners/real-drive-ghy/carens.jpg"],
  ["rd","innova",3600,1,null,0,2024,"assets/partners/real-drive-ghy/innova.jpg"],
];
const LISTINGS = {};
/* row: [agency, model, price per day, units, rating, trips, year, optional own photo path] */
L.forEach(([a,m,price,units,rating,trips,year,photo])=>{LISTINGS[a+"-"+m]={id:a+"-"+m,agency:a,model:m,price,units,rating,trips,year,photo}});

/* ---------- tour operators and packages (filled from partners.js) ---------- */
const OPERATORS = {};
const PACKAGES = {};

/* ---------- partner agencies from partners.js (filled via onboard.html) ---------- */
const TYPE_KIND={Hatchback:"car",Sedan:"car",SUV:"car",MUV:"car",Motorcycle:"bike",Scooter:"bike"};
(window.OPIIUS_PARTNERS||[]).forEach(pa=>{
  if(!pa||!pa.id||AGENCIES[pa.id])return;
  const pol=pa.policies||{};
  AGENCIES[pa.id]={name:pa.name,city:pa.city||"guwahati",area:pa.area||"",real:true,verified:!!pa.verified,rating:null,reviews:0,bookings:0,
    since:pa.since||new Date().getFullYear(),hue:pa.hue||(pa.id.split("").reduce((h,c)=>h*31+c.charCodeAt(0),7)%360),
    about:pa.about||"",policies:P(pol.deposit||"Confirmed by the agency",pol.km||"Confirmed by the agency",pol.fuel||"Same level as pick-up",pol.cancel||"Confirmed by the agency",pol.docs||STD_DOCS),
    pickups:(pa.pickups&&pa.pickups.length)?pa.pickups:[(pa.area||"")+" (address shared on confirmation)"],delivery:!!pa.delivery};
  /* optional profile fields OPIIUS may add by hand */
  ["slug","category","founding","verifiedOn","cover","coverAlt","coverPos","trims","trans","travel","deliveryNote","driver"].forEach(k=>{if(pa[k]!=null)AGENCIES[pa.id][k]=pa[k]});
  (pa.vehicles||[]).forEach(v=>{
    let mk=v.model&&MODELS[v.model]?v.model:null;
    if(!mk){
      const bn=(v.brand||"").toLowerCase().replace(/[^a-z]/g,"");
      const b=Object.keys(BRANDS).find(k=>k===bn||BRANDS[k].name.toLowerCase().replace(/[^a-z]/g,"")===bn||(bn&&bn.startsWith(k)))||bn;
      if(b&&!BRANDS[b])BRANDS[b]={name:v.brand};
      mk=(b+"-"+(v.name||"vehicle")).toLowerCase().replace(/[^a-z0-9]+/g,"-");
      if(!MODELS[mk])MODELS[mk]={brand:b||"other",name:v.name||"Vehicle",kind:TYPE_KIND[v.type]||"car",type:v.type||"Hatchback",trans:v.trans||"Manual",fuel:v.fuel||"Petrol",
        seats:+v.seats||5,photo:(v.photos&&v.photos[0])||null,features:v.features||["AC"],about:v.about||""};
      if(!BRANDS[MODELS[mk].brand])BRANDS[MODELS[mk].brand]={name:v.brand||"Other"};
    }
    const id=pa.id+"-"+mk;
    LISTINGS[id]={id,agency:pa.id,model:mk,price:+v.price,units:+v.units||1,rating:null,trips:0,year:+v.year||null,photo:(v.photos&&v.photos[0])||undefined,sample:!!v.sample};
  });
});

/* ---------- partner tour operators from partners.js (filled via onboard-tours.html) ---------- */
(window.OPIIUS_OPERATORS||[]).forEach(op=>{
  if(!op||!op.id||OPERATORS[op.id])return;
  OPERATORS[op.id]={name:op.name,base:PLACES[op.base]?op.base:"guwahati",real:true,verified:!!op.verified,rating:null,reviews:0,trips:0,
    since:op.since||new Date().getFullYear(),hue:op.hue||(op.id.split("").reduce((h,c)=>h*31+c.charCodeAt(0),11)%360),about:op.about||""};
  (op.packages||[]).forEach((pk,i)=>{
    const stops=(pk.stops||[]).filter(s=>PLACES[s]);const dest=PLACES[pk.dest]?pk.dest:(stops.find(s=>!PLACES[s].point)||"meghalaya");
    const id=op.id+"-"+(pk.title||("trip-"+(i+1))).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40);
    PACKAGES[id]={title:pk.title||"Trip",op:op.id,dest,days:+pk.days||1,nights:pk.nights!=null?+pk.nights:Math.max(0,(+pk.days||1)-1),price:+pk.price||0,
      rating:null,reviews:0,types:pk.types||[],acts:pk.acts||[],inc:pk.inc||[],stops:stops.length?stops:[dest],blurb:pk.blurb||"",
      itin:(pk.itin||[]).filter(d=>d&&d[0]),notInc:pk.notInc||[],photo:pk.photo||undefined};
  });
});

window.OP = {PLACES,RENTAL_CITIES,DESTINATIONS,DEST_FACTS,BRANDS,MODELS,AGENCIES,LISTINGS,OPERATORS,PACKAGES,LOGOS:{"maruti":"M17.369 19.995C13.51 22.39 12 24 12 24L.105 15.705s5.003-3.715 9.186-.87l5.61 3.882.683-.453L.106 7.321s2.226-.65 6.524-3.315C10.49 1.609 12 0 12 0l11.895 8.296s-5.003 3.715-9.187.87L9.1 5.281l-.683.454L23.893 16.68s-2.224.649-6.524 3.315Z","hyundai":"M12 18.1622c-6.6275 0-12-2.7586-12-6.163 0-3.4028 5.3725-6.1614 12-6.1614 6.6278 0 12 2.7586 12 6.1614 0 3.4044-5.3722 6.163-12 6.163zM7.6023 7.17C3.701 7.9784.973 9.8302.973 11.9844c0 1.1929.8382 2.2932 2.248 3.1757.1174.0724.1941.0862.251.0826.1019-.006.1593-.0698.201-.146.028-.0485.0631-.1225.0972-.1968.4601-1.0834 2.0776-4.8333 4.2023-7.3758a1.1775 1.1775 0 0 0 .1048-.1461c.046-.084.0356-.1513.0006-.192-.0593-.0647-.2247-.065-.4756-.016zM9.742 8.8995c-1.1728 2.8492 1.0473 2.4961 1.6478 2.3637 1.0203-.2258 1.9944-.6128 2.7746-.925 2.2216-.8887 3.4012-1.7804 3.7925-2.123a1.9839 1.9839 0 0 0 .1076-.0988c.0557-.058.0976-.1192.0976-.2002 0-.0936-.081-.1687-.2374-.2231-.012-.0049-.0517-.021-.0641-.025-1.698-.5415-3.724-.8563-5.9016-.8563-.0168 0-.0586-.0022-.1169 0-.2608.0078-.5509.0664-.787.1888-.7777.4049-1.1163 1.4235-1.313 1.899zm10.5851.0037c-.0268.0487-.0612.1224-.0962.1974-.4599 1.0826-2.0774 4.831-4.2018 7.3733-.0515.063-.0796.1031-.1042.1467-.0492.0846-.0388.1535 0 .1935.0572.0641.2235.0654.474.0157 3.8998-.81 6.628-2.6606 6.628-4.8149 0-1.1925-.836-2.2928-2.2472-3.1745-.1161-.073-.1934-.0871-.25-.083-.1028.0067-.16.0699-.2026.1458zM14.258 15.099c1.173-2.849-1.0483-2.494-1.6467-2.3622-1.0218.225-1.996.613-2.7757.924-2.2226.8883-3.4017 1.782-3.7944 2.1234-.0468.0428-.0833.0742-.1066.0995-.0564.0573-.0967.1178-.0967.2007 0 .0923.08.1688.2362.2229.012.0048.0511.0213.0657.0255 1.696.54 3.722.8557 5.9.8557.0177 0 .0592.0016.1178 0 .2609-.0081.5522-.0677.7871-.1888.7781-.4052 1.1169-1.4234 1.3133-1.9007z","tata":"M9.774 11.568c.193-1.322.168-2.013-1.768-1.906-2.223.124-4.476.265-7.849 1.027A5.63 5.63 0 0 0 0 12c0 1.52.618 2.99 1.787 4.254 1.06 1.144 2.556 2.095 4.326 2.752a15.48 15.48 0 0 0 2.014.588c.13-.527.959-3.907 1.616-7.823l.03-.202m14.07-.88c-3.372-.762-5.624-.902-7.846-1.026-1.937-.107-1.962.584-1.768 1.906l.046.298c.65 3.848 1.458 7.16 1.598 7.72C20.595 18.508 24 15.516 24 12c0-.443-.054-.88-.157-1.311m-.491-1.324a7.163 7.163 0 0 0-1.14-1.618c-1.06-1.144-2.555-2.095-4.325-2.752-1.784-.662-3.82-1.011-5.887-1.011-2.068 0-4.103.35-5.887 1.01-1.77.658-3.266 1.61-4.326 2.753A7.17 7.17 0 0 0 .648 9.366c2.304-.557 6.245-1.293 9.904-1.37.353-.008.596.105.756.307.196.248.18 1.128.175 1.522l-.104 10.18a18.507 18.507 0 0 0 1.244 0l-.104-10.18c-.005-.394-.02-1.274.175-1.522.16-.202.403-.315.756-.308 3.658.078 7.597.813 9.902 1.37z","toyota":"M12 3.848C5.223 3.848 0 7.298 0 12c0 4.702 5.224 8.152 12 8.152S24 16.702 24 12c0-4.702-5.223-8.152-12-8.152zm7.334 3.839c0 1.08-1.725 1.913-4.488 2.246-.26-2.58-1.005-4.279-1.963-4.913 2.948.184 6.45 1.227 6.45 2.667zM12 16.401c-.96 0-1.746-1.5-1.808-4.389.577.047 1.18.072 1.808.072.628 0 1.23-.025 1.807-.072-.061 2.89-.847 4.389-1.807 4.389zm0-6.308c-.59 0-1.155-.019-1.69-.054.261-1.728.92-3.15 1.69-3.15.77 0 1.428 1.422 1.689 3.15-.535.034-1.099.054-1.689.054zm-.882-5.075c-.956.633-1.706 2.333-1.964 4.915C6.391 9.6 4.665 8.767 4.665 7.687c0-1.44 3.504-2.49 6.453-2.669zM2.037 11.68a5.265 5.265 0 011.048-3.164c.27 1.547 2.522 2.881 5.972 3.37V12c0 3.772.879 6.203 2.087 6.97-5.107-.321-9.107-3.48-9.107-7.29zm10.823 7.29c1.207-.767 2.087-3.198 2.087-6.97v-.115c3.447-.488 5.704-1.826 5.972-3.37a5.26 5.26 0 011.049 3.165c-.004 3.81-4.008 6.969-9.109 7.29z","kia":"M13.923 14.175c0 .046.015.072.041.072a.123.123 0 0 0 .058-.024l7.48-4.854a.72.72 0 0 1 .432-.13h1.644c.252 0 .422.168.422.42v3.139c0 .38-.084.6-.42.801l-1.994 1.2a.137.137 0 0 1-.067.024c-.024 0-.048-.019-.048-.088v-3.663c0-.043-.012-.071-.041-.071a.113.113 0 0 0-.058.024l-5.466 3.551a.733.733 0 0 1-.42.127h-3.624c-.254 0-.422-.168-.422-.422V9.757c0-.033-.015-.064-.044-.064a.118.118 0 0 0-.057.024L7.732 11.88c-.036.024-.046.041-.046.058 0 .014.008.029.032.055l2.577 2.575c.034.034.058.06.058.089 0 .024-.039.043-.084.043H7.94c-.183 0-.324-.026-.423-.125l-1.562-1.56a.067.067 0 0 0-.048-.024.103.103 0 0 0-.048.015l-2.61 1.57a.72.72 0 0 1-.423.122H.425C.168 14.7 0 14.53 0 14.279v-3.08c0-.38.084-.6.422-.8L2.43 9.192a.103.103 0 0 1 .052-.016c.032 0 .048.03.048.1V13.4c0 .043.01.063.041.063a.144.144 0 0 0 .06-.024L9.407 9.36a.733.733 0 0 1 .446-.124h3.648c.252 0 .422.168.422.42l-.002 4.518z","honda":"M23.902 6.87c-.33-3.218-2.47-3.895-4.354-4.204-.946-.16-2.63-.3-3.716-.34-.946-.06-3.168-.09-3.835-.09-.657 0-2.89.03-3.835.09-1.076.04-2.77.18-3.716.34C2.563 2.985.42 3.66.092 6.87c-.08.877-.1 2.023-.09 3.248.03 2.031.2 3.406.3 4.363.07.657.338 2.62.687 3.636.478 1.395.916 1.803 1.424 2.222.937.757 2.471.996 2.79 1.056 1.733.31 5.24.368 6.784.368 1.544 0 5.05-.05 6.784-.368.329-.06 1.863-.29 2.79-1.056.508-.419.946-.827 1.424-2.222.35-1.016.628-2.979.698-3.636.1-.957.279-2.332.299-4.363.04-1.225.01-2.371-.08-3.248m-1.176 5.4c-.19 2.57-.418 4.104-.747 5.22-.29.976-.637 1.623-1.165 2.092-.867.787-2.063.956-2.76 1.056-1.514.23-4.055.3-6.057.3-2.002 0-4.543-.08-6.057-.3-.697-.1-1.893-.269-2.76-1.056-.518-.469-.876-1.126-1.155-2.093-.329-1.105-.558-2.65-.747-5.22-.11-1.543-.09-4.054.08-5.4.258-2.011 1.255-3.018 3.387-3.396.996-.18 2.34-.31 3.606-.37 1.016-.07 2.7-.1 3.636-.09.936-.01 2.62.03 3.636.09 1.275.06 2.61.19 3.606.37 2.142.378 3.139 1.395 3.388 3.397.199 1.345.229 3.856.11 5.4m-5.202-8.39c-.548 2.462-.767 3.588-1.216 5.37-.428 1.715-.767 3.298-1.335 4.065-.587.777-1.365.947-1.893 1.006-.279.03-.478.04-1.066.05-.596 0-.796-.02-1.075-.05-.528-.06-1.315-.229-1.892-1.006-.578-.767-.907-2.35-1.335-4.064-.47-1.773-.678-2.91-1.236-5.37 0 0-.548.02-.797.04-.329.02-.588.05-.867.09.343 5.372.692 11.079 1.126 16.13a21.983 21.983 0 002.39.169c.33-1.266.748-3.02 1.207-3.767.378-.608.966-.677 1.295-.717.518-.07.956-.08 1.165-.08.2-.01.637 0 1.165.08.33.05.917.11 1.295.717.47.747.877 2.5 1.206 3.766 0 0 .358-.01 1.165-.05.41-.018.82-.058 1.226-.12.458-5.39.785-10.728 1.126-16.128-.28-.04-.538-.07-.867-.09-.23-.02-.787-.04-.787-.04z"}};
})();
