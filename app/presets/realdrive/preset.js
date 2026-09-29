/* Real Drive Ghy: the Rentals app set up with their WhatsApp catalog (cars, day prices, photos).
   Deposits, km limits, number plates, people and bookings are sample values for the demo.
   "@@photo:<file>@@" is replaced with the image by tools/preset.py. */
window.PRESET={
  id:'realdrive', name:'Real Drive Ghy', brand:'REAL DRIVE', prefix:'RD-',
  sub:'Self-drive cars · Guwahati',
  tagline:'Your self-drive rental desk &mdash; cars, bookings, deposits and WhatsApp, all on one phone.',
  credits:'A demo made for Real Drive Ghy by OPIIUS. Cars, photos and day prices are from your WhatsApp catalog; '
    +'deposits, km limits, number plates, customers and bookings are sample data.',
  vehicles:{
    i20:   {label:'Hyundai Elite i20',     short:'Elite i20',     em:'🚗', day:1500, wkend:1500, dep:5000,  km:250, xkm:8,  car:1},
    punch: {label:'Tata Punch',            short:'Tata Punch',    em:'🚙', day:1900, wkend:1900, dep:5000,  km:250, xkm:9,  car:1},
    breeza:{label:'Maruti Suzuki Breeza',  short:'Breeza',        em:'🚙', day:2400, wkend:2400, dep:6000,  km:250, xkm:10, car:1},
    xl6:   {label:'Maruti Suzuki XL6',     short:'XL6',           em:'🚐', day:3100, wkend:3100, dep:8000,  km:300, xkm:12, car:1},
    carens:{label:'Kia Carens',            short:'Kia Carens',    em:'🚐', day:3300, wkend:3300, dep:8000,  km:300, xkm:12, car:1},
    innova:{label:'Toyota Innova Crysta',  short:'Innova Crysta', em:'🚐', day:3500, wkend:3500, dep:10000, km:300, xkm:14, car:1}
  },
  photos:{
    i20:'@@photo:i20.jpg@@', punch:'@@photo:punch.jpg@@', breeza:'@@photo:breeza.jpg@@',
    xl6:'@@photo:xl6.jpg@@', carens:'@@photo:carens.jpg@@', innova:'@@photo:innova.jpg@@'
  },
  sim:{types:['breeza','punch','i20'], noun:'car'},
  seedRent:function(){
    var t=today(), sat=nextDow(6); if(sat===t)sat=addD(t,7);
    var units=[
      ['AS01 RD 1501','i20',31240],['AS01 RD 1502','i20',27810],
      ['AS01 RD 1901','punch',18400],['AS01 RD 1902','punch',22950],
      ['AS01 RD 2401','breeza',15620],['AS01 RD 2402','breeza',24310],
      ['AS01 RD 3101','xl6',20480],['AS01 RD 3301','carens',12870],['AS01 RD 3501','innova',41560]
    ].map(function(u){return {reg:u[0],type:u[1],odo:u[2],fuel:5,svc:null};});
    units[3].svc='Periodic service at 23,000 km · ready tomorrow';
    var seq=1040, bk=[];
    function b(name,phone,reg,start,days,status,trip,extra){
      seq++; var u=units.filter(function(x){return x.reg===reg;})[0], rent=rentFor(u.type,start,days);
      var o={id:'RD-'+seq,name:name,phone:phone,reg:reg,type:u.type,start:start,days:days,rent:rent,adv:Math.round(rent*.3),
        dep:BIKES[u.type].dep,status:status,trip:trip,src:extra&&extra.src||'WhatsApp AI'};
      for(var k in extra)o[k]=extra[k];
      bk.push(o);
    }
    b('Kenny Lyngdoh','87210 90044','AS01 RD 3101',addD(t,-3),2,'active','Dawki',{out:{odo:20480,fuel:5}});
    b('Nitin Kalita','70020 45519','AS01 RD 3501',addD(t,-2),3,'active','Kaziranga',{out:{odo:41560,fuel:5}});
    b('Priya Baruah','98640 11873','AS01 RD 1501',addD(t,-1),3,'active','City',{out:{odo:31240,fuel:5},src:'Walk-in'});
    b('Arjun Bora','98540 22301','AS01 RD 3301',t,2,'upcoming','Shillong');
    b('Rituraj Das','60010 77231','AS01 RD 1901',addD(t,1),2,'upcoming','Sohra');
    b('Sneha Gogoi','91010 33845','AS01 RD 2401',sat,2,'upcoming','City',{src:'Instagram'});
    b('Manas Deka','97060 11290','AS01 RD 2402',addD(t,-6),2,'done','Shillong',{settle:{refund:5640,ded:360}});
    b('Ayesha Khan','88110 42007','AS01 RD 1902',addD(t,-5),3,'done','Tawang',{settle:{refund:5000,ded:0}});
    b('Bikram Rai','70990 13566','AS01 RD 1502',addD(t,-4),1,'done','City',{settle:{refund:4760,ded:240}});
    return {units:units,bk:bk,seq:seq,week:[12400,9300,15600,7200,18900,21500,0],
      inbox:[
        {id:1,who:'+91 70023 55128',status:'need',time:'9:42',msgs:[
          ['in','Hi, is the Innova Crysta free next week? Tawang trip, 5 days'],
          ['bot','Yes! The Innova Crysta is free from Monday for 5 days: ₹17,500 rent, 1,500 km free, ₹10,000 deposit.'],
          ['in','Can you give it with a driver? And any discount for 5 days?']],
          ask:'Driver and discount — the assistant checks with you before promising.',
          suggest:'Hi! Yes, a driver is ₹800/day extra (his food and stay on your side). For 5 days I can do ₹16,500 instead of ₹17,500. Shall I block it?'},
        {id:2,who:'Rahul Sharma',status:'booked',time:'Yesterday',msgs:[
          ['in','Need a car this weekend for Shillong'],['bot','The Breeza is free Sat–Sun: ₹4,800 for 2 days, 500 km free. Book it?'],
          ['in','yes'],['bot','Done ✅ Rental RD-1039 — advance ₹1,440 received on UPI. See you Saturday 9 AM!']]},
        {id:3,who:'Meera Hazarika',status:'faq',time:'Yesterday',msgs:[
          ['in','How much is the deposit for the i20?'],['bot','₹5,000, fully refundable — we send it back on UPI the moment the car is checked in.'],
          ['in','ok thanks'],['bot','Anytime! Reply here whenever you want to book.']]}
      ]};
  }
};
