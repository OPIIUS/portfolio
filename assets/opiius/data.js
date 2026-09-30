/* OPIIUS marketplace data.
   Shaped like the future backend: every listing points at a vendor, a place, a brand and a category.
   demo:true marks sample data shown to explain the product. Only Real Drive Ghy is a real agency:
   their models, photos and day prices come from their catalog. Nothing here is fetched or sent anywhere. */
(function(){
const IMG = "rideme/img/";

/* ---------- places (rental locations and tour destinations share this table) ---------- */
const PLACES = {
  guwahati:{name:"Guwahati", state:"Assam", lat:26.14, lon:91.74, tagline:"Gateway to the Northeast",
    about:"The Northeast's biggest city and where most trips begin. Pick up at the airport, the railway station or in town.",
    pickups:["LGBI Airport, Borjhar","Guwahati Railway Station, Paltan Bazar","GS Road, Six Mile","Zoo Road","Beltola / Dispur","Fancy Bazar"], art:"guwahati"},
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
const RENTAL_CITIES = ["guwahati","shillong","kaziranga","sohra","dawki","tawang"];
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
  rd:{name:"Real Drive Ghy", city:"guwahati", area:"Guwahati", real:true, founding:true, rating:null, reviews:0, bookings:0, since:2023, hue:48,
    about:"Self-drive cars in Guwahati. Their models, photos and day prices on OPIIUS come from their own catalog; deposit, km and delivery terms are confirmed by them when you request.",
    policies:P("Confirmed by the agency","Confirmed by the agency","Same level as pick-up","Confirmed by the agency",STD_DOCS),
    pickups:["Guwahati (address shared on confirmation)"], delivery:false},
  nb:{name:"Northbound Rentals", city:"guwahati", area:"Paltan Bazar", demo:true, verified:true, rating:4.7, reviews:312, bookings:1240, since:2016, hue:152,
    about:"Cars and bikes a two-minute walk from Guwahati railway station. Early pick-ups for morning trains.",
    policies:P("₹5,000 cars · ₹2,000 bikes","250 km/day cars · 150 km/day bikes","Same-to-same","Free until 24 hours before pick-up",STD_DOCS),
    pickups:["Guwahati Railway Station, Paltan Bazar","LGBI Airport (₹399 delivery)"], delivery:true},
  hr:{name:"Hillroad Bikes", city:"guwahati", area:"Zoo Road Tiniali", demo:true, verified:true, rating:4.5, reviews:201, bookings:860, since:2018, hue:28,
    about:"Scooters and Royal Enfields for city rides and the Meghalaya loop. Riding gear on request.",
    policies:P("₹2,000 scooters · ₹5,000 Royal Enfield","120 km/day","Same-to-same","Free until 12 hours before pick-up",STD_DOCS),
    pickups:["Zoo Road Tiniali"], delivery:false},
  rl:{name:"Riverline Self-Drive", city:"guwahati", area:"Fancy Bazar", demo:true, verified:false, rating:4.3, reviews:96, bookings:540, since:2020, hue:205,
    about:"Self-drive cars near the riverfront with unlimited-km plans for long trips.",
    policies:P("₹8,000","Unlimited","Same-to-same","50% refund until 24 hours before",STD_DOCS),
    pickups:["Fancy Bazar"], delivery:false},
  tl:{name:"Tealeaf Tours & Rentals", city:"guwahati", area:"Six Mile, GS Road", demo:true, verified:true, rating:4.8, reviews:458, bookings:1510, since:2014, hue:95,
    about:"A travel company that rents cars and bikes and runs Meghalaya and Assam tours.",
    policies:P("₹6,000 cars · ₹3,000 bikes","300 km/day cars · 200 km/day bikes","Same-to-same","Free until 48 hours before pick-up",STD_DOCS),
    pickups:["GS Road, Six Mile","LGBI Airport (₹499 delivery)","Guwahati Railway Station (₹299 delivery)"], delivery:true, operator:"tl"},
  eg:{name:"Eastgate Motors", city:"guwahati", area:"Beltola Chariali", demo:true, verified:false, rating:4.1, reviews:58, bookings:310, since:2021, hue:330,
    about:"Budget scooters, bikes and hatchbacks on the south side of the city.",
    policies:P("₹2,000 bikes · ₹5,000 cars","100 km/day bikes · 200 km/day cars","Same-to-same","Free until 24 hours before",STD_DOCS),
    pickups:["Beltola Chariali","Dispur (₹199 delivery)"], delivery:true},
  ls:{name:"Lakeside Rides", city:"guwahati", area:"Dispur, near Last Gate", demo:true, verified:true, rating:4.6, reviews:143, bookings:690, since:2019, hue:185,
    about:"Two-wheelers for students and weekend riders, including monthly plans.",
    policies:P("₹2,000 scooters · ₹4,000 bikes","150 km/day","Same-to-same","Free until 12 hours before",STD_DOCS),
    pickups:["Dispur, Last Gate"], delivery:false},
  ax:{name:"Airport Express Rentals", city:"guwahati", area:"Borjhar, near LGBI Airport", demo:true, verified:true, rating:4.4, reviews:121, bookings:420, since:2020, hue:12,
    about:"Cars waiting at arrivals. Built for flyers heading straight to Shillong or Kaziranga.",
    policies:P("₹7,000","250 km/day","Same-to-same","Free until 24 hours before",STD_DOCS),
    pickups:["LGBI Airport arrivals (free)","Borjhar office"], delivery:true},
  pw:{name:"Pinewood Wheels", city:"shillong", area:"Police Bazar", demo:true, verified:true, rating:4.6, reviews:187, bookings:720, since:2017, hue:170,
    about:"Cars and scooters in the heart of Shillong, with one-way drops to Guwahati.",
    policies:P("₹6,000 cars · ₹2,000 scooters","250 km/day","Same-to-same","Free until 24 hours before",STD_DOCS),
    pickups:["Police Bazar","Laitumkhrah (₹200 delivery)"], delivery:true},
  cl:{name:"Cloudline Rentals", city:"shillong", area:"Laitumkhrah", demo:true, verified:false, rating:4.4, reviews:88, bookings:430, since:2021, hue:260,
    about:"Scooters, Royal Enfields and hatchbacks for exploring Shillong and Laitlum.",
    policies:P("₹2,000 scooters · ₹5,000 cars","150 km/day","Same-to-same","Free until 24 hours before",STD_DOCS),
    pickups:["Laitumkhrah"], delivery:false},
  kz:{name:"Grassland Rides", city:"kaziranga", area:"Kohora", demo:true, verified:true, rating:4.5, reviews:64, bookings:260, since:2019, hue:110,
    about:"Scooters and bikes for getting between Kaziranga's safari ranges and tea gardens.",
    policies:P("₹2,000","100 km/day","Same-to-same","Free until 24 hours before",STD_DOCS),
    pickups:["Kohora","Bagori (₹150 delivery)"], delivery:true},
  sm:{name:"Mistfall Scooters", city:"sohra", area:"Sohra market", demo:true, verified:false, rating:4.2, reviews:37, bookings:150, since:2022, hue:200,
    about:"Scooters for hopping between Sohra's waterfalls and viewpoints.",
    policies:P("₹2,000","80 km/day","Same-to-same","Free until 12 hours before",STD_DOCS),
    pickups:["Sohra market"], delivery:false},
  hp:{name:"Highpass Rentals", city:"tawang", area:"Old Market", demo:true, verified:true, rating:4.7, reviews:92, bookings:330, since:2018, hue:220,
    about:"Mountain-ready SUVs and Royal Enfields in Tawang. Every vehicle is serviced for high passes.",
    policies:P("₹10,000 cars · ₹6,000 bikes","200 km/day","Same-to-same","Free until 72 hours before",STD_DOCS+" and Inner Line Permit"),
    pickups:["Old Market, Tawang","Tawang town (₹300 delivery)"], delivery:true, operator:"hj"}
};

/* ---------- listings: [agency, model, price/day, units, rating, trips, year] ---------- */
const L = [
  ["rd","i20",1500,2,null,0,2021],["rd","punch",1900,2,null,0,2023],["rd","brezza",2400,2,null,0,2023],
  ["rd","xl6",3100,1,null,0,2022],["rd","carens",3300,1,null,0,2023],["rd","innova",3500,1,null,0,2021],
  ["nb","activa",450,6,4.7,212,2023],["nb","classic",1200,4,4.8,168,2022],["nb","swift",1800,3,4.6,141,2022],["nb","scorpio",3400,2,4.8,96,2023],
  ["nb","innova",4700,1,4.7,74,2022],["nb","brezza",2500,2,4.5,63,2023],["nb","i20",1600,2,4.6,58,2022],["nb","shine",580,3,4.5,77,2023],["nb","xuv700",4200,2,4.9,41,2024],
  ["hr","activa",420,8,4.5,301,2022],["hr","classic",1100,5,4.6,244,2021],["hr","gt650",2200,2,4.8,52,2023],["hr","shine",550,4,4.4,120,2022],["hr","himalayan",1950,2,4.7,61,2024],
  ["rl","swift",1650,4,4.3,110,2021],["rl","punch",2000,2,4.2,48,2023],["rl","thar",3700,1,4.5,39,2022],["rl","innova",4500,2,4.4,57,2021],["rl","xl6",3000,1,4.3,22,2022],
  ["tl","activa",480,5,4.8,190,2023],["tl","classic",1300,3,4.9,160,2023],["tl","swift",1900,2,4.8,88,2023],["tl","punch",1950,1,4.7,34,2024],["tl","brezza",2600,1,4.8,40,2024],
  ["tl","scorpio",3500,1,4.9,51,2024],["tl","thar",3900,2,4.8,63,2023],["tl","xuv700",4400,1,4.9,30,2024],["tl","carens",3400,1,4.7,19,2023],["tl","himalayan",2100,3,4.9,70,2024],
  ["eg","activa",399,4,4.1,98,2021],["eg","shine",500,3,4.0,64,2021],["eg","classic",999,2,4.2,71,2020],["eg","swift",1700,2,4.1,49,2021],["eg","i20",1450,2,4.2,31,2022],
  ["ls","activa",430,6,4.6,176,2022],["ls","shine",520,4,4.5,88,2022],["ls","classic",1150,3,4.6,93,2022],["ls","gt650",2300,1,4.7,24,2023],["ls","himalayan",2000,1,4.6,18,2023],
  ["ax","swift",1750,3,4.4,90,2022],["ax","i20",1550,2,4.5,55,2023],["ax","scorpio",3300,2,4.5,47,2022],["ax","xuv700",4100,1,4.6,26,2023],["ax","innova",4400,1,4.4,38,2021],["ax","thar",3800,1,4.5,21,2022],
  ["pw","activa",500,6,4.6,140,2022],["pw","classic",1350,3,4.7,82,2022],["pw","swift",2000,2,4.5,60,2022],["pw","thar",4200,1,4.7,33,2023],["pw","scorpio",3800,1,4.6,27,2023],["pw","himalayan",2200,2,4.8,44,2024],
  ["cl","activa",470,4,4.4,90,2021],["cl","classic",1250,2,4.4,47,2021],["cl","swift",1900,2,4.3,35,2021],["cl","shine",600,2,4.3,29,2022],
  ["kz","activa",450,4,4.5,70,2022],["kz","shine",550,3,4.5,41,2022],["kz","classic",1200,2,4.6,26,2022],
  ["sm","activa",500,4,4.2,52,2021],["sm","shine",600,2,4.1,23,2021],
  ["hp","scorpio",4200,2,4.7,38,2023],["hp","thar",4500,2,4.8,41,2023],["hp","xuv700",4800,1,4.8,15,2024],["hp","himalayan",2400,4,4.9,66,2024],["hp","classic",1600,3,4.6,30,2022]
];
const LISTINGS = {};
/* row: [agency, model, price per day, units, rating, trips, year, optional own photo path] */
L.forEach(([a,m,price,units,rating,trips,year,photo])=>{LISTINGS[a+"-"+m]={id:a+"-"+m,agency:a,model:m,price,units,rating,trips,year,photo}});

/* ---------- tour operators ---------- */
const OPERATORS = {
  pc:{name:"Pinecone Travel Co.", base:"shillong", demo:true, verified:true, rating:4.7, reviews:264, trips:980, since:2015, hue:150,
    about:"Small-group and private trips across Meghalaya with local Khasi guides and homestays."},
  rj:{name:"Rainline Journeys", base:"guwahati", demo:true, verified:true, rating:4.5, reviews:171, trips:640, since:2018, hue:210,
    about:"Good-value Meghalaya and Assam trips from Guwahati, including weekend getaways."},
  tl:{name:"Tealeaf Tours & Rentals", base:"guwahati", demo:true, verified:true, rating:4.8, reviews:389, trips:1320, since:2014, hue:95,
    about:"Guwahati travel company running tours across Meghalaya and Assam. Also rents cars and bikes on OPIIUS.", agency:"tl"},
  rc:{name:"Rhino Country Trips", base:"kaziranga", demo:true, verified:true, rating:4.6, reviews:98, trips:410, since:2016, hue:95,
    about:"Kaziranga safari specialists with lodges near the Central and Eastern ranges."},
  hj:{name:"Highpass Journeys", base:"tawang", demo:true, verified:true, rating:4.8, reviews:76, trips:240, since:2017, hue:220,
    about:"Arunachal road trips over Sela Pass, with permits arranged. Sister company of Highpass Rentals.", agency:"hp"}
};

/* ---------- tour packages ---------- */
const INC_ALL = ["Hotel","Meals","Transport","Guide","Activities"];
const PKG = (o)=>o;
const PACKAGES = {
  "shillong-weekend":PKG({title:"Shillong Weekend", op:"rj", dest:"shillong", days:2, nights:1, price:6499, rating:4.4, reviews:58,
    types:["Weekend","Budget"], acts:["Sightseeing"], inc:["Hotel","Transport"], stops:["guwahati","umiam","shillong","guwahati"],
    blurb:"A quick escape to the hills: Umiam Lake on the way up, an evening in Police Bazar and Shillong Peak in the morning.",
    itin:[["Guwahati to Shillong","Drive up via Umiam Lake. Evening free in Police Bazar."],["Shillong to Guwahati","Shillong Peak and Ward's Lake, then back to Guwahati by evening."]],
    notInc:["Meals","Entry tickets","Personal expenses"]}),
  "shillong-sohra-3":PKG({title:"Shillong & Sohra Classic", op:"rj", dest:"meghalaya", days:3, nights:2, price:9499, rating:4.5, reviews:112,
    types:["Family","Budget"], acts:["Sightseeing","Waterfalls"], inc:["Hotel","Meals","Transport"], stops:["guwahati","umiam","shillong","sohra","laitlum","guwahati"],
    blurb:"The essential first trip: Shillong, the waterfalls and caves of Sohra and sunrise at Laitlum.",
    itin:[["Guwahati to Shillong","Umiam Lake on the way. Check in and explore Police Bazar."],["Sohra day trip","Nohkalikai falls, Mawsmai cave and Seven Sisters falls."],["Laitlum and back","Sunrise at Laitlum Canyons, then the drive back to Guwahati."]],
    notInc:["Lunch and dinner","Entry tickets","Personal expenses"]}),
  "sohra-waterfalls-3":PKG({title:"Sohra Waterfalls Trail", op:"pc", dest:"sohra", days:3, nights:2, price:10999, rating:4.7, reviews:84,
    types:["Adventure","Solo"], acts:["Waterfalls","Trekking"], inc:["Hotel","Meals","Transport","Guide"], stops:["guwahati","shillong","sohra","nongriat","sohra","guwahati"],
    blurb:"Two nights in a Sohra homestay, the big falls and a guided walk down to the Nongriat root bridges.",
    itin:[["Guwahati to Sohra","Via Shillong. Evening at a Sohra homestay."],["Nongriat root bridges","Guided trek down about 3,500 steps to the double-decker bridge and Rainbow Falls."],["Falls and return","Nohkalikai and Mawsmai cave, then back to Guwahati."]],
    notInc:["Lunch","Personal expenses"]}),
  "meghalaya-explorer-4":PKG({title:"Meghalaya Explorer", op:"pc", dest:"meghalaya", days:4, nights:3, price:12999, rating:4.8, reviews:203,
    types:["Family","Group"], acts:["Sightseeing","Waterfalls","Boating"], inc:["Hotel","Meals","Transport","Activities"], stops:["guwahati","umiam","shillong","sohra","dawki","mawlynnong","shillong","guwahati"],
    blurb:"Shillong, Sohra, the clear waters of Dawki and the village of Mawlynnong in four relaxed days.",
    itin:[["Guwahati to Shillong","Umiam Lake and an evening in Police Bazar."],["Sohra","Nohkalikai, Mawsmai cave and Arwah cave."],["Dawki and Mawlynnong","Boat ride on the Umngot, sky walk and the Riwai root bridge."],["Laitlum and return","Laitlum Canyons, then back to Guwahati."]],
    notInc:["Lunch","Personal expenses"]}),
  "meghalaya-explorer-plus-4":PKG({title:"Meghalaya Explorer Plus", op:"tl", dest:"meghalaya", days:4, nights:3, price:15499, rating:4.9, reviews:147,
    types:["Family","Luxury"], acts:["Sightseeing","Waterfalls","Boating"], inc:INC_ALL, stops:["guwahati","umiam","shillong","sohra","dawki","mawlynnong","shillong","guwahati"],
    blurb:"The same loop with better hotels, an Innova throughout, all entry tickets and a local guide.",
    itin:[["Guwahati to Shillong","Airport pick-up, Umiam Lake, check in to a 4-star hotel."],["Sohra","Guided day at the falls and caves."],["Dawki and Mawlynnong","Boat ride included."],["Return","Laitlum at sunrise, drop at the airport or station."]],
    notInc:["Personal expenses","Tips"]}),
  "meghalaya-honeymoon-4":PKG({title:"Clouds & Crystal Water", op:"pc", dest:"meghalaya", days:4, nights:3, price:21999, rating:4.9, reviews:61,
    types:["Honeymoon","Luxury"], acts:["Sightseeing","Boating","Waterfalls"], inc:["Hotel","Meals","Transport","Activities"], stops:["guwahati","umiam","shillong","dawki","sohra","guwahati"],
    blurb:"A private honeymoon trip with a lakeside resort, a candlelit dinner and a private boat at Dawki.",
    itin:[["Arrive at Umiam","Lakeside resort, evening at leisure."],["Dawki","Private boat on the Umngot and lunch by the river."],["Sohra","Waterfalls and a cliffside stay."],["Return","Slow breakfast, then back to Guwahati."]],
    notInc:["Personal expenses"]}),
  "root-bridges-5":PKG({title:"Root Bridges & Rivers", op:"tl", dest:"meghalaya", days:5, nights:4, price:16999, rating:4.8, reviews:132,
    types:["Adventure","Group"], acts:["Trekking","Waterfalls","Boating","Sightseeing"], inc:INC_ALL, stops:["guwahati","shillong","sohra","nongriat","dawki","mawlynnong","shillong","guwahati"],
    blurb:"Meghalaya's greatest hits plus a night near Nongriat and the full root bridge trek.",
    itin:[["Guwahati to Shillong","Umiam Lake on the way."],["Sohra","Falls and caves, night near Tyrna."],["Nongriat trek","Double-decker root bridge and Rainbow Falls with a guide."],["Dawki and Mawlynnong","Boating and the village sky walk."],["Return","Laitlum, then Guwahati."]],
    notInc:["Personal expenses"]}),
  "umngot-camp-3":PKG({title:"Camp by the Umngot", op:"rj", dest:"dawki", days:3, nights:2, price:8999, rating:4.6, reviews:77,
    types:["Adventure","Budget","Group"], acts:["Camping","Boating"], inc:["Meals","Transport","Activities"], stops:["guwahati","shillong","shnongpdeng","dawki","guwahati"],
    blurb:"Two nights in riverside tents at Shnongpdeng with kayaking, cliff jumping and a bonfire.",
    itin:[["Guwahati to Shnongpdeng","Via Shillong. Set up camp by the river."],["River day","Kayaking, snorkelling and boating to Dawki."],["Return","Breakfast by the river, back to Guwahati."]],
    notInc:["Hotel (tents included)","Personal expenses"]}),
  "meghalaya-family-6":PKG({title:"Meghalaya Family Holiday", op:"tl", dest:"meghalaya", days:6, nights:5, price:22499, rating:4.8, reviews:94,
    types:["Family"], acts:["Sightseeing","Waterfalls","Boating"], inc:INC_ALL, stops:["guwahati","umiam","shillong","laitlum","sohra","dawki","mawlynnong","shillong","guwahati"],
    blurb:"An unhurried week for families: shorter drives, kid-friendly stops and two nights in Shillong.",
    itin:[["Arrive","Umiam Lake boating, check in."],["Shillong","Museum, Ward's Lake and Shillong Peak."],["Laitlum","Sunrise and a relaxed afternoon."],["Sohra","Waterfalls and caves."],["Dawki and Mawlynnong","Boat ride and village walk."],["Return","Back to Guwahati."]],
    notInc:["Personal expenses"]}),
  "shillong-luxury-3":PKG({title:"Shillong Luxury Retreat", op:"pc", dest:"shillong", days:3, nights:2, price:32000, rating:4.9, reviews:29,
    types:["Luxury","Honeymoon"], acts:["Sightseeing"], inc:["Hotel","Meals","Transport","Guide"], stops:["guwahati","umiam","shillong","laitlum","guwahati"],
    blurb:"Heritage stays, a private car with driver and a chef-led Khasi dinner.",
    itin:[["Arrive","Private transfer and heritage bungalow check-in."],["Shillong","Guided city walk and Laitlum at golden hour."],["Return","Late check-out, transfer to Guwahati."]],
    notInc:["Personal expenses"]}),
  "kaziranga-weekend":PKG({title:"Kaziranga Safari Weekend", op:"rc", dest:"kaziranga", days:2, nights:1, price:7999, rating:4.6, reviews:88,
    types:["Weekend","Family"], acts:["Wildlife"], inc:["Hotel","Meals","Transport","Activities"], stops:["guwahati","kaziranga","guwahati"],
    blurb:"A jeep safari in the Central Range and a night in a lodge by the tea gardens.",
    itin:[["Guwahati to Kaziranga","Afternoon jeep safari in the Central Range."],["Return","Morning tea-garden walk, back to Guwahati."]],
    notInc:["Elephant safari","Camera fees","Personal expenses"]}),
  "kaziranga-escape-3":PKG({title:"Kaziranga Wildlife Escape", op:"rc", dest:"kaziranga", days:3, nights:2, price:11499, rating:4.7, reviews:65,
    types:["Family","Adventure"], acts:["Wildlife","Sightseeing"], inc:INC_ALL, stops:["guwahati","kaziranga","guwahati"],
    blurb:"Two safaris in different ranges, a naturalist guide and a cultural evening.",
    itin:[["Arrive","Afternoon at the orchid park."],["Safari day","Morning and afternoon jeep safaris in two ranges."],["Return","Back to Guwahati."]],
    notInc:["Elephant safari","Personal expenses"]}),
  "assam-meghalaya-7":PKG({title:"Assam & Meghalaya Grand Tour", op:"tl", dest:"meghalaya", days:7, nights:6, price:27999, rating:4.8, reviews:71,
    types:["Family","Group"], acts:["Wildlife","Sightseeing","Waterfalls","Boating"], inc:INC_ALL, stops:["guwahati","kaziranga","guwahati","shillong","sohra","dawki","shillong","guwahati"],
    blurb:"Rhinos in Kaziranga, then the hills, falls and rivers of Meghalaya in one week.",
    itin:[["Guwahati to Kaziranga","Evening at the lodge."],["Kaziranga","Jeep safari."],["To Shillong","Via Guwahati and Umiam Lake."],["Shillong","City and Laitlum."],["Sohra","Falls and caves."],["Dawki","Boat ride and Mawlynnong."],["Return","Back to Guwahati."]],
    notInc:["Personal expenses"]}),
  "tawang-sela-6":PKG({title:"Tawang via Sela Pass", op:"hj", dest:"tawang", days:6, nights:5, price:24999, rating:4.8, reviews:54,
    types:["Adventure","Group"], acts:["Sightseeing","Culture"], inc:["Hotel","Meals","Transport","Guide"], stops:["guwahati","tezpur","bomdila","dirang","sela","tawang","dirang","guwahati"],
    blurb:"Over Sela Pass to Tawang Monastery, with permits arranged and an SUV built for the road.",
    itin:[["Guwahati to Bomdila","Via Tezpur."],["Bomdila to Tawang","Over Sela Pass at about 4,170 m."],["Tawang","Tawang Monastery and the war memorial."],["Bum La side trip","If permitted on the day."],["Tawang to Dirang","Hot springs and apple orchards."],["Return","Back to Guwahati."]],
    notInc:["Inner Line Permit fee","Personal expenses"]}),
  "tawang-family-7":PKG({title:"Tawang & Dirang Family Trip", op:"hj", dest:"tawang", days:7, nights:6, price:29999, rating:4.7, reviews:31,
    types:["Family"], acts:["Sightseeing","Culture"], inc:INC_ALL, stops:["guwahati","tezpur","dirang","sela","tawang","bomdila","guwahati"],
    blurb:"A slower Arunachal trip with shorter driving days and two nights in Tawang.",
    itin:[["Guwahati to Tezpur","Easy first day."],["Tezpur to Dirang","Into the mountains."],["Dirang to Tawang","Over Sela Pass."],["Tawang","Monastery and markets."],["Tawang","Madhuri Lake if open."],["Tawang to Bomdila","Monastery and viewpoints."],["Return","Back to Guwahati."]],
    notInc:["Inner Line Permit fee","Personal expenses"]}),
  "tawang-moto-8":PKG({title:"Tawang Motorcycle Expedition", op:"hj", dest:"tawang", days:8, nights:7, price:38999, rating:4.9, reviews:23,
    types:["Adventure","Solo"], acts:["Sightseeing","Camping"], inc:["Hotel","Meals","Guide","Activities"], stops:["guwahati","tezpur","bomdila","dirang","sela","tawang","dirang","guwahati"],
    blurb:"Ride a Royal Enfield Himalayan to Tawang with a road captain and a back-up vehicle.",
    itin:[["Guwahati","Bike handover and briefing."],["To Bomdila","Via Tezpur."],["To Dirang","Short riding day."],["Over Sela to Tawang","The big day."],["Tawang","Rest and explore."],["Tawang to Dirang","Downhill run."],["To Tezpur","Out of the mountains."],["Return","Back to Guwahati."]],
    notInc:["Fuel","Inner Line Permit fee","Personal expenses"]})
};

/* ---------- real Guwahati agencies not on OPIIUS (public info only) ---------- */
const DIRECTORY = [
  {name:"AS01 Self Drive", url:"https://www.as01selfdrive.com/", kinds:["car"], about:"Thar, Innova, Creta and more. Unlimited km and doorstep delivery."},
  {name:"Onroadz Guwahati", url:"https://www.onroadzguwahati.com/", kinds:["car"], about:"Self-drive cars with 300 km/day, airport delivery and 24x7 roadside help."},
  {name:"FuFu Gadi", url:"https://www.fufugadi.com/", kinds:["car"], about:"Self-drive cars for Assam and Meghalaya trips. Airport, railway or doorstep delivery."},
  {name:"Fab Wheelz", url:"https://www.fabwheelz.com/", kinds:["car"], about:"Self-drive cars; says zero security deposit."},
  {name:"Wanderides", url:"https://www.wanderides.com/", kinds:["car"], about:"Self-drive cars, plus Innova with driver and tempo travellers."},
  {name:"ZIPZAP Car Rentals", url:"https://zipzapcarrentals.com/", kinds:["car"], about:"Self-drive car rental for Northeast trips."},
  {name:"RideHard", url:"https://ridehard.in/", kinds:["bike"], about:"Royal Enfield, Himalayan and scooties. Delivery across town."},
  {name:"Sukuto", url:"https://sukuto.com/bike-rental-in-guwahati/", kinds:["bike"], about:"Activa, Dio, Pulsar and Royal Enfield. Says no deposit."},
  {name:"Gearz Vehicle", url:"https://gearzvehicle.com/bike-on-rent-in-guwahati/paltan-bazar", kinds:["bike"], about:"Bikes and scooties on rent in Paltan Bazar, helmet included."},
  {name:"SafarCabby", url:"https://www.safarcabby.com/guwahati/bike-rental-in-guwahati", kinds:["bike"], about:"Bike rental at Zoo Road Tiniali for city rides and Shillong trips."},
  {name:"Trivane", url:"https://www.trivane.com/", kinds:["bike","car"], about:"Motorcycle rental with free helmets for rider and pillion; self-drive cars too."},
  {name:"Zola Adventures", url:"https://www.zolaadventures.com/", kinds:["bike","car"], about:"Bikes, scooties and self-drive cars, including RE Himalayan."},
  {name:"Canopy Northeast", url:"https://www.canopytravels.com/", kinds:["bike","car"], about:"Self-drive cars, bikes and scooties."}
];

/* ---------- sample reviews (demo) ---------- */
const REVIEW_BANK = [
  ["Ankita S.","Car was clean and ready at the station at 6 am. Deposit came back the same evening."],
  ["Rahul M.","Smooth pick-up and fair km limit for our Shillong trip."],
  ["Tenzin D.","Helpful on WhatsApp and the bike ran perfectly over two days."],
  ["Priya K.","Exactly the price shown. No surprises at return."],
  ["Joseph L.","Great value. Would rent again for the next Meghalaya trip."]
];

window.OP = {PLACES,RENTAL_CITIES,DESTINATIONS,DEST_FACTS,BRANDS,MODELS,AGENCIES,LISTINGS,OPERATORS,PACKAGES,DIRECTORY,REVIEW_BANK,LOGOS:{"maruti":"M17.369 19.995C13.51 22.39 12 24 12 24L.105 15.705s5.003-3.715 9.186-.87l5.61 3.882.683-.453L.106 7.321s2.226-.65 6.524-3.315C10.49 1.609 12 0 12 0l11.895 8.296s-5.003 3.715-9.187.87L9.1 5.281l-.683.454L23.893 16.68s-2.224.649-6.524 3.315Z","hyundai":"M12 18.1622c-6.6275 0-12-2.7586-12-6.163 0-3.4028 5.3725-6.1614 12-6.1614 6.6278 0 12 2.7586 12 6.1614 0 3.4044-5.3722 6.163-12 6.163zM7.6023 7.17C3.701 7.9784.973 9.8302.973 11.9844c0 1.1929.8382 2.2932 2.248 3.1757.1174.0724.1941.0862.251.0826.1019-.006.1593-.0698.201-.146.028-.0485.0631-.1225.0972-.1968.4601-1.0834 2.0776-4.8333 4.2023-7.3758a1.1775 1.1775 0 0 0 .1048-.1461c.046-.084.0356-.1513.0006-.192-.0593-.0647-.2247-.065-.4756-.016zM9.742 8.8995c-1.1728 2.8492 1.0473 2.4961 1.6478 2.3637 1.0203-.2258 1.9944-.6128 2.7746-.925 2.2216-.8887 3.4012-1.7804 3.7925-2.123a1.9839 1.9839 0 0 0 .1076-.0988c.0557-.058.0976-.1192.0976-.2002 0-.0936-.081-.1687-.2374-.2231-.012-.0049-.0517-.021-.0641-.025-1.698-.5415-3.724-.8563-5.9016-.8563-.0168 0-.0586-.0022-.1169 0-.2608.0078-.5509.0664-.787.1888-.7777.4049-1.1163 1.4235-1.313 1.899zm10.5851.0037c-.0268.0487-.0612.1224-.0962.1974-.4599 1.0826-2.0774 4.831-4.2018 7.3733-.0515.063-.0796.1031-.1042.1467-.0492.0846-.0388.1535 0 .1935.0572.0641.2235.0654.474.0157 3.8998-.81 6.628-2.6606 6.628-4.8149 0-1.1925-.836-2.2928-2.2472-3.1745-.1161-.073-.1934-.0871-.25-.083-.1028.0067-.16.0699-.2026.1458zM14.258 15.099c1.173-2.849-1.0483-2.494-1.6467-2.3622-1.0218.225-1.996.613-2.7757.924-2.2226.8883-3.4017 1.782-3.7944 2.1234-.0468.0428-.0833.0742-.1066.0995-.0564.0573-.0967.1178-.0967.2007 0 .0923.08.1688.2362.2229.012.0048.0511.0213.0657.0255 1.696.54 3.722.8557 5.9.8557.0177 0 .0592.0016.1178 0 .2609-.0081.5522-.0677.7871-.1888.7781-.4052 1.1169-1.4234 1.3133-1.9007z","tata":"M9.774 11.568c.193-1.322.168-2.013-1.768-1.906-2.223.124-4.476.265-7.849 1.027A5.63 5.63 0 0 0 0 12c0 1.52.618 2.99 1.787 4.254 1.06 1.144 2.556 2.095 4.326 2.752a15.48 15.48 0 0 0 2.014.588c.13-.527.959-3.907 1.616-7.823l.03-.202m14.07-.88c-3.372-.762-5.624-.902-7.846-1.026-1.937-.107-1.962.584-1.768 1.906l.046.298c.65 3.848 1.458 7.16 1.598 7.72C20.595 18.508 24 15.516 24 12c0-.443-.054-.88-.157-1.311m-.491-1.324a7.163 7.163 0 0 0-1.14-1.618c-1.06-1.144-2.555-2.095-4.325-2.752-1.784-.662-3.82-1.011-5.887-1.011-2.068 0-4.103.35-5.887 1.01-1.77.658-3.266 1.61-4.326 2.753A7.17 7.17 0 0 0 .648 9.366c2.304-.557 6.245-1.293 9.904-1.37.353-.008.596.105.756.307.196.248.18 1.128.175 1.522l-.104 10.18a18.507 18.507 0 0 0 1.244 0l-.104-10.18c-.005-.394-.02-1.274.175-1.522.16-.202.403-.315.756-.308 3.658.078 7.597.813 9.902 1.37z","toyota":"M12 3.848C5.223 3.848 0 7.298 0 12c0 4.702 5.224 8.152 12 8.152S24 16.702 24 12c0-4.702-5.223-8.152-12-8.152zm7.334 3.839c0 1.08-1.725 1.913-4.488 2.246-.26-2.58-1.005-4.279-1.963-4.913 2.948.184 6.45 1.227 6.45 2.667zM12 16.401c-.96 0-1.746-1.5-1.808-4.389.577.047 1.18.072 1.808.072.628 0 1.23-.025 1.807-.072-.061 2.89-.847 4.389-1.807 4.389zm0-6.308c-.59 0-1.155-.019-1.69-.054.261-1.728.92-3.15 1.69-3.15.77 0 1.428 1.422 1.689 3.15-.535.034-1.099.054-1.689.054zm-.882-5.075c-.956.633-1.706 2.333-1.964 4.915C6.391 9.6 4.665 8.767 4.665 7.687c0-1.44 3.504-2.49 6.453-2.669zM2.037 11.68a5.265 5.265 0 011.048-3.164c.27 1.547 2.522 2.881 5.972 3.37V12c0 3.772.879 6.203 2.087 6.97-5.107-.321-9.107-3.48-9.107-7.29zm10.823 7.29c1.207-.767 2.087-3.198 2.087-6.97v-.115c3.447-.488 5.704-1.826 5.972-3.37a5.26 5.26 0 011.049 3.165c-.004 3.81-4.008 6.969-9.109 7.29z","kia":"M13.923 14.175c0 .046.015.072.041.072a.123.123 0 0 0 .058-.024l7.48-4.854a.72.72 0 0 1 .432-.13h1.644c.252 0 .422.168.422.42v3.139c0 .38-.084.6-.42.801l-1.994 1.2a.137.137 0 0 1-.067.024c-.024 0-.048-.019-.048-.088v-3.663c0-.043-.012-.071-.041-.071a.113.113 0 0 0-.058.024l-5.466 3.551a.733.733 0 0 1-.42.127h-3.624c-.254 0-.422-.168-.422-.422V9.757c0-.033-.015-.064-.044-.064a.118.118 0 0 0-.057.024L7.732 11.88c-.036.024-.046.041-.046.058 0 .014.008.029.032.055l2.577 2.575c.034.034.058.06.058.089 0 .024-.039.043-.084.043H7.94c-.183 0-.324-.026-.423-.125l-1.562-1.56a.067.067 0 0 0-.048-.024.103.103 0 0 0-.048.015l-2.61 1.57a.72.72 0 0 1-.423.122H.425C.168 14.7 0 14.53 0 14.279v-3.08c0-.38.084-.6.422-.8L2.43 9.192a.103.103 0 0 1 .052-.016c.032 0 .048.03.048.1V13.4c0 .043.01.063.041.063a.144.144 0 0 0 .06-.024L9.407 9.36a.733.733 0 0 1 .446-.124h3.648c.252 0 .422.168.422.42l-.002 4.518z","honda":"M23.902 6.87c-.33-3.218-2.47-3.895-4.354-4.204-.946-.16-2.63-.3-3.716-.34-.946-.06-3.168-.09-3.835-.09-.657 0-2.89.03-3.835.09-1.076.04-2.77.18-3.716.34C2.563 2.985.42 3.66.092 6.87c-.08.877-.1 2.023-.09 3.248.03 2.031.2 3.406.3 4.363.07.657.338 2.62.687 3.636.478 1.395.916 1.803 1.424 2.222.937.757 2.471.996 2.79 1.056 1.733.31 5.24.368 6.784.368 1.544 0 5.05-.05 6.784-.368.329-.06 1.863-.29 2.79-1.056.508-.419.946-.827 1.424-2.222.35-1.016.628-2.979.698-3.636.1-.957.279-2.332.299-4.363.04-1.225.01-2.371-.08-3.248m-1.176 5.4c-.19 2.57-.418 4.104-.747 5.22-.29.976-.637 1.623-1.165 2.092-.867.787-2.063.956-2.76 1.056-1.514.23-4.055.3-6.057.3-2.002 0-4.543-.08-6.057-.3-.697-.1-1.893-.269-2.76-1.056-.518-.469-.876-1.126-1.155-2.093-.329-1.105-.558-2.65-.747-5.22-.11-1.543-.09-4.054.08-5.4.258-2.011 1.255-3.018 3.387-3.396.996-.18 2.34-.31 3.606-.37 1.016-.07 2.7-.1 3.636-.09.936-.01 2.62.03 3.636.09 1.275.06 2.61.19 3.606.37 2.142.378 3.139 1.395 3.388 3.397.199 1.345.229 3.856.11 5.4m-5.202-8.39c-.548 2.462-.767 3.588-1.216 5.37-.428 1.715-.767 3.298-1.335 4.065-.587.777-1.365.947-1.893 1.006-.279.03-.478.04-1.066.05-.596 0-.796-.02-1.075-.05-.528-.06-1.315-.229-1.892-1.006-.578-.767-.907-2.35-1.335-4.064-.47-1.773-.678-2.91-1.236-5.37 0 0-.548.02-.797.04-.329.02-.588.05-.867.09.343 5.372.692 11.079 1.126 16.13a21.983 21.983 0 002.39.169c.33-1.266.748-3.02 1.207-3.767.378-.608.966-.677 1.295-.717.518-.07.956-.08 1.165-.08.2-.01.637 0 1.165.08.33.05.917.11 1.295.717.47.747.877 2.5 1.206 3.766 0 0 .358-.01 1.165-.05.41-.018.82-.058 1.226-.12.458-5.39.785-10.728 1.126-16.128-.28-.04-.538-.07-.867-.09-.23-.02-.787-.04-.787-.04z"}};
})();
