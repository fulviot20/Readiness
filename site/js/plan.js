"use strict";
/* ------------------------------------------------------------ food: today's plan */
// No diary. The day's need comes from the burn model (everyday burn + today's training), the weight aim and the
// weekly correction from the scale trend (food.js: targetOf, trimCheck). From it: protein 1.75 g/kg, fat at the
// hormone floor, carbohydrate the rest — minus what goes in the bottle. Those grams are spread over the meals of the
// day and every meal is made of a few parts (carbs, protein, fat, fruit, veg), each with alternatives: pick what's in
// the house, the grams follow. Dinner closes the day, so whatever you pick earlier, the total lands on the target.
// The weight trend is the only feedback: if it moves faster or slower than the aim, the need changes by itself.

// per 100 g: name, kcal, protein, carbs, fat, [g per household unit, unit, units]
const FD={
  oats:["Oats",375,13,60,7,[10,"tbsp","tbsp"]], milk:["Semi-skimmed milk",46,3.3,4.9,1.6], chia:["Chia seeds",486,17,8,31,[5,"tsp","tsp"]],
  raisins:["Raisins",300,3,79,.5,[8,"tsp","tsp"]], honey:["Honey",304,0,82,0,[7,"tsp","tsp"]], jam:["Jam",250,.4,60,0,[15,"tbsp","tbsp"]],
  muesli:["Muesli, no added sugar",360,10,62,6,[30,"handful","handfuls"]],
  bread:["Bread",270,8.5,55,1.5,[40,"slice","slices"]], wbread:["Wholemeal bread",240,9,45,2,[40,"slice","slices"]],
  roll:["Bread roll",280,9,57,1.5,[60,"roll","rolls"]], rusks:["Rusks",410,11,80,6,[10,"rusk","rusks"]],
  crackers:["Crackers",430,10,70,11,[25,"pack","packs"]], grissini:["Grissini",410,12,70,9,[6,"stick","sticks"]],
  ricecakes:["Rice cakes",380,8,80,3,[8,"cake","cakes"]], piadina:["Piadina (olive oil)",300,8,50,7,[110,"piadina","piadine"]],
  pasta:["Pasta (dry)",355,12.5,72,1.5,[80,"plate","plates"]], rice:["Rice (dry)",350,7,79,.6,[80,"plate","plates"]],
  couscous:["Couscous (dry)",360,12.5,72,1,[80,"plate","plates"]], potato:["Potatoes (raw)",77,2,17,.1,[200,"medium","medium"]],
  gnocchi:["Potato gnocchi",150,4,33,.3,[200,"plate","plates"]], cpasta:["Plain pasta or rice, cooked",160,5.5,32,1,[220,"plate","plates"]],
  banana:["Banana",89,1.1,23,.3,[120,"banana","bananas"]], kiwi:["Kiwi",61,1.1,14,.5,[75,"kiwi","kiwis"]], apple:["Apple",52,.3,14,.2,[150,"apple","apples"]],
  orange:["Orange",47,.9,12,.1,[150,"orange","oranges"]], fruit:["Fruit",55,.6,13,.2,[150,"piece","pieces"]], dates:["Dates",280,2.5,75,.4,[8,"date","dates"]],
  greek:["Greek yogurt 0–2%",65,10,4,1,[150,"pot","pots"]], skyr:["Skyr",63,11,4,.2,[150,"pot","pots"]],
  cottage:["Cottage cheese",100,12,3,4.5,[150,"pot","pots"]], ricotta:["Ricotta",146,9,4,11,[100,"portion","portions"]],
  eggs:["Eggs",143,12.6,.7,9.5,[60,"egg","eggs"]], whites:["Egg whites",50,11,.7,.2,[33,"white","whites"]],
  chicken:["Chicken or turkey breast (raw)",110,23,0,1.5], fish:["White fish (raw)",82,18,0,.7], salmon:["Salmon (raw)",200,20,0,13],
  tuna:["Tuna in water (drained)",110,25,0,1,[56,"tin","tins"]], legumes:["Chickpeas, beans or lentils (drained)",120,7.5,17,2,[240,"jar","jars"]],
  crudo:["Prosciutto crudo, lean",220,27,0,12,[12,"slice","slices"]], bresaola:["Bresaola",150,32,0,2,[10,"slice","slices"]],
  mozz:["Mozzarella",250,18,1,19,[125,"ball","balls"]], tofu:["Tofu",120,13,2,7],
  oil:["Extra virgin olive oil",899,0,0,100,[10,"tbsp","tbsp"]], parm:["Parmesan",390,33,0,28,[10,"tbsp","tbsp"]],
  pb:["Peanut butter",600,25,15,50,[15,"tbsp","tbsp"]], nuts:["Almonds or walnuts",610,20,10,53,[10,"handful (small)","small handfuls"]],
  avocado:["Avocado",160,2,2,15,[70,"half","halves"]],
  veg:["Vegetables",25,1.8,4,.3], cveg:["Canteen side (cooked, dressed)",55,2,5,3],
  cmeat:["Meat or chicken",160,24,0,7,[150,"portion","portions"]], cfish:["Fish",120,20,1,4,[150,"portion","portions"]],
  cegg:["Eggs or omelette",160,11,1,12,[150,"portion","portions"]], ccheese:["Cheese",280,20,1,22,[100,"portion","portions"]],
  cleg:["Legumes",120,7.5,17,2,[200,"portion","portions"]],
};
// an option: parts [food, ratio to the main grams] or [food, 0, fixed grams]; lo–hi limits and rounding for the main part
const O=(name,parts,lo,hi,step=5,x={})=>({name,parts,lo,hi,step,...x});
const PART={
  carbsHome:[O("Pasta",[["pasta",1]],40,180),O("Rice",[["rice",1]],40,180),O("Bread",[["bread",1]],40,240,10),
    O("Potatoes",[["potato",1]],150,800,25),O("Couscous",[["couscous",1]],40,180),O("Gnocchi",[["gnocchi",1]],150,600,25),O("Piadina",[["piadina",1]],60,220,10)],
  protHome:[O("Chicken or turkey",[["chicken",1]],80,250,10),O("White fish",[["fish",1]],100,300,10),O("Salmon",[["salmon",1]],80,200,10),
    O("Eggs",[["eggs",1]],60,240,60),O("Tuna",[["tuna",1]],56,168,56),O("Legumes",[["legumes",1]],120,360,20),
    O("Lean prosciutto",[["crudo",1]],36,120,12),O("Bresaola",[["bresaola",1]],40,120,10),O("Mozzarella",[["mozz",1]],60,125,5),O("Tofu",[["tofu",1]],100,250,10)],
  fatMeal:[O("Olive oil",[["oil",1]],5,40,5),O("Olive oil + Parmesan",[["oil",.7],["parm",.3]],5,40,5),O("Avocado",[["avocado",1]],35,140,5)],
  veg:[O("Vegetables, as many as you like",[["veg",0,250]],0,0,1,{fixed:1})],
  snackCarb:[O("Banana",[["banana",1]],120,360,60),O("Fruit",[["fruit",1]],150,450,75),O("Crackers",[["crackers",1]],25,100,25),
    O("Rice cakes + jam",[["ricecakes",1],["jam",.5]],16,64,8),O("Bread + honey",[["bread",1],["honey",.2]],40,120,10),O("Dates",[["dates",1]],16,80,8),
    O("Grissini",[["grissini",1]],18,72,6)],
  snackProt:[O("Nothing",[],0,0,1,{fixed:1}),O("Greek yogurt",[["greek",1]],125,300,25),O("Skyr",[["skyr",1]],125,300,25),O("Bresaola",[["bresaola",1]],30,90,10),
    O("Cottage cheese",[["cottage",1]],100,250,25)],
  preRide:[O("Banana",[["banana",1]],60,240,60),O("Bread + honey",[["bread",1],["honey",.25]],30,120,10),O("Rusks + jam",[["rusks",1],["jam",.35]],20,80,10),
    O("Rice cakes + honey",[["ricecakes",1],["honey",.4]],16,64,8),O("Dates",[["dates",1]],16,80,8)],
};
const MEAL_T={
  b:{title:"Breakfast",ic:"b",parts:[
    ["Carbs","c",[O("Porridge: oats + milk (3×)",[["oats",1],["milk",3],["chia",0,5],["raisins",0,8]],40,140),O("Bread + jam",[["bread",1],["jam",.3]],60,200,10),
      O("Rusks + jam",[["rusks",1],["jam",.35]],30,120,10),O("Muesli + milk",[["muesli",1],["milk",2.5]],40,140)]],
    ["Protein","p",[O("Greek yogurt",[["greek",1]],150,300,10),O("Skyr",[["skyr",1]],150,300,10),O("Eggs",[["eggs",1]],60,180,60),O("Cottage cheese",[["cottage",1]],100,250,25)]],
    ["Fruit",null,[O("2 kiwis",[["kiwi",0,150]],0,0,1,{fixed:1}),O("Banana",[["banana",0,120]],0,0,1,{fixed:1}),O("Apple",[["apple",0,150]],0,0,1,{fixed:1}),O("Orange",[["orange",0,150]],0,0,1,{fixed:1})]],
    ["Fat","f",[O("Peanut butter",[["pb",1]],10,30,5),O("Almonds or walnuts",[["nuts",1]],10,30,5)]],
    ["Sweet",null,[O("Honey",[["honey",0,12]],0,0,1,{fixed:1}),O("Nothing",[],0,0,1,{fixed:1})]]]},
  s:{title:"Snack",ic:"s",parts:[["Carbs","c",PART.snackCarb],["Protein (optional)","p",PART.snackProt]]},
  lc:{title:"Lunch · canteen",ic:"l",parts:[
    ["Main course (one portion)",null,[O("Meat or chicken",[["cmeat",0,150]],0,0,1,{fixed:1}),O("Fish",[["cfish",0,150]],0,0,1,{fixed:1}),
      O("Eggs or omelette",[["cegg",0,150]],0,0,1,{fixed:1}),O("Cheese",[["ccheese",0,100]],0,0,1,{fixed:1}),O("Legumes",[["cleg",0,200]],0,0,1,{fixed:1})]],
    ["Carbs","c",[O("Bread",[["roll",1]],60,240,10),O("Plain pasta or rice",[["cpasta",1]],150,450,25),O("Crackers from home",[["crackers",1]],25,125,25),O("Grissini from home",[["grissini",1]],30,120,6)]],
    ["Side",null,[O("Vegetables",[["cveg",0,200]],0,0,1,{fixed:1})]],
    ["Fruit",null,[O("One piece of fruit",[["fruit",0,150]],0,0,1,{fixed:1}),O("Nothing",[],0,0,1,{fixed:1})]]]},
  l:{title:"Lunch",ic:"l",parts:[["Carbs","c",PART.carbsHome],["Protein","p",PART.protHome],["Veg",null,PART.veg],["Fat","f",PART.fatMeal]]},
  pre:{title:"Pre-ride · optional",ic:"s",parts:[["Carbs","c",PART.preRide]]},
  d:{title:"Dinner",ic:"d",parts:[["Carbs","c",PART.carbsHome],["Protein","p",PART.protHome],["Veg",null,PART.veg],["Fat","f",PART.fatMeal]]},
};
// share of the day's carbs / protein / fat for each meal (dinner takes what is left)
const SHARE={b:[.25,.2,.22],m:[.1,.12,.08],a:[.1,.12,.08],l:[.26,.28,.3],lc:[.26,.28,.3],pre:[.1,0,.02]};
const kindOf=date=>{const tr=dayTraining(date),we=new Date(date+"T12:00").getDay()%6===0;return {tr,train:tr.min>=20,long:tr.min>=180,we};};
// the shape of the day: on work days you train in the evening, at the weekend in the morning
function daySlots(date){
  const K=kindOf(date),home=lunchHome(date);
  const lunch=home?"l":"lc",ride={ride:1};
  if(!K.train) return [["b","b"],["m","s"],[lunch,lunch],["a","s"],["d","d"]];
  if(K.we) return [["b","b"],ride,[lunch,lunch],["a","s"],["d","d"]];
  return [["b","b"],["m","s"],[lunch,lunch],["pre","pre"],ride,["d","d"]];
}
const lunchAll=()=>lsJSON("rd_lunch",{});
function lunchHome(date){const v=lunchAll()[date];return v?v==="home":new Date(date+"T12:00").getDay()%6===0;}
function lunchSet(date,home){const A={...lunchAll()},lim=isoAdd(todayISO(),-14);A[date]=home?"home":"canteen";for(const d of Object.keys(A)) if(d<lim) delete A[d];syncSet("rd_lunch",A);}
// macros of one option at main grams g
function optMac(o,g){const t={g:0,kcal:0,p:0,c:0,f:0},lines=[];
  for(const [k,r,fix] of o.parts){const q=fix!=null?fix:g*r,F=FD[k];if(!q) continue;t.kcal+=F[1]*q/100;t.p+=F[2]*q/100;t.c+=F[3]*q/100;t.f+=F[4]*q/100;lines.push([k,q]);}
  return {...t,lines};}
const snapG=(o,g)=>o.fixed?0:clip(Math.round(g/o.step)*o.step,o.lo,o.hi);
function portionTxt(k,q){
  const F=FD[k],u=F[5];
  if(k==="milk") return `${Math.round(q/10)*10} ml`;
  if(!u) return `${Math.round(q)} g`;
  const n=Math.round(q/u[0]*2)/2,nt=n===.5?"½":String(n).replace(".5","½");
  const g=`${Math.round(q)} g`;
  return n<.5?g:`${g} · ${nt} ${n<=1?u[1]:u[2]}`;
}
const PSEL=()=>lsJSON("rd_plan_sel",{});
// What you actually ate, when it differs from the plan: per meal, the grams of a part, another option, extra foods,
// or "skipped". The meal is then fixed as eaten and dinner (the last meal) absorbs the difference.
const ateAll=()=>lsJSON("rd_ate",{});
const ateDay=d=>ateAll()[d]||{};
function ateSet(date,slot,v){const A={...ateAll()},D={...(A[date]||{})};if(v) D[slot]=v; else delete D[slot];A[date]=D;
  const lim=isoAdd(todayISO(),-14);for(const k of Object.keys(A)) if(k<lim) delete A[k];syncSet("rd_ate",A);}
const IT={oats:"avena fiocchi porridge",milk:"latte",chia:"semi chia",raisins:"uvetta",honey:"miele",jam:"marmellata confettura",muesli:"muesli",
  bread:"pane fetta",wbread:"pane integrale",roll:"panino rosetta",rusks:"fette biscottate",crackers:"cracker",grissini:"grissini",ricecakes:"gallette riso",
  piadina:"piadina",pasta:"pasta",rice:"riso",couscous:"couscous",potato:"patate",gnocchi:"gnocchi",cpasta:"pasta riso bianco cotta mensa",
  banana:"banana",kiwi:"kiwi",apple:"mela",orange:"arancia",fruit:"frutta",dates:"datteri",greek:"yogurt greco",skyr:"skyr",cottage:"fiocchi di latte",
  ricotta:"ricotta",eggs:"uova uovo",whites:"albume albumi",chicken:"pollo tacchino petto",fish:"pesce bianco merluzzo orata",salmon:"salmone",
  tuna:"tonno",legumes:"legumi ceci fagioli lenticchie",crudo:"prosciutto crudo",bresaola:"bresaola",mozz:"mozzarella",tofu:"tofu",
  oil:"olio oliva",parm:"parmigiano grana",pb:"burro arachidi",nuts:"mandorle noci frutta secca",avocado:"avocado",veg:"verdura verdure",
  cveg:"contorno mensa verdure",cmeat:"carne secondo mensa",cfish:"pesce mensa",cegg:"frittata uova mensa",ccheese:"formaggio mensa",cleg:"legumi mensa"};
// The whole day: target, bike, then every meal solved part by part; dinner gets the remainder
function dayPlan(date,off=0){
  const tg=targetOf(date);if(!tg) return null;
  const w=weightNow()||63,kcal=tg.kcal+off,sel=PSEL();
  const P=Math.round(1.75*w),Fa=Math.round(Math.max(.9*w,.2*kcal/9)),C=Math.max(0,Math.round((kcal-P*4-Fa*9)/4));
  const bike=bikeCarbs(date),slots=daySlots(date),meals=[];
  const day={p:P,c:Math.max(0,C-bike.g),f:Fa};let left={...day};
  const real=slots.filter(s=>!s.ride);
  real.forEach(([slot,tpl],i)=>{
    const T=MEAL_T[tpl],last=i===real.length-1,sh=SHARE[slot]||[0,0,0];
    let want=last?{...left}:{c:day.c*sh[0],p:day.p*sh[1],f:day.f*sh[2]};
    if(slot==="pre") want.c=clip(day.c*sh[0],25,60);
    const ate=ateDay(date)[slot]||null;
    const parts=T.parts.map(([role,solve,opts],pi)=>{const key=`${slot}.${pi}`,oi=clip(ate?.oi?.[key]??sel[key]??0,0,opts.length-1),o=opts[oi];
      const eg=ate&&(ate.skip?0:ate.g?.[key]);
      return {role,solve,opts,oi,o,key,g:o.fixed?0:(o.lo+o.hi)/2,eaten:eg!=null,eg,skip:!!ate?.skip};});
    // three rounds: each part sized to what the others leave of its own macro
    for(let it=0;it<4;it++) for(const x of parts){if(!x.solve||x.o.fixed||x.eaten) continue;
      const others=parts.filter(y=>y!==x).reduce((a,y)=>{const m=optMac(y.o,y.g);return {p:a.p+m.p,c:a.c+m.c,f:a.f+m.f};},{p:0,c:0,f:0});
      const per=optMac(x.o,100),need=want[x.solve]-others[x.solve],k=per[x.solve]/100;
      x.g=k>0?clip(need/k,x.o.lo,x.o.hi):x.o.lo;}
    for(const x of parts) x.g=x.eaten&&!x.o.fixed?x.eg:snapG(x.o,x.g);
    const extra=ate&&!ate.skip?ate.extra||[]:[];
    let tot=parts.reduce((a,x)=>{const m=x.skip?optMac({parts:[]},0):optMac(x.o,x.g);x.m=m;return {kcal:a.kcal+m.kcal,p:a.p+m.p,c:a.c+m.c,f:a.f+m.f};},{kcal:0,p:0,c:0,f:0});
    for(const e of extra) tot={kcal:tot.kcal+e.kcal,p:tot.p+e.p,c:tot.c+e.c,f:tot.f+e.f};
    left={p:left.p-tot.p,c:left.c-tot.c,f:left.f-tot.f};
    meals.push({ate,extra,slot,tpl,title:slot==="m"?"Mid-morning snack":slot==="a"?"Afternoon snack":T.title,ic:T.ic,parts,tot});
  });
  const sum=meals.reduce((a,m)=>({kcal:a.kcal+m.tot.kcal,p:a.p+m.tot.p,c:a.c+m.tot.c,f:a.f+m.tot.f}),{kcal:bike.g*4,p:0,c:bike.g,f:0});
  return {tg,kcal,P,C,F:Fa,bike,slots,meals,sum,K:kindOf(date)};
}
// what goes in the bottle today: planned rides still to do, plus what you took on the ones already done
function bikeCarbs(date){
  const d=dayOf(date)||{};let g=0;const rows=[];
  for(const p of (d.plan||[]).filter(p=>!p.done&&p.fuel&&isRide(p))){const q=fuelPlanned(p);if(q.intake){g+=q.intake;rows.push({name:p.name||"Ride",g:q.intake,rate:q.rate,min:p.fuel.min,todo:1});}}
  for(const w of (d.workouts||[]).filter(w=>isRide(w)&&w.fuel)){const it=fuelIntake(w,date);if(it.g){g+=it.g;rows.push({name:w.name||"Ride",g:it.g,min:w.fuel.min,src:it.src});}}
  return {g:Math.round(g),rows};
}
let PLAN_DT=null;      // kept for old links
function planView(){
  const t=todayISO(),D=dayPlan(t);
  if(!D) return `<section class="sec first"><p class="notice">Waiting for today's data from Garmin: the plan needs a few days of burn to start.</p></section>`;
  const {tg,K,bike}=D,sel=PSEL();
  const what=!K.train?"Rest day":`${K.long?"Long day":"Training day"} · ${esc(K.tr.names.join(", "))}`;
  const mac=(n,v,col)=>`<div class="mc"><small>${n}</small><b>${Math.round(v)}<u> g</u></b><div class="en-bar"><i style="width:100%;background:${col}"></i></div></div>`;
  const meal=M=>`<div class="pl-m${M.ate?" set":""}"><div class="pl-mh"><i class="ml-i ml-${M.ic}">${MEAL_ICON[M.ic]||""}</i><b>${esc(M.title)}</b><span>${M.ate?`<em class="pl-ate">${M.ate.skip?"skipped":"as eaten"}</em> `:""}${fmtK(Math.round(M.tot.kcal/10)*10)} kcal</span></div>
    ${M.slot==="l"||M.slot==="lc"?`<div class="pl-o pl-lw">${[["0","Canteen"],["1","At home"]].map(([v,n])=>`<button data-lh="${v}" class="${(M.slot==="l")===(v==="1")?"on":""}"><b>${n}</b></button>`).join("")}</div>`:""}
    ${M.parts.map(x=>`<div class="pl-c"><small>${esc(x.role)}</small><div class="pl-o">${x.opts.map((o,oi)=>{const g=oi===x.oi?x.g:null;
      return `<button data-pk="${x.key}" data-oi="${oi}" data-slot="${M.slot}" class="${oi===x.oi?"on":""}${oi===x.oi&&x.eaten?" ate":""}"><b>${esc(o.name)}</b>${oi===x.oi&&x.m.lines.length?`<span>${x.m.lines.map(([k,q])=>(x.m.lines.length>1?FD[k][0].split(" ")[0]+" ":"")+portionTxt(k,q)).join(" + ")}</span>`:oi===x.oi?"":`<span>tap to switch</span>`}</button>`;}).join("")}</div></div>`).join("")}
    ${M.extra.length?`<div class="pl-c"><small>Also eaten</small>${M.extra.map(e=>`<div class="pl-x"><span>${esc(e.name)}${e.g?` · ${Math.round(e.g)} g`:""}</span><b>${fmtK(Math.round(e.kcal))} kcal</b></div>`).join("")}</div>`:""}
    <div class="pl-act"><button data-ate="${M.slot}">${M.ate?"Change what I ate":"I ate something different"}</button></div>
    <p class="pl-n">P ${Math.round(M.tot.p)} · C ${Math.round(M.tot.c)} · F ${Math.round(M.tot.f)} g${M.slot==="pre"?" · skip it and add the same bread or fruit to dinner":M.slot==="d"&&K.train&&!K.we?" · this is also your recovery meal":M.slot==="l"&&K.train&&K.we||M.slot==="lc"&&K.train&&K.we?" · this is also your recovery meal":""}</p></div>`;
  const rideCard=bike.rows.length?`<div class="fuel-c static"><i>${FUEL_IC}</i><div>${bike.rows.map(r=>`<p><b>On the bike · ${esc(r.name)}, ${durTxt(r.min)}</b>${r.todo?`<em>${r.g} g of carbs</em> in the bottle${r.rate?` (${r.rate} g/h${r.rate>60?", glucose + fructose":""})`:""}.`:`${r.g} g taken (${esc(r.src)}).`}</p>`).join("")}</div></div>`:"";
  const after=fuelCard(t,[]);
  const body=D.slots.map(s=>s.ride?(after||rideCard):meal(D.meals.find(m=>m.slot===s[0]))).join("");
  const off=Math.round(D.sum.kcal-D.kcal);
  return `<section class="sec first">
    <button class="pl-head" id="pl-need"><small>TODAY'S NEED</small><b>${fmtK(tg.lo)}–${fmtK(tg.hi)}<u>kcal</u></b><span>${what}</span></button>
    <div class="macros">${mac("PROTEIN",D.P,MAC.p[1])}${mac("CARBS",D.C,MAC.c[1])}${mac("FAT",D.F,MAC.f[1])}</div>
    <p class="pl-fit">${bike.g?`${bike.g} g of the carbs go in the bottle, the rest in the meals. `:""}Pick what you have at home: the grams follow, and dinner closes the day on target${Math.abs(off)>150?` (this mix lands ${fmtK(Math.abs(off))} kcal ${off>0?"over":"under"}: try other options)`:""}.</p>
    ${body}
    ${trendCard()}
    <p class="foot">No diary: weigh in every 3–4 days. If the trend moves faster or slower than your aim, the need changes by itself.</p></section>`;
}
function bindPlan(){
  const t=todayISO(),rr=()=>{const y=scrollY;renderFood();scrollTo(0,y);};
  // first tap picks an option, a tap on the picked one opens its details
  document.querySelectorAll("[data-pk]").forEach(b=>b.onclick=()=>{
    if(b.classList.contains("on")) return openFoodPart(t,b.dataset.slot,b.dataset.pk);
    const a=ateDay(t)[b.dataset.slot];
    if(a){const v={...a,oi:{...(a.oi||{}),[b.dataset.pk]:+b.dataset.oi},g:{...(a.g||{})}};delete v.g[b.dataset.pk];ateSet(t,b.dataset.slot,v);}
    else{const s={...PSEL()};s[b.dataset.pk]=+b.dataset.oi;syncSet("rd_plan_sel",s);}
    buzz(4);rr();});
  document.querySelectorAll("[data-ate]").forEach(b=>b.onclick=()=>openAte(t,b.dataset.ate));
  document.querySelectorAll("[data-lh]").forEach(b=>b.onclick=()=>{lunchSet(t,b.dataset.lh==="1");buzz(4);rr();});
  const n=$("pl-need");if(n) n.onclick=()=>openTarget(t);
}
const findMeal=(date,slot)=>dayPlan(date)?.meals.find(m=>m.slot===slot);
const macLine=m=>`${fmtK(Math.round(m.kcal))} kcal · P ${Math.round(m.p)} · C ${Math.round(m.c)} · F ${Math.round(m.f)} g`;
// details of one option: every ingredient with grams and household portion, its macros, and the amount you really had
function openFoodPart(date,slot,key){
  const M=findMeal(date,slot),x=M&&M.parts.find(y=>y.key===key);if(!x) return;
  const o=x.o,m=x.m,ed=!o.fixed;
  openSheet(`<div class="sh-top"><h2>${esc(o.name)}</h2>${X}</div>
    <p class="sh-desc">${esc(M.title)} · ${esc(x.role.toLowerCase())}${x.eaten?" · as you ate it":""}</p>
    <div class="kv">${m.lines.length?m.lines.map(([k,q])=>`<span>${esc(FD[k][0])}</span><b>${esc(portionTxt(k,q))}</b>`).join(""):"<span>Nothing</span><b>–</b>"}</div>
    <div class="kv"><span>Energy</span><b>${fmtK(Math.round(m.kcal))} kcal</b><span>Protein</span><b>${r1(m.p)} g</b><span>Carbs</span><b>${r1(m.c)} g</b><span>Fat</span><b>${r1(m.f)} g</b></div>
    ${ed?`<h3 class="sh-sub">How much did you have?</h3>
      <div class="ath-log" style="grid-template-columns:1fr auto"><div class="field"><label for="fp-g">${esc(FD[o.parts[0][0]][0])} (g)</label><input id="fp-g" type="number" inputmode="decimal" min="0" step="5" value="${Math.round(x.g)}"></div><button class="btn" id="fp-s">Save</button></div>
      <p class="sh-note" id="fp-k"></p>`:`<p class="sh-note">A fixed amount. If you didn't have it, pick "Nothing", or add what you had with "I ate something different".</p>`}
    ${x.eaten?`<button class="btn quiet" id="fp-r" style="width:100%;margin-top:10px">Back to the plan's amount</button>`:""}`);
  const inp=$("fp-g");
  if(inp){const upd=()=>{const g=+String(inp.value).replace(",",".")||0;$("fp-k").textContent=macLine(optMac(o,g))+(o.parts.length>1?" (the other ingredients follow)":"");};inp.oninput=upd;upd();
    $("fp-s").onclick=()=>{const g=Math.max(0,+String(inp.value).replace(",",".")||0),a=ateDay(date)[slot]||{};
      ateSet(date,slot,{...a,skip:false,g:{...(a.g||{}),[key]:g},oi:{...(a.oi||{}),[key]:x.oi}});buzz(10);closeSheet();render();toast("Saved: dinner adjusts");};}
  const r=$("fp-r");if(r) r.onclick=()=>{const a={...(ateDay(date)[slot]||{})},g={...(a.g||{})};delete g[key];a.g=g;
    ateSet(date,slot,Object.keys(g).length||(a.extra||[]).length||a.skip?a:null);closeSheet();render();};
}
// a meal that went differently: skipped, or extra foods (from the list, or any food with its kcal)
function openAte(date,slot){
  const M=findMeal(date,slot);if(!M) return;
  const a={...(ateDay(date)[slot]||{})},extra=[...(a.extra||[])];
  const keys=Object.keys(FD);let q="";
  const draw=()=>{
    const hits=q.length>1?keys.filter(k=>norm(FD[k][0]+" "+(IT[k]||"")).includes(norm(q))).slice(0,6):[];
    openSheet(`<div class="sh-top"><h2>${esc(M.title)}</h2>${X}</div>
      <p class="sh-desc">To change the grams, tap the food in the plan. Here you add what else you had, or say you skipped it. Dinner takes up the difference.</p>
      ${extra.length?extra.map((e,i)=>`<div class="ent"><span>${esc(e.name)}${e.g?` · ${Math.round(e.g)} g`:""} · ${fmtK(Math.round(e.kcal))} kcal</span><button data-rx="${i}">Remove</button></div>`).join(""):""}
      <div class="field" style="margin-top:12px"><label for="at-q">Add a food</label><input id="at-q" type="text" placeholder="e.g. pane, mozzarella, banana" value="${esc(q)}" autocomplete="off"></div>
      <div id="at-h">${hits.map(k=>`<div class="at-row"><span>${esc(FD[k][0])}</span><input data-hg="${k}" type="number" inputmode="decimal" placeholder="g" value="${FD[k][5]?FD[k][5][0]:100}"><button class="btn quiet" data-ha="${k}">Add</button></div>`).join("")}</div>
      <details class="pl-tips"><summary>Something not in the list</summary>
        <div class="field"><label for="at-n">Name</label><input id="at-n" type="text" placeholder="e.g. slice of cake"></div>
        <div class="ath-log" style="grid-template-columns:repeat(4,1fr)"><div class="field"><label for="at-k">kcal</label><input id="at-k" type="number" inputmode="numeric"></div>
          <div class="field"><label for="at-c">Carbs</label><input id="at-c" type="number" inputmode="numeric"></div><div class="field"><label for="at-p">Prot.</label><input id="at-p" type="number" inputmode="numeric"></div><div class="field"><label for="at-f">Fat</label><input id="at-f" type="number" inputmode="numeric"></div></div>
        <button class="btn quiet" id="at-cu" style="width:100%">Add</button></details>
      <div class="savebar" style="margin-top:20px"><button class="btn quiet" id="at-sk">${a.skip?"I didn't skip it":"Skipped this meal"}</button><button class="btn" id="at-s">Save</button></div>
      ${ateDay(date)[slot]?`<button class="pl-q" id="at-r">Back to the plan for this meal</button>`:""}`);
    const qi=$("at-q");qi.oninput=()=>{q=qi.value;const p=qi.selectionStart;draw();const n=$("at-q");n.focus();n.setSelectionRange(p,p);};
    document.querySelectorAll("[data-ha]").forEach(b=>b.onclick=()=>{const k=b.dataset.ha,g=+String(document.querySelector(`[data-hg="${k}"]`).value).replace(",",".")||0;if(!g) return;
      const F=FD[k];extra.push({name:F[0],g,kcal:F[1]*g/100,p:F[2]*g/100,c:F[3]*g/100,f:F[4]*g/100});q="";buzz(6);draw();});
    document.querySelectorAll("[data-rx]").forEach(b=>b.onclick=()=>{extra.splice(+b.dataset.rx,1);draw();});
    $("at-cu").onclick=()=>{const n=$("at-n").value.trim(),k=+$("at-k").value||0,c=+$("at-c").value||0,p=+$("at-p").value||0,f=+$("at-f").value||0;
      if(!n||!(k||c||p||f)) return toast("Name and kcal");extra.push({name:n,kcal:k||c*4+p*4+f*9,p,c,f});draw();};
    $("at-sk").onclick=()=>{a.skip=!a.skip;ateSet(date,slot,a.skip?{...a,extra:[]}:{...a,skip:false});buzz(8);closeSheet();render();toast(a.skip?"Skipped: the rest of the day adjusts":"Back on");};
    $("at-s").onclick=()=>{ateSet(date,slot,{...a,skip:false,extra});buzz(10);closeSheet();render();toast("Saved: dinner adjusts");};
    const r=$("at-r");if(r) r.onclick=()=>{ateSet(date,slot,null);closeSheet();render();};
  };
  draw();
}
// what a change of the need means at the table: the carb portions of dinner and lunch, before and after
function planShift(step){
  const t=todayISO(),a=dayPlan(t,-step),b=dayPlan(t);if(!a||!b) return [];
  const out=[];
  b.meals.forEach((m,i)=>m.parts.forEach((x,j)=>{const y=a.meals[i]?.parts[j];if(x.solve!=="c"||!y||x.o.fixed) return;
    if(Math.abs(x.g-y.g)>=5) out.push({meal:m.slot,name:x.o.name,a:Math.round(y.g),b:Math.round(x.g)});}));
  return out;
}
// the AI food coach and the old plan are gone: what other files still ask for
const planGet=()=>null,fnAll=()=>[],fnApply=()=>{},genPlan=()=>{},openNotes=()=>goPage("food","plan");
