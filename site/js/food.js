"use strict";
/* ------------------------------------------------------------ steps & calories */
const EN_COL={basal:"#64748b",active_so_far:"#f59e0b",rest_of_day:"#fcd34d",planned:"#fb923c"};
const EN_TXT={basal:"Basal (resting, whole day)",active_so_far:"Active so far",rest_of_day:"Rest of the day, usual pace",planned:"Planned training still to do"};
const fmtK=n=>n==null?"–":Number(n).toLocaleString("en-GB");
const asofTxt=h=>`${String(Math.floor(h)).padStart(2,"0")}:${String(Math.round(h%1*60)).padStart(2,"0")}`;
const STRESS=[[25,"Rest","#60a5fa"],[50,"Low","#fbbf24"],[75,"Medium","#f59e0b"],[100,"High","#f97316"]];
const stressBand=v=>STRESS.find(b=>v<=b[0]);
const EN_KEYS={kcal:["Calories","#f59e0b","kcal"],steps:["Steps","#34d399","steps"],km:["Distance","#2dd4bf","km"],stress:["Stress","#f472b6","avg stress"]};
function yourDay(){
  const E=DATA.energy?.today; if(!E) return "";
  const p=E.parts,tot=E.projected||1,seg=k=>`<i style="width:${p[k]/tot*100}%;background:${EN_COL[k]}"></i>`;
  const sp=E.goal?Math.min(100,E.steps/E.goal*100):0,sb=E.stress!=null?stressBand(E.stress):null;
  return `<section class="sec"><div class="sec-h"><h2>Your day</h2><span>As of ${asofTxt(E.asof)}</span></div>
  <div class="day4">
    <button class="en-c" data-en="kcal"><small>CALORIES</small><b>${fmtK(E.kcal_now)}<u>kcal</u></b>
      <div class="en-bar">${["basal","active_so_far","rest_of_day","planned"].map(seg).join("")}</div>
      <span>${(()=>{const e=foodOn()?ftot(foodDay(todayISO())).kcal:0,t=e?targetOf(todayISO()):null;const st=rangeState(e,t);return e?`Eaten ${fmtK(Math.round(e))}${st?` · ${st.k==="in"?"":fmtK(Math.round(st.n))+" "}${st.txt}`:""}`:`On track for ~${fmtK(E.projected)}`;})()}</span></button>
    <button class="en-c" data-en="steps"><small>STEPS</small><b>${fmtK(E.steps)}</b>
      <div class="en-bar"><i style="width:${sp}%;background:#34d399"></i></div>
      <span>${E.goal?(E.steps>=E.goal?"Goal reached":`${fmtK(E.goal-E.steps)} to ${fmtK(E.goal)}`):`~${fmtK(E.steps_projected)} by tonight`}</span></button>
    <button class="en-c" data-en="km"><small>DISTANCE</small><b>${E.km!=null?E.km.toFixed(1):"–"}<u>km</u></b>
      <div class="en-bar"><i style="width:${E.km&&E.steps_projected?Math.min(100,E.steps/E.steps_projected*100):0}%;background:#2dd4bf"></i></div>
      <span>Estimate, on the safe side</span></button>
    <button class="en-c" data-en="stress"><small>STRESS</small><b>${E.stress??"–"}${sb?`<em style="color:${sb[2]}">${sb[1]}</em>`:""}</b>
      <div class="st-bar">${STRESS.map(b=>`<i class="${sb===b?"on":""}" style="background:${b[2]}"></i>`).join("")}</div>
      <span>${E.stress!=null?"Day average so far":"No data yet"}</span></button>
  </div></section>`;
}
let enPick=null,enKey="kcal";
function enBars(key,n){
  const h=(DATA.energy?.history||[]).slice(-n),W=320,H=120,bw=W/h.length,vals=h.map(d=>d[key]||0),max=Math.max(...vals,1);
  const pick=enPick==null||enPick>=h.length?h.length-1:enPick,col=EN_KEYS[key][1];
  const bars=h.map((d,i)=>{const v=d[key],hh=v?Math.max(3,v/max*H):2;
    return `<rect x="${(i*bw+1.2).toFixed(1)}" y="${(H-hh).toFixed(1)}" width="${(bw-2.4).toFixed(1)}" height="${hh.toFixed(1)}" rx="2" fill="${v?col:"var(--line)"}" opacity="${i===pick?1:.4}"/>
      <rect data-ei="${i}" x="${(i*bw).toFixed(1)}" y="0" width="${bw.toFixed(1)}" height="${H}" fill="transparent" style="cursor:pointer"/>`;}).join("");
  const goal=key==="steps"&&h[pick].goal?`<line x1="0" x2="${W}" y1="${H-h[pick].goal/max*H}" y2="${H-h[pick].goal/max*H}" stroke="var(--muted)" stroke-dasharray="3 4" opacity="${h[pick].goal<=max?.6:0}"/>`:"";
  const pd=h[pick],det=key==="kcal"?(pd.active!=null?`${fmtK(pd.active)} active + ${fmtK(pd.resting)} basal`:""):key==="steps"?(pd.km!=null?pd.km.toFixed(1)+" km":""):key==="km"?(pd.steps?fmtK(pd.steps)+" steps":""):(pd.stress!=null?stressBand(pd.stress)[1]:"");
  return `<div class="readout"><span>${fmtDay(pd.date,{weekday:"short",day:"numeric",month:"short"})}</span><b>${key==="km"&&pd.km!=null?pd.km.toFixed(1):fmtK(pd[key])}</b><em style="color:${col}">${EN_KEYS[key][2]}</em><span style="margin-left:auto">${esc(det)}</span></div>
    <div class="sh-chart bars30"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${goal}${bars}</svg>
    <div class="ax"><span>${fmtDay(h[0].date,{day:"numeric",month:"short"})}</span><span>${fmtDay(h[h.length-1].date,{day:"numeric",month:"short"})}</span></div></div>`;
}
function openEnergy(n=7,keep=false){
  if(!keep) enPick=null;
  const E=DATA.energy?.today; if(!E) return;
  const y=$("sheet").scrollTop,p=E.parts;
  openSheet(`<div class="sh-top"><h2>Your day</h2>${X}</div>
    <div class="sh-big" style="color:#f59e0b">~${fmtK(E.projected)}<small>kcal by tonight</small></div>
    <p class="sh-desc">${fmtK(E.kcal_now)} kcal burned so far (data at ${asofTxt(E.asof)}). The projection adds your full-day basal burn, the rest of the day at your usual pace outside workouts${E.planned_names.length?` and ${esc(E.planned_names.join(", "))} at your usual cost for that sport`:""}. It updates every 10 minutes as the day goes.</p>
    <div class="en-bar" style="height:10px">${["basal","active_so_far","rest_of_day","planned"].map(k=>`<i style="width:${p[k]/(E.projected||1)*100}%;background:${EN_COL[k]}"></i>`).join("")}</div>
    <div class="en-parts">${["basal","active_so_far","rest_of_day","planned"].filter(k=>p[k]>0).map(k=>`<div><i style="background:${EN_COL[k]}"></i><span>${EN_TXT[k]}</span><b>${fmtK(p[k])}</b></div>`).join("")}</div>
    <div class="kv"><span>Steps</span><b>${fmtK(E.steps)}${E.goal?` / ${fmtK(E.goal)}`:""}</b><span>Steps by tonight, at your usual pace</span><b>~${fmtK(E.steps_projected)}</b>${E.km!=null?`<span>Distance (estimate)</span><b>${E.km.toFixed(1)} km</b>`:""}${E.km_garmin?`<span>Garmin's figure</span><b>${E.km_garmin} km</b>`:""}${E.stress!=null?`<span>Stress, day average</span><b>${E.stress} · ${stressBand(E.stress)[1]}</b>`:""}</div>
    <p class="sh-note">Distance: GPS distance of runs and walks you record, plus the other steps × ${E.stride} m, your walking step length${E.height_known?" from your height":" (add your height in Athlete for a better one)"} shortened a little, since steps around the house are shorter than a real stride. When Garmin's own figure is lower, the lower one is kept, so it errs on the short side.</p>
    <div class="range">${Object.entries(EN_KEYS).map(([k,v])=>`<button data-k="${k}" class="${enKey===k?"on":""}">${v[0]}</button>`).join("")}</div>
    <div class="range" style="margin-top:8px"><button data-n="7" class="${n===7?"on":""}">7 days</button><button data-n="30" class="${n===30?"on":""}">30 days</button></div>
    ${enBars(enKey,n)}`);
  if(keep) $("sheet").scrollTop=y;
  $("sheet").querySelectorAll(".range button[data-n]").forEach(b=>b.onclick=()=>openEnergy(+b.dataset.n,true));
  $("sheet").querySelectorAll(".range button[data-k]").forEach(b=>b.onclick=()=>{enKey=b.dataset.k;openEnergy(n,true);});
  $("sheet").querySelectorAll("rect[data-ei]").forEach(r=>r.onclick=()=>{enPick=+r.dataset.ei;openEnergy(n,true);});
}

/* ------------------------------------------------------------ food: reference table */
// Common foods and Italian dishes, values per 100 g (raw or dry unless the name says otherwise), from the
// Italian CREA tables, USDA and typical recipes. Columns: name | other names to search by | kcal | protein | carbs | fat | unit | unit grams
const FOOD_REF=`
Pasta, dry|pasta secca spaghetti penne fusilli rigatoni|353|12.5|71|1.5|portion|80
Pasta, cooked|pasta cotta|158|5.8|31|0.9
Whole-wheat pasta, dry|pasta integrale|340|13|64|2.5|portion|80
Rice, dry|riso|350|7|79|0.6|portion|80
Rice, cooked|riso cotto|130|2.7|28|0.3
Basmati rice, dry|riso basmati|355|8|78|0.9|portion|80
Brown rice, dry|riso integrale|360|7.5|76|2.7|portion|80
Couscous, dry|cous cous couscous|360|12.5|72|1.1|portion|80
Quinoa, dry|quinoa|368|14|64|6|portion|70
Oats|avena fiocchi d'avena porridge|372|13|60|7|portion|50
Bread|pane comune rosetta baguette|270|8.5|55|1.3|slice|30
Whole-wheat bread|pane integrale|245|9|46|2.5|slice|30
Sandwich bread|pan carrè pancarrè pane in cassetta toast|265|8|48|4|slice|25
Crackers|cracker salati|430|10|70|11|pack|25
Rusks|fette biscottate|410|11|73|7|rusk|10
Breadsticks|grissini|420|12|68|10|breadstick|6
Rice cakes|gallette di riso|385|8|81|3|cake|8
Piadina|piadina romagnola|320|8|50|9.5|piadina|120
Pizza margherita|pizza margherita|250|10|32|8.5|pizza|330
Focaccia|focaccia|300|7|45|10|slice|80
Potatoes|patate|77|2|17|0.1|potato|150
Sweet potato|patata dolce patate americane|86|1.6|20|0.1|potato|150
Potato gnocchi|gnocchi di patate|160|4|34|0.5|portion|150
Polenta, cooked|polenta|70|1.6|15|0.3
Flour|farina 00|345|11|73|1.2
Corn flakes|cornflakes cereali|378|7|84|0.9|bowl|30
Muesli|muesli|370|10|62|7|bowl|40
Granola|granola|450|10|60|18|bowl|40
Croissant|cornetto brioche|400|8|45|21|croissant|60
Biscuits|biscotti frollini|460|7|70|17|biscuit|10
Chicken breast|petto di pollo|110|23|0|1.2|breast|150
Chicken thigh|cosce di pollo sovracosce|170|18|0|11
Turkey breast|petto di tacchino fesa|107|24|0|1
Lean beef|manzo magro bistecca vitello|130|21|0|5
Minced beef|macinato carne macinata hamburger|210|19|0|15|burger|100
Pork loin|lonza maiale braciola|150|21|0|7
Salmon|salmone|185|20|0|12|fillet|125
Tuna in water, drained|tonno al naturale|105|25|0|1|can|56
Tuna in oil, drained|tonno sott'olio|190|25|0|10|can|52
Cod|merluzzo baccalà|80|18|0|0.7
Sea bass|branzino spigola orata|97|18|0|2.5
Shrimp|gamberi gamberetti|85|18|0|1
Eggs|uova uovo|143|12.5|0.7|10|egg|55
Egg whites|albume albumi|48|10.5|0.7|0.2
Boiled eggs|uova sode uovo sodo uovo alla coque|155|13|1|11|egg|50
Scrambled eggs|uova strapazzate|165|11|1.5|13|portion|120
Taleggio|taleggio|315|19|0|26|portion|50
Omelette with cheese|omelette al formaggio frittata al formaggio|210|14|1|17|portion|150
Prosciutto crudo|prosciutto crudo parma|250|26|0|16|slice|15
Prosciutto cotto|prosciutto cotto|140|20|1|6|slice|20
Bresaola|bresaola|155|33|0|2|slice|10
Sliced turkey|fesa di tacchino affettata|100|20|1.5|1.5|slice|15
Mortadella|mortadella|290|15|1|25|slice|20
Salami|salame|400|25|1|33|slice|8
Tofu|tofu|120|13|2|7
Chickpeas, cooked|ceci|120|7|16|2.4|can|240
Lentils, cooked|lenticchie|116|9|20|0.4
Lentils, dry|lenticchie secche|325|24|52|1.5
Beans, cooked|fagioli borlotti cannellini|110|7.5|18|0.5|can|240
Peas|piselli|70|5|10|0.4
Whole milk|latte intero|64|3.3|4.9|3.6|glass|200
Semi-skimmed milk|latte parzialmente scremato|46|3.4|4.9|1.6|glass|200
Skimmed milk|latte scremato|35|3.4|5|0.2|glass|200
Plain yogurt|yogurt bianco intero|66|3.8|4.7|3.5|pot|125
Greek yogurt 0%|yogurt greco magro 0|57|10|4|0.2|pot|170
Greek yogurt, full fat|yogurt greco intero|97|9|4|5|pot|150
Skyr|skyr|63|11|4|0.2|pot|150
Mozzarella|mozzarella fior di latte|250|18.7|0.7|19.5|ball|125
Light mozzarella|mozzarella light|165|20|1|9|ball|125
Parmigiano|parmigiano grana padano reggiano|395|33|0|28|tablespoon|5
Pecorino|pecorino|390|26|0|32
Ricotta|ricotta|145|9.5|3.5|10.5
Cottage cheese|fiocchi di latte cottage|100|12|3|4.5|pot|150
Stracchino|stracchino crescenza|280|17|1|23
Cheese slices|sottilette formaggio a fette|270|14|6|21|slice|20
Butter|burro|740|0.8|0.6|82|teaspoon|5
Whey protein|proteine in polvere whey|380|78|7|5|scoop|30
Olive oil|olio d'oliva olio evo extravergine|899|0|0|99.9|tablespoon|10
Peanut butter|burro di arachidi|600|25|15|50|tablespoon|15
Almonds|mandorle|603|22|4.6|55|handful|30
Walnuts|noci|689|14.3|5.1|68|handful|30
Hazelnuts|nocciole|655|14|6|64|handful|30
Peanuts|arachidi noccioline|600|26|8|50|handful|30
Dark chocolate 70%|cioccolato fondente|590|8|34|43|square|10
Milk chocolate|cioccolato al latte|545|7.5|55|32|square|10
Nutella|nutella crema spalmabile nocciole|539|6.3|57.5|30.9|tablespoon|15
Avocado|avocado|160|2|2|15|half|80
Mayonnaise|maionese|680|1|1.5|75|tablespoon|15
Pesto|pesto genovese|480|5|5|48|tablespoon|15
Hummus|hummus|250|7|14|18|tablespoon|20
Apple|mela|52|0.3|12|0.2|apple|180
Banana|banana|89|1.1|21|0.3|banana|120
Orange|arancia|47|0.9|11|0.1|orange|150
Mandarin|mandarino clementina|53|0.8|12|0.3|mandarin|70
Pear|pera|57|0.4|13|0.1|pear|170
Kiwi|kiwi|61|1.1|13|0.5|kiwi|75
Grapes|uva|69|0.7|17|0.2
Strawberries|fragole|32|0.7|7|0.3
Blueberries|mirtilli|57|0.7|13|0.3
Peach|pesca|39|0.9|9|0.3|peach|150
Apricot|albicocca albicocche|48|1.4|10|0.4|apricot|40
Cherries|ciliegie|63|1|15|0.2
Pineapple|ananas|50|0.5|12|0.1
Watermelon|anguria cocomero|30|0.6|7.5|0.2
Melon|melone|34|0.8|8|0.2
Dates|datteri|280|2.5|67|0.4|date|8
Raisins|uvetta uva passa|300|3|72|0.5
Dried apricots|albicocche secche|240|3.4|55|0.5
Fruit juice|succo di frutta spremuta|45|0.3|11|0|glass|200
Jam|marmellata confettura|250|0.4|62|0.1|tablespoon|15
Honey|miele|304|0.3|82|0|teaspoon|7
Sugar|zucchero|400|0|100|0|teaspoon|5
Mixed salad|insalata lattuga rucola valeriana|15|1.3|2|0.2|bowl|80
Tomatoes|pomodori pomodorini|18|0.9|3.5|0.2|tomato|120
Tomato passata|passata di pomodoro sugo polpa|30|1.4|5|0.2
Carrots|carote|41|0.9|9|0.2|carrot|80
Zucchini|zucchine|17|1.2|3|0.3
Broccoli|broccoli|34|2.8|4.4|0.4
Spinach|spinaci|23|2.9|1.4|0.4
Peppers|peperoni|26|1|5|0.3
Aubergine|melanzane|24|1|3.5|0.2
Green beans|fagiolini|31|1.8|5|0.2
Mushrooms|funghi champignon|22|3|2|0.3
Onion|cipolla|40|1.1|9|0.1
Cucumber|cetrioli cetriolo|15|0.7|3|0.1
Fennel|finocchio finocchi|20|1.2|3|0.2
Cauliflower|cavolfiore|25|1.9|3|0.3
Pumpkin|zucca|26|1|6|0.1
Sweetcorn, canned|mais|85|2.9|15|1.2
Frozen mixed vegetables|verdure miste minestrone surgelato|40|2.5|6|0.5
Lasagne|lasagne|160|8|15|7.5
Sushi|sushi nigiri maki|150|6|28|1.5|piece|30
Ice cream|gelato|210|3.7|25|10|scoop|70
Espresso|caffè espresso|2|0.1|0.3|0|cup|30
Cappuccino|cappuccino|40|2.2|3.3|2|cup|150
Beer|birra|43|0.5|3.6|0|bottle|330
Red wine|vino rosso|85|0.1|2.6|0|glass|125
White wine|vino bianco|80|0.1|2.6|0|glass|125
Cola|coca cola|42|0|10.6|0|can|330
Sports drink|sali minerali isotonico sport drink|25|0|6|0|bottle|500
Energy gel|gel energetico|270|0|67|0|gel|40
Energy bar|barretta energetica|370|8|65|8|bar|40
Protein bar|barretta proteica|370|32|35|12|bar|55
Almond drink|bevanda alla mandorla latte di mandorla|24|0.5|3|1.1|glass|200
Soy drink|bevanda di soia latte di soia|40|3.3|2.5|1.8|glass|200
Crostata (jam tart)|crostata di marmellata confettura jam tart|400|5|62|15|slice|80
Crostata alla Nutella|crostata alla nutella cioccolato nutella tart|450|6|58|22|slice|80
Fruit tart (crostata di frutta)|crostata di frutta crema|260|4|36|11|slice|100
Sponge cake|torta margherita pan di spagna torta paradiso|370|7|58|12|slice|60
Ring cake (ciambella, ciambellone)|ciambella ciambellone al forno torta yogurt|380|6.5|55|15|slice|60
Apple cake|torta di mele|250|3.5|38|9.5|slice|100
Chocolate cake|torta al cioccolato tenerina sacher|420|6|50|22|slice|80
Tiramisù|tiramisu|290|6|30|16|portion|120
Panna cotta|panna cotta|230|3|25|13|portion|120
Cheesecake|cheesecake|320|6|28|21|slice|100
Apple strudel|strudel|260|3|37|11|slice|100
Panettone|panettone|360|7|52|14|slice|80
Pandoro|pandoro|410|8|50|20|slice|80
Colomba|colomba pasquale|400|7|55|17|slice|80
Cannolo|cannolo siciliano cannoli|380|7|42|20|piece|100
Doughnut (bombolone)|bombolone krapfen ciambella fritta donut|400|6|45|22|piece|70
Muffin|muffin|400|5|52|19|muffin|80
Plumcake|plumcake plum cake|400|6|55|17|piece|35
Snack cake|merendina merendine flauto|420|6|58|18|piece|35
Wafer|wafer|520|6|62|27|pack|45
Cream croissant|cornetto alla crema brioche crema|380|7|46|18|croissant|80
Jam croissant|cornetto alla marmellata brioche marmellata|370|6|52|15|croissant|80
Whole-wheat croissant|cornetto integrale brioche integrale|360|8|48|15|croissant|70
Pain au chocolat|saccottino al cioccolato|420|7|45|23|piece|70
Sfogliatella|sfogliatella|360|7|45|17|piece|100
Maritozzo|maritozzo con panna|380|6|40|22|piece|120
Whole-wheat biscuits|biscotti integrali|450|8|65|17|biscuit|10
Dry biscuits|biscotti secchi oro saiwa|420|8|77|9|biscuit|6
Chocolate biscuits|biscotti al cioccolato pan di stelle gocciole|490|7|66|22|biscuit|10
Ladyfingers|savoiardi|390|8|80|4|piece|8
Amaretti|amaretti|450|8|75|13|piece|6
Cantucci|cantucci cantuccini|430|10|65|14|piece|10
Sorbet|sorbetto|130|0.5|32|0.2|scoop|70
Hot chocolate|cioccolata calda|110|3.5|15|4|cup|200
Whipped cream|panna montata|320|2|13|29|tablespoon|15
Custard|crema pasticcera|170|4|25|6|tablespoon|30
Nougat|torrone|450|9|60|20|piece|25
Sweets|caramelle|390|0|97|0|piece|5
Chocolate bar|barretta di cioccolato snickers mars|490|9|58|24|bar|50
Chocolate wafer bar|kinder bueno barretta wafer cioccolato|560|8|50|37|bar|22
Pancakes|pancake|230|6|30|9|pancake|40
Waffle|waffle|290|7|38|12|waffle|50
Crêpe|crepe crespella|220|7|28|9|crepe|60
Spaghetti with tomato sauce|spaghetti al pomodoro pasta al sugo|130|4.5|22|3|plate|300
Pasta with ragù|pasta al ragu bolognese tagliatelle al ragu|160|7|21|5.5|plate|300
Carbonara|pasta alla carbonara spaghetti carbonara|220|9.5|23|10|plate|300
Amatriciana|pasta all'amatriciana|180|6|23|7|plate|300
Cacio e pepe|cacio e pepe|230|9|27|10|plate|280
Pasta with pesto|pasta al pesto trofie al pesto|210|6|25|10|plate|300
Arrabbiata|penne all'arrabbiata|140|4.5|24|3|plate|300
Pasta with tuna|pasta al tonno|170|9|22|5|plate|300
Spaghetti with clams|spaghetti alle vongole|150|8|22|3.5|plate|300
Pasta salad|insalata di pasta pasta fredda|170|6|24|6|plate|300
Pasta and beans|pasta e fagioli|110|5|16|2.5|bowl|350
Pasta and chickpeas|pasta e ceci|120|5|17|3|bowl|350
Cannelloni|cannelloni|160|7.5|15|8|piece|120
Tortellini, fresh|tortellini freschi cappelletti|300|12|45|8|portion|125
Tortellini in broth|tortellini in brodo|75|3.5|10|2.2|bowl|350
Ravioli, fresh|ravioli ricotta e spinaci freschi|260|10|37|8|portion|125
Egg pasta, dry|pasta all'uovo secca tagliatelle|370|14|68|4|portion|80
Fresh egg pasta|pasta fresca all'uovo|290|11|51|3.5|portion|125
Gnocchi with tomato|gnocchi al pomodoro|120|3|23|2|plate|300
Risotto|risotto alla parmigiana risotto bianco|160|4|25|4.5|plate|300
Mushroom risotto|risotto ai funghi|150|4|24|4|plate|300
Saffron risotto|risotto alla milanese zafferano|165|4|25|5|plate|300
Rice with oil and parmesan|riso in bianco|160|4|27|4|plate|250
Paella|paella|160|8|20|5|plate|350
Minestrone soup|minestrone zuppa di verdure|50|2|8|1|bowl|350
Vegetable purée soup|passato di verdure vellutata crema di verdure|40|1.5|6|1|bowl|300
Legume soup|zuppa di legumi zuppa di lenticchie|90|5|13|2|bowl|350
Broth|brodo vegetale brodo di carne|10|1|0.5|0.5|bowl|300
Pizza marinara|pizza marinara|220|6|35|6|pizza|300
Pizza diavola|pizza diavola salame piccante|270|11|30|11.5|pizza|350
Pizza capricciosa|pizza capricciosa|250|11|29|10|pizza|380
Four cheese pizza|pizza quattro formaggi|290|13|29|13.5|pizza|350
Pizza by the slice|pizza al taglio trancio|270|9|36|10|slice|150
Calzone|calzone|270|11|30|12|calzone|300
Panzerotto|panzerotto fritto|300|10|30|15|piece|150
Filled piadina|piadina farcita prosciutto squacquerone|290|12|30|13|piadina|250
Tramezzino|tramezzino|270|9|25|15|piece|100
Ham sandwich|panino al prosciutto|260|13|32|8|sandwich|150
Ham and cheese toast|toast prosciutto e formaggio|280|14|27|13|toast|110
Hamburger (fast food)|hamburger panino mcdonald's|250|13|27|10|burger|220
Cheeseburger|cheeseburger|265|14|26|12|burger|120
French fries|patatine fritte patate fritte|310|3.5|40|15|portion|110
Chicken nuggets|chicken nuggets crocchette di pollo|280|15|17|17|nugget|18
Kebab|kebab piadina kebab|220|12|20|10|kebab|350
Hot dog|hot dog|250|10|22|14|hot dog|130
Arancino|arancino arancina|250|7|30|11|piece|180
Supplì|suppli|240|7|28|11|piece|100
Potato croquettes|crocchette di patate|210|4|22|12|piece|40
Olive ascolane|olive ascolane|290|9|20|19|piece|15
Frittata|frittata omelette|160|11|1.5|12|portion|150
Fried egg|uovo fritto uova al tegamino|200|13.5|0.8|15.5|egg|50
Aubergine parmigiana|parmigiana di melanzane|160|7|7|11.5|portion|250
Grilled vegetables|verdure grigliate melanzane grigliate zucchine grigliate|60|1.5|5|4|portion|150
Caprese salad|insalata caprese|200|11|3|16|plate|200
Rice salad|insalata di riso|170|6|25|5.5|plate|300
Chicken salad bowl|insalatona insalata con pollo|110|9|4|6.5|bowl|300
Meatballs in sauce|polpette al sugo|190|13|6|13|meatball|40
Breaded cutlet|cotoletta alla milanese cotoletta impanata|260|18|14|15|cutlet|150
Roast chicken|pollo arrosto|200|27|0|10|portion|200
Grilled chicken|pollo alla griglia petto di pollo cotto|150|30|0|3|portion|150
Breaded chicken|petto di pollo impanato|230|19|13|11|piece|120
Escalopes|scaloppine|180|20|5|9|portion|150
Porchetta|porchetta arista arrosto di maiale|270|25|0|19|slice|50
Steak, cooked|bistecca tagliata manzo cotto|190|28|0|8.5|steak|200
Sausage|salsiccia|300|15|1|26|sausage|100
Frankfurter|wurstel|270|12|3|23|piece|50
Beef burger, cooked|hamburger di manzo cotto|250|25|0|16|burger|100
Smoked salmon|salmone affumicato|175|25|0|8.5|pack|100
Swordfish|pesce spada|120|19|0|4.5|steak|150
Octopus|polpo|80|15|2|1|portion|200
Squid|calamari totani|90|16|3|1.5|portion|150
Fried seafood|frittura di pesce calamari fritti fritto misto|250|14|15|15|portion|200
Mussels|cozze|85|12|3.5|2.5|portion|200
Mackerel|sgombro|200|19|0|14|can|125
Sardines in oil|sardine sott'olio|210|24|0|12|can|85
Marinated anchovies|alici marinate acciughe|130|17|1|6|portion|80
Fish fingers|bastoncini di pesce|230|13|20|11|finger|25
Poke bowl|poke bowl|150|8|20|4|bowl|400
Speck|speck|300|28|0|20|slice|10
Coppa|coppa capocollo|400|24|0|33|slice|10
Pancetta|pancetta|400|15|0|38|slice|10
Guanciale|guanciale|650|10|0|68|slice|10
Bacon, cooked|bacon|540|37|1.4|42|slice|8
Gorgonzola|gorgonzola|330|19|0|28|portion|50
Fontina|fontina|340|24|0|27|slice|20
Emmental|emmental groviera gruyere|380|28|0|30|slice|20
Scamorza|scamorza provola|310|25|1|23|slice|20
Asiago|asiago|360|30|0|27|slice|20
Feta|feta|265|14|4|21|portion|50
Brie|brie camembert|320|20|0.5|27|portion|30
Cream cheese|philadelphia formaggio spalmabile|250|5.5|4|23|tablespoon|20
Light cream cheese|formaggio spalmabile light philadelphia light|150|9|5|11|tablespoon|20
Burrata|burrata|300|14|1|27|burrata|125
Mascarpone|mascarpone|450|4.5|4|47|tablespoon|20
Squacquerone|squacquerone|230|14|2|19|portion|50
Robiola|robiola|280|16|2|23|portion|50
Edam|edamer edam|330|25|1|26|slice|20
Primo sale|primo sale|260|18|2|20|portion|50
Kefir|kefir|55|3.5|4.5|2.5|glass|200
Fruit yogurt|yogurt alla frutta|95|3.5|14|2.5|pot|125
Low-fat yogurt|yogurt magro|45|4.5|5.5|0.2|pot|125
Soy yogurt|yogurt di soia|50|4|2.5|2.2|pot|125
Cooking cream|panna da cucina|210|2.5|4|20|tablespoon|15
Rye bread|pane di segale|230|7|44|1.5|slice|30
Multigrain bread|pane ai cereali|260|10|45|4.5|slice|30
Bagel|bagel|260|10|50|1.5|bagel|90
Tortilla wrap|piadina wrap tortilla|300|8|50|7.5|wrap|60
Burger bun|panino hamburger pane per hamburger|280|9|50|4.5|bun|60
Bread roll|panino rosetta michetta|290|9|57|3|roll|60
Taralli|taralli|470|10|65|19|tarallo|5
Friselle|friselle|380|11|75|3|frisella|30
Cereal bar|barretta ai cereali|400|6|70|11|bar|25
Chocolate cereals|cereali al cioccolato|390|8|77|5|bowl|30
Bran cereal|crusca all bran fibra|330|14|48|3.5|bowl|40
Special K-style cereal|cereali special k fitness|370|9|77|1.5|bowl|30
Puffed rice|riso soffiato|380|7|85|1|bowl|30
Spelt, dry|farro|340|15|67|2.5|portion|80
Pearl barley, dry|orzo perlato|350|10|73|1.5|portion|80
Bulgur, dry|bulgur|340|12|69|1.5|portion|80
Buckwheat, dry|grano saraceno|340|13|71|3.4|portion|80
Instant noodles|noodles ramen istantanei|440|9|60|17|pack|75
Roast potatoes|patate al forno|150|2.5|22|6|portion|200
Mashed potatoes|purè di patate pure|100|2|14|4.2|portion|200
Popcorn|popcorn pop corn|380|12|62|4.5|bowl|30
Crisps|patatine chips san carlo|540|6|50|34|bag|25
Corn cakes|gallette di mais|380|8|80|2.5|cake|8
Chickpeas, dry|ceci secchi|334|21|47|6.3|portion|60
Beans, dry|fagioli secchi|310|22|48|2|portion|60
Edamame|edamame|120|11|7|5|bowl|100
Lupini beans|lupini|115|16|7|2.5|handful|50
Broad beans|fave|70|5|5|0.4|portion|150
Veggie burger|burger vegetale hamburger vegano|200|15|10|11|burger|100
Seitan|seitan|140|25|4|2.5|portion|100
Tempeh|tempeh|190|19|9|11|portion|100
Falafel|falafel|330|13|32|18|falafel|17
Figs|fichi|74|0.8|19|0.3|fig|50
Plums|prugne susine|46|0.7|11|0.3|plum|40
Prunes|prugne secche|240|2.2|58|0.4|prune|8
Dried figs|fichi secchi|250|3.3|58|1|fig|20
Mango|mango|60|0.8|15|0.4|mango|300
Pomegranate|melograno|75|1.5|17|1|portion|100
Raspberries|lamponi|34|1.2|6|0.7|punnet|125
Blackberries|more|36|1.4|6|0.5|punnet|125
Mixed berries|frutti di bosco|40|1|8|0.4|portion|100
Grapefruit|pompelmo|42|0.8|10|0.1|grapefruit|250
Chestnuts, roasted|castagne caldarroste|200|3|42|2|chestnut|10
Coconut|cocco noce di cocco|354|3.3|6.2|33|piece|40
Persimmon|cachi kaki|70|0.6|16|0.2|persimmon|200
Fruit salad|macedonia|55|0.5|13|0.1|bowl|150
Fruit smoothie|smoothie frullato|55|0.7|13|0.2|bottle|250
Pistachios|pistacchi|570|20|17|46|handful|30
Cashews|anacardi|590|18|30|46|handful|30
Chia seeds|semi di chia|490|17|8|31|tablespoon|10
Sunflower seeds|semi di girasole|580|21|11|51|tablespoon|10
Pumpkin seeds|semi di zucca|560|30|5|49|tablespoon|10
Flaxseeds|semi di lino|530|18|2|42|tablespoon|10
Almond butter|burro di mandorle crema di mandorle|610|21|9|55|tablespoon|15
Mixed nuts|frutta secca mista|600|18|15|52|handful|30
Pine nuts|pinoli|670|14|4|68|tablespoon|10
Asparagus|asparagi|22|2.4|2.5|0.2|portion|150
Cabbage|cavolo verza cappuccio|25|2|3|0.1|portion|150
Brussels sprouts|cavolini di bruxelles|43|3.4|5|0.3|portion|150
Artichokes|carciofi|30|3|3|0.2|artichoke|100
Beetroot|barbabietola rape rosse|43|1.6|8|0.2|portion|100
Celery|sedano|15|0.7|2|0.2|stalk|40
Radicchio|radicchio|20|1.4|3|0.2|portion|100
Chard|bietole erbette|20|1.8|2.8|0.2|portion|200
Turnip tops|cime di rapa friarielli|25|3|2|0.3|portion|200
Leeks|porri|35|1.5|7|0.3|leek|100
Olives|olive|145|1|1|15|olive|4
Ketchup|ketchup|110|1.2|25|0.2|tablespoon|15
Mustard|senape|66|4|5|3.5|teaspoon|5
Balsamic vinegar|aceto balsamico|100|0.5|22|0|tablespoon|10
Soy sauce|salsa di soia|55|8|5|0.1|tablespoon|15
Ragù sauce|ragu sugo pronto alla bolognese|100|6|5|6|tablespoon|30
Béchamel|besciamella|130|4|10|8|tablespoon|30
Seed oil|olio di semi girasole|899|0|0|99.9|tablespoon|10
Maple syrup|sciroppo d'acero|260|0|67|0|tablespoon|20
Cocoa powder|cacao amaro in polvere|360|20|11|21|teaspoon|5
Oat drink|bevanda d'avena latte di avena|45|0.5|7|1.5|glass|200
Rice drink|bevanda di riso latte di riso|50|0.3|10|1|glass|200
Chocolate milk|latte al cioccolato|75|3.3|10|2|glass|250
Iced tea|tè freddo estathe|30|0|7.5|0|bottle|500
Energy drink|red bull energy drink|46|0|11|0|can|250
Cola zero|coca zero coca cola zero|0.4|0|0|0|can|330
Tonic water|acqua tonica|35|0|8.5|0|can|200
Alcohol-free beer|birra analcolica|25|0.3|5.5|0|bottle|330
Prosecco|prosecco spumante|75|0.1|1.5|0|glass|125
Spritz|aperol spritz spritz|75|0|8|0|glass|200
Gin and tonic|gin tonic|70|0|6|0|glass|250
Protein shake, ready|frullato proteico shake proteico|60|10|4|0.5|bottle|330
Maltodextrin|maltodestrine carboidrati in polvere|380|0|95|0|scoop|50
Energy chews|gommose energetiche chews|330|0|80|0|pack|60
Burrito|burrito|200|9|24|7|burrito|350
Pad thai|pad thai|180|7|25|6|plate|350
Cantonese rice|riso cantonese riso alla cantonese|165|5|25|5|plate|300
Spring rolls|involtini primavera|230|5|25|12|roll|60
Dumplings|ravioli al vapore ravioli cinesi gyoza|180|8|25|5|dumpling|25
`.trim().split("\n").map(l=>{const a=l.split("|");return {name:a[0],alias:a[1]||"",k:+a[2],p:+a[3],c:+a[4],f:+a[5],unit:a[6]?[a[6],+a[7]]:null,src:"ref"};});

const MEALS=[["b","Breakfast"],["l","Lunch"],["d","Dinner"],["s","Snacks"]];
const MEAL_NAME=Object.fromEntries(MEALS),MEAL_TAG={b:"B'fast",l:"Lunch",d:"Dinner",s:"Snack"};
const KCAL_KG=7700;
// Detailed nutrients: [key, name, unit, daily reference (adult man, EU/EFSA), kind, group].
// "limit" = stay under it, "target" = aim to reach it, "info" = no reference.
const NUT=[["sugars","of which sugars","g",90,"limit","c"],["fiber","Fibre","g",30,"target","c"],
  ["satfat","Saturated","g",null,"limit","f"],["monofat","Monounsaturated","g",null,"info","f"],["polyfat","Polyunsaturated","g",null,"info","f"],["chol","Cholesterol","mg",300,"limit","f"],
  ["sodium","Sodium","mg",2000,"limit","m"],["potassium","Potassium","mg",3500,"target","m"],["calcium","Calcium","mg",1000,"target","m"],["iron","Iron","mg",11,"target","m"],["magnesium","Magnesium","mg",350,"target","m"],["zinc","Zinc","mg",11,"target","m"],
  ["vita","Vitamin A","µg",750,"target","v"],["vitc","Vitamin C","mg",110,"target","v"],["vitd","Vitamin D","µg",15,"target","v"],["vite","Vitamin E","mg",13,"target","v"],["b12","Vitamin B12","µg",4,"target","v"],["folate","Folate","µg",330,"target","v"]];
const NUT_KEYS=NUT.map(x=>x[0]);
const nRound=v=>v>=100?Math.round(v):v>=10?Math.round(v*10)/10:Math.round(v*100)/100;
function scaleN(n,k){if(!n) return null;const o={};for(const key of NUT_KEYS) if(n[key]!=null&&isFinite(n[key])) o[key]=nRound(n[key]*k);return Object.keys(o).length?o:null;}
const NUT_JSON=`"nutrients":{"sugars":g,"fiber":g,"satfat":g,"monofat":g,"polyfat":g,"chol":mg,"sodium":mg,"potassium":mg,"calcium":mg,"iron":mg,"magnesium":mg,"zinc":mg,"vita":µg RAE,"vitc":mg,"vitd":µg,"vite":mg,"b12":µg,"folate":µg} for the portion`;
const MAC={p:["Protein","#f07a8c"],c:["Carbs","#6fd3e6"],f:["Fat","#d9c46a"]};
const norm=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const r1=v=>Math.round(v*10)/10;
const isoAdd=(iso,k)=>{const d=new Date(iso+"T12:00");d.setDate(d.getDate()+k);return d.toLocaleDateString("sv-SE");};
let foodSel=null;

/* ------------------------------------------------------------ food: diary storage */
// Each entry travels on its own (add, edit, delete as a tombstone) and the newest copy wins,
// so the phone and the server can't overwrite each other's changes.
// The merged list of each day is worked out once and reused until something changes: the balance and the
// calibration read up to 120 days at a time, and re-reading the phone's storage for each one made those pages slow.
let FOOD_L=null,FOOD_D=new Map(),FOOD_S=new Map(),DAY_MAP=null;
function foodReset(){FOOD_L=null;FOOD_D.clear();FOOD_S.clear();DAY_MAP=null;}
function foodLocal(){return FOOD_L||(FOOD_L=lsJSON("rd_food",{}));}
function foodSave(item){
  if(item.n100&&item.name&&!item.del) nCacheSet(item.name,item.n100);
  const L=lsJSON("rd_food",{}),lim=isoAdd(todayISO(),-21);
  (L[item.date]=L[item.date]||{})[item.id]=item;
  for(const d of Object.keys(L)) if(d<lim) delete L[d];
  LS.set("rd_food",JSON.stringify(L));
  foodReset();
  sendQ("food",item);
}
function foodDay(date){
  const hit=FOOD_D.get(date); if(hit) return hit;
  const m={...foodStored(date)};
  for(const it of fuelItems(date)) if(!m[it.id]) m[it.id]=it;       // automatic ride fuel, unless you edited or removed it
  const out=Object.values(m).filter(x=>!x.del).sort((a,b)=>(a.at||a.ts)-(b.at||b.ts));
  FOOD_D.set(date,out); return out;
}
// what is saved for a day (server and this device, newest copy of each entry, deletions included)
function foodStored(date){
  const hit=FOOD_S.get(date); if(hit) return hit;
  const m={};
  for(const it of (DATA.nutrition?.food||{})[date]||[]) m[it.id]=it;
  for(const it of Object.values(foodLocal()[date]||{})) if(!m[it.id]||(it.ts||0)>=(m[it.id].ts||0)) m[it.id]=it;
  FOOD_S.set(date,m); return m;
}
const dayOf=date=>(DAY_MAP||(DAY_MAP=new Map((DATA.days||[]).map(d=>[d.date,d])))).get(date);

/* ------------------------------------------------------------ food: fuelling model (mirrors fuel.py) */
// The server works out, for every finished and planned session, the energy spent and the share of it that came from
// carbohydrate (power zones, duration; see fuel.py for the physiology and the references). From those two numbers:
//   burned  = energy × share (the share rises a little with what you take while riding)
//   to take = a rate per hour that follows the session's demands, inside the published ranges for its duration
//   after   = burned − taken is the hole left in your glycogen; how fast to refill it depends on what comes next.
// Each ride gets one diary line with what you took: the grams recorded on Intervals, or the planned amount until
// you say otherwise. If the session turns out longer or harder than planned, the difference goes into recovery.
const FUEL_DEF={on:true,max:90,since:"2026-11-10"};
const fuelCfg=()=>({...FUEL_DEF,...(lsJSON("rd_fuel",null)||{})});
const isRide=w=>/Ride/.test(w?.type||"");
const durTxt=m=>m<60?`${Math.round(m)} min`:`${Math.floor(m/60)}h${String(Math.round(m%60)).padStart(2,"0")}`;
const startMs=(date,hhmm)=>new Date(`${date}T${hhmm||"12:00"}`).getTime();
const r5=v=>Math.round(v/5)*5;
const FUEL_INTAKE=0.0005/0.30;
function fuelUsed(f,intake=0){const rate=f.min?intake/(f.min/60):0;return f.kcal*clip(f.frac+FUEL_INTAKE*rate,.15,1)/4;}
// On the bike: 70% of what the session burns per hour (before the fall that comes with duration), 10% more for every
// hour beyond the second, never under 40 g/h, never over your ceiling. Other sports: the classic duration tiers.
function fuelRate(f,max,ride=true){
  const m=f.min;
  if(ride){ if(m<40) return 0;
    const burn=f.kcal*(f.frac0??f.frac)/4/(m/60);
    return r5(Math.min(max,Math.max(40,.7*burn*(1+.1*Math.max(0,m/60-2))))); }
  if(m<75) return 0;
  const [lo,hi]=m<150?[30,60]:[50,90];
  return r5(Math.min(max,hi,Math.max(lo,.55*fuelUsed(f)/(m/60))));
}
function fuelRecovery(used,intake,kg,soon,extra=0){
  const deficit=Math.max(0,used-intake),fast=soon||extra>=.3*kg,cap=(fast?1.2:.8)*kg;
  const carbs=deficit<.25*kg?0:Math.min(deficit,cap);
  let more=fast&&carbs?Math.min(deficit-carbs,kg):0; if(more<.25*kg) more=0;
  return {deficit:Math.round(deficit),carbs:r5(carbs),more:r5(more),protein:Math.round(.3*kg),fast,window:fast?"within the hour":"in your next meal"};
}
// the unplanned part of the hole: what is left to refill now, minus what the plan expected to leave
const fuelExtra=(used,intake,plan)=>plan?Math.max(0,used-intake)-plan.deficit:0;
const planOf=(date,w)=>(dayOf(date)?.plan||[]).find(p=>p.done_id&&p.done_id===w.id&&p.fuel)||null;
function fuelPlanned(p){            // what a planned session asks for
  const rate=fuelRate(p.fuel,fuelCfg().max,isRide(p)),intake=rate*p.fuel.min/60,used=fuelUsed(p.fuel,intake);
  return {rate,intake:r5(intake),used,deficit:Math.max(0,used-intake)};
}
// what you took during a finished session, and how we know
function fuelIntake(w,date){
  const st=foodStored(date)["fuel-"+w.id];
  if(st) return st.del?{g:0,src:"removed by you"}:{g:st.c||0,src:"set by you",own:true};
  if(w.carbs_in>0) return {g:Math.round(w.carbs_in),src:"recorded on Intervals"};
  if(!isRide(w)||!w.fuel) return {g:0,src:"nothing recorded"};
  const p=planOf(date,w);
  if(p){const q=fuelPlanned(p);return {g:q.intake,src:q.rate?`as planned, ${q.rate} g/h`:"nothing planned",guess:true};}
  const rate=fuelRate(w.fuel,fuelCfg().max);
  return {g:r5(rate*w.fuel.min/60),src:rate?`suggested ${rate} g/h`:"short ride",guess:true};
}
// is another demanding session close enough that refilling fast matters?
function fuelSoon(date,w){
  const day=dayOf(date),big=p=>(p.load||0)>=70||(p.minutes||0)>=90;
  return (day?.plan||[]).some(p=>!p.done&&big(p))||((DATA.upcoming||{})[isoAdd(date,1)]||[]).some(big)
    ||(dayOf(isoAdd(date,1))?.workouts||[]).some(x=>(x.load||0)>=70||(x.minutes||0)>=90);
}
function fuelDone(w,date){
  if(!w.fuel) return null;
  const it=fuelIntake(w,date),used=fuelUsed(w.fuel,it.g),p=planOf(date,w),plan=p?fuelPlanned(p):null,soon=fuelSoon(date,w);
  const rec=fuelRecovery(used,it.g,weightNow()||70,soon,fuelExtra(used,it.g,plan));
  const extra=plan?r5(rec.deficit-plan.deficit):null;
  let why="";
  if(plan&&Math.abs(extra)>=15){const dm=w.fuel.min-p.fuel.min,dk=w.fuel.kcal/w.fuel.min-p.fuel.kcal/p.fuel.min;
    why=extra>0?(dm>=10?"the session ran longer than planned":dk>0?"it was harder than planned":"you took less than planned")
               :(dm<=-10?"the session was shorter than planned":dk<0?"it was easier than planned":"you took more than planned");}
  return {w,used:Math.round(used),it,plan,p,rec,extra,why,soon};
}
function fuelItems(date){
  const cfg=fuelCfg(); if(!cfg.on||date<cfg.since||!foodOn()) return [];
  const out=[];
  for(const w of dayOf(date)?.workouts||[]){
    if(!w.id||!isRide(w)) continue;
    const it=fuelIntake(w,date); if(it.own||!(it.g>0)) continue;
    out.push({id:"fuel-"+w.id,date,meal:"s",name:"Ride fuel",fuel:1,auto:1,wid:w.id,ride:w.name||"Ride",mins:w.minutes||0,
      note:it.src,kcal:it.g*4,p:0,c:it.g,f:0,at:startMs(date,w.start)+1,ts:0});
  }
  return out;
}
const fuelHow=f=>({"power zones":"your power in each zone","average power":"your average power","heart rate":"heart rate and Garmin's calories"})[f.how]||"the plan";
function fuelBreakdown(w,date,intake){
  const d=fuelDone(w,date); if(!d) return "";
  const g=intake??d.it.g,used=Math.round(fuelUsed(w.fuel,g)),rec=fuelRecovery(used,g,weightNow()||70,d.soon,fuelExtra(used,g,d.plan));
  const extra=d.plan?r5(rec.deficit-d.plan.deficit):null;
  return `<div class="kv"><span>Burned · from ${fuelHow(w.fuel)}</span><b>≈ ${r5(used)} g</b>
      <span>Taken while riding</span><b>${Math.round(g)} g</b>
      <span>Left to refill</span><b>≈ ${r5(rec.deficit)} g</b>
      ${d.plan?`<span>Planned to refill</span><b>≈ ${r5(d.plan.deficit)} g</b>`:""}</div>
    <p class="sh-note">${rec.carbs?`<b>After: about ${rec.carbs} g of carbs and ${rec.protein} g of protein ${rec.window}${rec.more?`, then another ${rec.more} g of carbs in the two hours after`:""}.</b>${d.soon?" Another demanding session is close, so refilling quickly matters.":rec.fast?" The session took more than the plan foresaw, so the difference is refilled straight away.":" Nothing demanding is close, so timing matters little."}`
      :"<b>After: a normal meal is enough.</b> What you took covered almost all of it."}
      ${extra!=null&&Math.abs(extra)>=15?` That is ${Math.abs(extra)} g ${extra>0?"more":"less"} to refill than planned.`:""}
      ${rec.deficit>rec.carbs+rec.more+20?` The other ${r5(rec.deficit-rec.carbs-rec.more)} g come back with the day's meals: they are already inside your target.`:""}</p>`;
}
function openFuel(it){
  const w=(dayOf(it.date)?.workouts||[]).find(x=>x.id===it.wid);
  openSheet(`<div class="sh-top"><h2>Ride fuel</h2>${X}</div>
    <p class="sh-desc">What you took on the bike during <b>${esc(it.ride||"your ride")}</b>${it.mins?` (${durTxt(it.mins)})`:""}: ${it.auto?esc(it.note):"set by you"}. Correct it if it went differently: the recovery below follows.</p>
    <div class="field"><label for="fu-c">Carbs taken (g)</label><input id="fu-c" type="number" inputmode="numeric" min="0" max="900" step="5" value="${Math.round(it.c)}"><p id="fu-k"></p></div>
    <div id="fu-b"></div>
    <div class="savebar" style="margin-top:18px"><button class="btn quiet" id="fu-del">Remove</button><button class="btn" id="fu-save">Save</button></div>
    <button class="pl-q" id="fu-set" style="margin-top:14px">How this is worked out →</button>`);
  const inp=$("fu-c"),upd=()=>{const c=+inp.value||0;$("fu-k").textContent=`${fmtK(c*4)} kcal${it.mins?` · ${Math.round(c/(it.mins/60))} g/h`:""}`;
    if(w&&w.fuel) $("fu-b").innerHTML=fuelBreakdown(w,it.date,c);};
  inp.oninput=upd; upd();
  $("fu-save").onclick=()=>{const c=clip(Math.round(+inp.value||0),0,900),o={...it,c,kcal:c*4,note:"set by you",ts:Date.now()};delete o.auto;
    foodSave(o);buzz();closeSheet();render();toast("Ride fuel updated");};
  $("fu-del").onclick=()=>foodDelete(it);
  $("fu-set").onclick=openFuelSettings;
}
function openFuelSettings(){
  const cfg=fuelCfg();let on=cfg.on;
  openSheet(`<div class="sh-top"><h2>Fuelling</h2>${X}</div>
    <p class="sh-desc">For every session the app estimates the carbohydrate you burn, tells you how much to take while riding and how much to eat afterwards.</p>
    <ul class="guide">
      <li><b>Burned.</b> Work from your power meter, at 22% efficiency, gives the energy. The share from carbohydrate comes from the time in each power zone: about 45% in easy endurance, 60–70% at tempo, nearly all of it at threshold and above. It drops about 8 points an hour as the ride goes on and rises a little with what you take.</li>
      <li><b>While riding: the priority.</b> Sized on your engine: 70% of what the session burns each hour, a little more on long rides, never under 40 g an hour and never over your ceiling. It feeds the session, starts the refill for the next one and keeps your gut trained. A hard hour burns 150 g or more, so it lands on your ceiling.</li>
      <li><b>After.</b> Burned minus taken is what your glycogen is missing. With another demanding session within a day: up to 1.2 g per kg in the first hour. Otherwise up to 0.8 g per kg in the next meal. Always 0.3 g of protein per kg.</li>
      <li><b>If the session changes.</b> Longer or harder than planned means more burned than what you carried: the difference is added to recovery and refilled straight away, in two doses when it is large.</li>
    </ul>
    <p class="sh-note">It is an estimate: without a lab test the share of fat and carbohydrate can be off by a quarter either way. Sources: Rothschild 2022, Podlogar &amp; Wallis 2022, Jeukendrup 2014, Burke 2017, Thomas 2016.</p>
    <div class="field"><label>Ride fuel in the diary</label><div class="seg two" id="fs-on"><button data-v="1" class="${on?"on":""}">On</button><button data-v="0" class="${on?"":"on"}">Off</button></div><p>Each ride adds what you took: the grams you record on Intervals, or the planned amount until you correct it.</p></div>
    <div class="field"><label for="fs-r">Most you take in an hour (g)</label><input id="fs-r" type="number" inputmode="numeric" min="30" max="120" step="5" value="${cfg.max}"><p>The plan never asks for more than this. Above 60 g an hour use a glucose + fructose mix; above 90 only if your gut is trained for it.</p></div>
    <div class="savebar" style="margin-top:22px"><span class="st"></span><button class="btn" id="fs-save">Save</button></div>`);
  $("fs-on").querySelectorAll("button").forEach(b=>b.onclick=()=>{on=b.dataset.v==="1";$("fs-on").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));});
  $("fs-save").onclick=()=>{syncSet("rd_fuel",{on,max:clip(r5(+$("fs-r").value||90),30,120),since:cfg.since});
    foodReset();CAL=null;buzz();closeSheet();render();toast("Saved");};
}
// Today's fuelling: what the session still to do asks for, and what to eat after the one that is done
function fuelCard(d,items){
  const day=dayOf(d); if(d!==todayISO()||!day) return "";
  const rows=[];
  for(const p of (day.plan||[]).filter(p=>!p.done&&p.fuel&&p.fuel.min>=30)){
    const q=fuelPlanned(p),tot=q.intake;
    rows.push(`<p><b>On the bike · ${esc(p.name||"Session")}, ${durTxt(p.fuel.min)}</b>${q.rate&&isRide(p)?`<em>${tot} g of carbs</em> in the bottle${p.fuel.min>=90?"s":""} (${q.rate} g/h${q.rate>60?", glucose + fructose":""}). You'll burn about ${r5(q.used)} g: about ${r5(q.deficit)} g left to refill after.`
      :q.rate?`You'll burn about ${r5(q.used)} g of carbs. If you can, take about ${tot} g during it.`:`You'll burn about ${r5(q.used)} g of carbs: too short to need anything on the way, eat well afterwards.`}</p>`);
  }
  const done=(day.workouts||[]).filter(w=>w.type&&w.start&&w.fuel&&(w.minutes||0)>=30).sort((a,b)=>a.start<b.start?-1:1),last=done[done.length-1];
  const end=last?startMs(d,last.start)+last.minutes*60000:0;
  if(last&&end<=Date.now()){
    const f=fuelDone(last,d),rec=f.rec,what=isRide(last)?"ride":/Run/.test(last.type)?"run":"session";
    const after=items.filter(x=>!x.fuel&&(x.at||x.ts)>=end),got=ftot(after),ok=rec.carbs&&got.c>=(rec.carbs+rec.more)*.9&&got.p>=rec.protein*.9;
    rows.push(`<p><b>After your ${what}${ok?" · covered":""}</b>Burned about ${r5(f.used)} g of carbs, took ${f.it.g} g${f.it.guess?" (assumed: tap Ride fuel in Snacks to correct)":""}: about ${r5(rec.deficit)} g to refill.
      ${ok?`You've logged ${Math.round(got.c)} g of carbs and ${Math.round(got.p)} g of protein since: recovery is taken care of.`
        :rec.carbs?`Aim for ${rec.carbs} g of carbs and ${rec.protein} g of protein ${rec.window}${rec.more?`, then another ${rec.more} g of carbs in the two hours after`:""}.${after.length?` Logged since: ${Math.round(got.c)} g carbs, ${Math.round(got.p)} g protein.`:""}`
        :`A normal meal with about ${rec.protein} g of protein is enough.`}
      ${f.why&&f.extra>0?` That includes ${f.extra} g more than planned, because ${f.why}.`:f.why?` ${Math.abs(f.extra)} g less than planned, because ${f.why}.`:""}</p>`);
  }
  return rows.length?`<button class="fuel-c" id="fuel-c"><i>${FUEL_IC}</i><div>${rows.join("")}</div></button>`:"";
}
const FUEL_IC=`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6v3l1.5 2.5V20a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2V7.5L9 5z"/><path d="M7.5 12h9"/></svg>`;
function foodDates(){return [...new Set([...Object.keys(DATA.nutrition?.food||{}),...Object.keys(foodLocal())])].sort();}
const ftot=items=>items.reduce((a,x)=>({kcal:a.kcal+(x.kcal||0),p:a.p+(x.p||0),c:a.c+(x.c||0),f:a.f+(x.f||0)}),{kcal:0,p:0,c:0,f:0});
function ntot(items){const sum={},have={};let known=0;
  for(const x of items){if(!x.n) continue;known++;for(const k of NUT_KEYS) if(x.n[k]!=null){sum[k]=(sum[k]||0)+x.n[k];have[k]=(have[k]||0)+1;}}
  return {sum,have,known};}

// Nutrient names as the AI may write them
const N_ALIAS={sugars:["sugars","sugar","zuccheri","of_which_sugars"],fiber:["fiber","fibre","fibers","fibres","fibra","dietary_fiber"],
  satfat:["satfat","saturated","saturated_fat","sat_fat","saturatedfat","saturated_fats"],monofat:["monofat","monounsaturated","monounsaturated_fat","mufa","mono_fat"],
  polyfat:["polyfat","polyunsaturated","polyunsaturated_fat","pufa","poly_fat"],chol:["chol","cholesterol"],sodium:["sodium","sodio"],potassium:["potassium","potassio"],
  calcium:["calcium","calcio"],iron:["iron","ferro"],magnesium:["magnesium","magnesio"],zinc:["zinc","zinco"],vita:["vita","vitamin_a","vitamina","vit_a","vitamin a"],
  vitc:["vitc","vitamin_c","vitaminc","vit_c","vitamin c"],vitd:["vitd","vitamin_d","vitamind","vit_d","vitamin d"],vite:["vite","vitamin_e","vitamine","vit_e","vitamin e"],
  b12:["b12","vitamin_b12","vitaminb12","vit_b12","vitamin b12","cobalamin"],folate:["folate","folic_acid","b9","vitamin_b9","folates","folato"]};
function normN(o){
  if(!o||typeof o!=="object") return null;
  const low={};for(const [k,v] of Object.entries(o)) low[k.toLowerCase().replace(/[\s-]+/g,"_")]=v;
  const out={};
  for(const [key,al] of Object.entries(N_ALIAS)) for(const a of al){let v=low[a.replace(/\s+/g,"_")];if(v&&typeof v==="object") v=v.value??v.amount;
    if(v!=null&&v!==""&&isFinite(parseFloat(v))){out[key]=parseFloat(v);break;}}
  return scaleN(out,1);
}
// What the AI has worked out for a food is remembered per 100 g, so the same food next time needs no request
const nCacheAll=()=>lsJSON("rd_ncache",{});
const nCache=name=>nCacheAll()[norm(name)]||null;
function nCacheSet(name,n100){if(!n100) return;const c=nCacheAll();c[norm(name)]=n100;const ks=Object.keys(c);if(ks.length>400) delete c[ks[0]];LS.set("rd_ncache",JSON.stringify(c));}
function recents(){
  const m=new Map(),lim=isoAdd(todayISO(),-90);
  for(const d of foodDates()) if(d>=lim) for(const it of foodDay(d)){
    if(it.fuel||(it.k100==null&&it.src!=="quick")) continue;
    const k=norm(it.name)+"|"+norm(it.brand); const o=m.get(k)||{n:0};
    m.set(k,{n:o.n+1,last:Math.max(o.last||0,it.ts||0),it});
  }
  return [...m.values()].sort((a,b)=>(b.n*2+b.last/864e5/7)-(a.n*2+a.last/864e5/7)).map(x=>x.it);
}
const itemFood=it=>it.k100!=null?{name:it.name,brand:it.brand,k:it.k100,p:it.p100,c:it.c100,f:it.f100,unit:it.unit||null,serving:it.serving||null,src:it.src,code:it.code,n100:it.n100||(it.n&&it.g?scaleN(it.n,100/it.g):null),last:{g:it.g,um:it.um,uq:it.uq}}
  :{name:it.name,quick:true,kcal:it.kcal,p:it.p,c:it.c,f:it.f,src:"quick"};

/* ------------------------------------------------------------ food: goal, burn, target */
function goalGet(){
  const l=lsJSON("rd_goal",null),s=DATA.nutrition?.goal||null;
  const g=!s?l:!l?s:(l.ts||0)>=(s.ts||0)?l:s;
  return g&&g.target?g:null;
}
function weightNow(){const w=athLast("weight");return w?w.v:null;}
function goalState(){
  const g=goalGet(),w=weightNow(); if(!g) return null;
  if(w==null) return {g,w:null,dir:0,adj:0};
  const gap=g.target-w,dir=Math.abs(gap)<0.3?0:Math.sign(gap);
  const adj=dir*g.pace*KCAL_KG/7,weeks=dir?Math.abs(gap)/g.pace:0;
  return {g,w,gap,dir,adj:Math.round(adj/10)*10,eta:dir?isoAdd(todayISO(),Math.round(weeks*7)):null};
}
// Garmin's burn adjusted to what your weight actually did: needs two weeks of logging and weigh-ins
let CAL=null;
function calib(){
  if(CAL) return CAL;
  const H=DATA.energy?.history||[],today=todayISO(),lim=isoAdd(today,-28),ws=athSeries("weight").filter(p=>p.date>=lim);
  const days=H.filter(h=>h.date>=lim&&h.date<today&&h.kcal).map(h=>({b:h.kcal,e:ftot(foodDay(h.date)).kcal})).filter(x=>x.e>=1000);
  CAL={f:1,n:days.length,ok:false};
  if(days.length<14||ws.length<2) return CAL;
  const t=ws.map(p=>(+new Date(p.date)-+new Date(ws[0].date))/864e5); if(t[t.length-1]<14) return CAL;
  const mt=t.reduce((a,b)=>a+b)/t.length,mv=ws.reduce((a,p)=>a+p.v,0)/ws.length;
  const slope=t.reduce((a,x,i)=>a+(x-mt)*(ws[i].v-mv),0)/t.reduce((a,x)=>a+(x-mt)**2,0);
  const eat=days.reduce((a,x)=>a+x.e,0)/days.length,burn=days.reduce((a,x)=>a+x.b,0)/days.length;
  const real=eat-slope*KCAL_KG;
  CAL={f:clip(real/burn,.85,1.15),n:days.length,ok:true,real:Math.round(real),garmin:Math.round(burn)};
  return CAL;
}
function burnOf(date){
  const E=DATA.energy||{},H=E.history||[],f=calib().f;
  if(date===todayISO()){
    if(E.today?.projected) return {v:Math.round(E.today.projected*f),proj:true};
    const past=H.filter(h=>h.kcal&&h.date<date).slice(-14).map(h=>h.kcal).sort((a,b)=>a-b);
    return past.length?{v:Math.round(past[past.length>>1]*f),proj:true,usual:true}:null;
  }
  const h=H.find(x=>x.date===date); return h&&h.kcal?{v:Math.round(h.kcal*f),proj:false}:null;
}
// What a day costs is known from the morning: your everyday burn without training (median of the last four weeks)
// plus that day's training — what the planned sessions usually cost you, replaced once by what they really cost
// when they are done. So the target doesn't drift with every Garmin sync.
const sportOf=t=>/Run/.test(t||"")?"run":/Ride/.test(t||"")?"ride":"other";
let PB=null;
function burnModel(){
  if(PB) return PB;
  const E=DATA.energy||{},H=E.history||[],t=todayISO(),lim=isoAdd(t,-28),rate=(E.bmr||1700)/1440;
  const wAct=w=>w.kcal&&w.minutes?Math.max(0,w.kcal-rate*w.minutes):null;      // a session's cost on top of resting
  const per={};
  for(const d of DATA.days||[]) for(const w of d.workouts||[]){const a=wAct(w);if(a!=null&&w.type)(per[sportOf(w.type)]=per[sportOf(w.type)]||[]).push(a/w.minutes);}
  for(const k in per) per[k]=median(per[k]);
  const base=[];
  for(const h of H){if(!h.kcal||h.date<lim||h.date>=t) continue;
    base.push(h.kcal-((dayOf(h.date)||{}).workouts||[]).filter(w=>w.type).reduce((a,w)=>a+(wAct(w)??0),0));}
  return PB={ok:base.length>=7,base:base.length?Math.round(median(base)):null,n:base.length,per,wAct};
}
function dayTraining(date){
  const M=burnModel(),d=dayOf(date)||{},rateOf=t=>M.per[sportOf(t)]??M.per.ride??7;let kcal=0,min=0,pending=false;const names=[];
  for(const w of (d.workouts||[]).filter(w=>w.type)){kcal+=M.wAct(w)??rateOf(w.type)*(w.minutes||0);min+=w.minutes||0;names.push(w.name||w.type);}
  if(date===todayISO()) for(const p of (d.plan||[]).filter(p=>!p.done&&p.minutes)){kcal+=rateOf(p.type)*p.minutes;min+=p.minutes;pending=true;names.push(p.name||"Workout");}
  return {kcal:Math.round(kcal),min,pending,names};
}
const dayKind=tr=>!tr||tr.min<20?"Rest day":`${tr.min>=180?"Long day":"Training day"} · ${durTxt(tr.min)}`;
// The scale has the last word. Once a week the trend of your weigh-ins (last three weeks) is compared with the pace
// of your goal: losing faster than planned raises every day's range, gaining lowers it a little, anything else leaves it.
// It needs no food logging at all, so it also corrects what the watch and eyeballed portions get wrong.
const trimGet=()=>lsJSON("rd_trim",null)||{v:0};
function weightTrend(){
  const t=todayISO(),ws=athSeries("weight").filter(p=>p.date>=isoAdd(t,-21)&&p.date<=t),n=ws.length;
  if(n<4) return {ok:false,n};
  const x=ws.map(p=>(new Date(p.date+"T12:00")-new Date(ws[0].date+"T12:00"))/864e5),span=x[n-1];
  if(span<14) return {ok:false,n,span};
  const mx=x.reduce((a,b)=>a+b)/n,my=ws.reduce((a,p)=>a+p.v,0)/n;
  const slope=x.reduce((a,v,i)=>a+(v-mx)*(ws[i].v-my),0)/x.reduce((a,v)=>a+(v-mx)**2,0)*7;
  return {ok:true,n,span,slope,from:ws[0].date,at:d=>my+slope/7*((new Date(d+"T12:00")-new Date(ws[0].date+"T12:00"))/864e5-mx)};
}
// Without a diary the app can't see what you ate, so at each weigh-in it asks one thing: compared with your plan,
// did you eat less, about that, or more? It keeps the correction fair: weight going up after days of "more" says
// nothing against the range, so the range stays and the advice is simply to come back inside it.
const adhGet=()=>lsJSON("rd_adh",{});
function adhSet(date,v){const A=adhGet(),lim=isoAdd(todayISO(),-90);A[date]=v;for(const d of Object.keys(A)) if(d<lim) delete A[d];syncSet("rd_adh",A);}
function adhRecent(){
  const t=todayISO(),v=Object.entries(adhGet()).filter(([d])=>d>=isoAdd(t,-21)&&d<=t).map(([,x])=>+x||0);
  return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;
}
function trimBand(){
  const gs=goalState(),want=gs&&gs.dir?gs.dir*gs.g.pace:0;
  return {want,lo:Math.min(want,0)-(want>0?.1:.2),hi:Math.max(want,0)+(want<0?.1:.2)};
}
function trimCheck(){
  if(!foodOn()) return;
  const T=trimGet(),t=todayISO(); if(T.at&&T.at>isoAdd(t,-7)) return;
  const tr=weightTrend(); if(!tr.ok) return;
  const B=trimBand(),a=adhRecent();let step=tr.slope<B.lo-.25?150:tr.slope<B.lo?100:tr.slope>B.hi?-100:0,held=null;
  if(step<0&&a!=null&&a>=.5){step=0;held="more";}             // gaining while eating over the plan: the plan isn't the problem
  if(step>0&&a!=null&&a<=-.5){step=0;held="less";}            // losing fast while eating under it: same
  syncSet("rd_trim",{v:clip((T.v||0)+step,-300,400),at:t,step,held,slope:Math.round(tr.slope*100)/100,want:B.want});
}
function targetOf(date){
  const M=burnModel();let burn,tr=null;
  if(M.ok){tr=dayTraining(date);burn={v:M.base+tr.kcal,proj:date===todayISO()&&tr.pending,fixed:true};}
  else{burn=burnOf(date); if(!burn) return null;}
  const gs=goalState(),goal=gs?gs.adj:0,trim=burn.fixed?trimGet().v||0:0,floor=Math.max(1200,DATA.energy?.bmr||0);
  const kcal=Math.round(Math.max(floor,burn.v+goal+trim)/50)*50,w=weightNow()||70;
  const p=Math.round(1.8*w),f=Math.round(kcal*.27/9),c=Math.max(0,Math.round((kcal-p*4-f*9)/4));
  return {kcal,lo:kcal-100,hi:kcal+100,burn,tr,goal,trim,adj:kcal-burn.v,p,c,f,floored:burn.v+goal+trim<floor};
}
// weight trend in one card: what the scale says, what the goal wants, what happened to the range
function trendCard(){
  const W=weightTrend(),B=trimBand(),T=trimGet(),kgw=v=>Math.abs(v)<.05?"Stable":`${v>0?"+":"−"}${Math.abs(v).toFixed(2)}`;
  const verdict=!W.ok?`${W.n} of 4 weigh-ins in the last three weeks: weigh in every 3–4 days and the range starts correcting itself.`:
    `${B.want?`Goal ${kgw(B.want)} kg a week. `:""}${T.held==="more"?"Range unchanged: you ate over the plan, come back inside it.":T.held==="less"?"Range unchanged: eat the full plan.":T.v?`Range ${T.v>0?"raised":"lowered"} by ${fmtK(Math.abs(T.v))} kcal a day.`:"Range unchanged: you're on course."}`;
  // a change of the range, said as portions: what to put on the plate now, not just a number of kcal
  const sh=T.step&&T.at>=isoAdd(todayISO(),-10)&&typeof planShift==="function"?planShift(T.step):[];
  const shTxt=sh.length?`<span class="wt-sh">${T.step>0?"More":"Less"} on the plate from now: ${sh.slice(0,3).map(x=>`${esc(x.name)} ${x.a} → ${x.b} g`).join(" · ")}</span>`:"";
  return `<button class="wk-c" id="wt-c"><div class="wk-h"><small>WEIGHT TREND · 3 WEEKS</small><b>${W.ok?kgw(W.slope):"–"}<u>${W.ok&&Math.abs(W.slope)>=.05?"kg/week":""}</u></b></div><span>${esc(verdict)}</span>${shTxt}</button>`;
}
// where what you ate sits against the day's range
function rangeState(eaten,tg){
  if(!tg) return null;
  return eaten<tg.lo?{k:"under",n:tg.lo-eaten,txt:"to your range"}:eaten<=tg.hi?{k:"in",n:eaten,txt:"in your range"}:{k:"over",n:eaten-tg.hi,txt:"above range"};
}
const rangeTxt=tg=>`${fmtK(tg.lo)}–${fmtK(tg.hi)}`;

/* ------------------------------------------------------------ food: tab */
function foodRing(eaten,tg){
  const r=84,C=2*Math.PI*r,target=tg?.kcal,k=target?eaten/target:0,L=C*Math.min(1,k),st=rangeState(eaten,tg);
  const col=!st||st.k==="under"?"url(#frg)":st.k==="in"?"#5fc795":"#f2a65a";
  return `<svg viewBox="0 0 200 200" class="fr" aria-label="${fmtK(Math.round(eaten))} kcal eaten${tg?`, range ${rangeTxt(tg)}`:""}">
    <defs><linearGradient id="frg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fcd34d"/><stop offset="1" stop-color="#f59e0b"/></linearGradient></defs>
    <circle cx="100" cy="100" r="${r}" fill="none" stroke="#fff" stroke-opacity=".06" stroke-width="12"/>
    <circle class="fr-arc" cx="100" cy="100" r="${r}" fill="none" stroke="${col}" stroke-width="12" stroke-linecap="round"
      stroke-dasharray="${L.toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 100 100)" style="--len:${L.toFixed(1)}"/>
    <text x="100" y="104" text-anchor="middle" class="fr-n">${fmtK(Math.round(st?st.n:eaten))}</text>
    <text x="100" y="130" text-anchor="middle" class="fr-l">${!st?"KCAL EATEN":st.k==="in"?"IN YOUR RANGE":`KCAL ${st.txt.toUpperCase()}`}</text></svg>`;
}
function renderFood(){
  const today=todayISO(); if(!foodSel||foodSel>today) foodSel=today;
  const pg=PG.athlete,d=foodSel,items=foodDay(d),T=ftot(items),tg=targetOf(d),isToday=d===today,minD=isoAdd(today,-120);
  const label=isToday?"Today":d===isoAdd(today,-1)?"Yesterday":fmtDay(d,{weekday:"short",day:"numeric",month:"short"});
  const chev=p=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${p}"/></svg>`;
  const mac=k=>{const v=T[k],t=tg?.[k],pc=t?Math.min(100,v/t*100):0;
    return `<div class="mc"><small>${MAC[k][0].toUpperCase()}</small><b>${Math.round(v)}<u>${t?` / ${t} g`:" g"}</u></b><div class="en-bar"><i style="width:${pc}%;background:${MAC[k][1]}"></i></div></div>`;};
  const LIB=libAll(),nLib=LIB.length,real=items.filter(x=>!x.fuel),usual=LIB.filter(e=>e.kind==="day");
  const dayPick=`<div class="daypick f-day">
    <button class="chev" id="fprev" aria-label="Previous day" ${d<=minD?"disabled":""}>${chev("M15 18l-6-6 6-6")}</button>
    <span class="d">${esc(label)}</span>
    <button class="chev" id="fnext" aria-label="Next day" ${isToday?"disabled":""}>${chev("M9 18l6-6-6-6")}</button></div>`;
  let body="";
  if(pg==="diary") body=`${dayPick}
  <button class="f-hero" id="f-hero" aria-label="How the target works">
    ${foodRing(T.kcal,tg)}
    <div class="f-stats">
      <div><small>EATEN</small><b>${fmtK(Math.round(T.kcal))}</b></div>
      <div class="rg"><small>YOUR RANGE</small><b>${tg?rangeTxt(tg):"–"}</b></div>
      <div><small>${tg?.burn.proj?"BURN (EXP.)":"BURN"}</small><b>${tg?fmtK(tg.burn.v):"–"}</b></div>
    </div>
    <p class="f-sub">${tg?esc(targetLine(tg,isToday)):"Waiting for today's burn from Garmin."}</p>
  </button>
  <div class="macros">${["p","c","f"].map(mac).join("")}</div>
  ${planCheckCard(d)}${fuelCard(d,items)}
  <button class="coach-bar" id="f-coach">${SPARK}<span>Tell me what you ate, or ask your food coach…</span></button>
  <section class="sec"><div class="sec-h"><h2>Diary</h2><span>${items.length?`${items.length} item${items.length>1?"s":""}`:"Tap + to log"}</span></div>
    ${!real.length&&usual.length?`<div class="ud"><small>USUAL DAY · ONE TAP, THEN FIX ONLY WHAT WAS DIFFERENT</small>${usual.map(e=>`<button class="ml-copy mine" data-libd="${e.id}">+ ${esc(e.name)} · ${fmtK(Math.round(ftot(e.items).kcal))} kcal</button>`).join("")}</div>`:""}
    ${MEALS.map(([m,n])=>mealCard(m,n,items.filter(x=>x.meal===m),d)).join("")}
    ${real.length>=3?`<button class="ml-save day" id="day-save">Save this day as a usual day</button>`:""}
    <button class="lib-c" id="lib-c"><span><b>My days, meals &amp; recipes</b><small>${nLib?`${nLib} saved`:"Save a usual day or breakfast, build recipes"}</small></span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button></section>
  <p class="foot">Swipe sideways to change day.</p>`;
  else if(pg==="plan") body=planView();
  else if(pg==="weight") body=weightView();
  else {PG.athlete="diary";return renderFood();}
  $("app").innerHTML=`
  <div class="top"><div class="ttl">Athlete</div><span class="tb">${ASK}<button class="gear" id="gear" aria-label="Settings">${GEAR}</button></span></div>
  ${pageBar("athlete")}${body}`;
  const on=(id,f)=>{const e=$(id);if(e) e.onclick=f;};
  $("gear").onclick=openSettings; on("f-hero",()=>openTarget(d));
  on("fprev",()=>foodGo(-1)); on("fnext",()=>foodGo(1));
  document.querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>openAddFood(b.dataset.add,d));
  document.querySelectorAll("[data-fi]").forEach(b=>b.onclick=()=>{const it=items.find(x=>x.id===b.dataset.fi); if(!it) return; if(it.fuel) return openFuel(it); openPortion(itemFood(it),{meal:it.meal,date:d,item:it});});
  document.querySelectorAll("[data-copy]").forEach(b=>b.onclick=()=>copyMeal(b.dataset.copy,d));
  document.querySelectorAll("[data-libm]").forEach(b=>b.onclick=()=>{const [id,m]=b.dataset.libm.split("|"),e=libAll().find(x=>x.id===id);if(e) logLibMeal(e,m,d);});
  document.querySelectorAll("[data-savem]").forEach(b=>b.onclick=()=>openSaveMeal(b.dataset.savem,d));
  document.querySelectorAll("[data-libd]").forEach(b=>b.onclick=()=>{const e=libAll().find(x=>x.id===b.dataset.libd);if(e) logLibDay(e,d);});
  on("day-save",()=>openSaveDay(d));
  on("lib-c",openLibrary); bindSwipeDelete();
  on("f-coach",()=>openAssistant("food")); on("fuel-c",openFuelSettings);
  on("goal-c",openGoal); on("wt-c",()=>openAth("weight"));
  if(pg==="plan") bindPlan();
  if(pg==="diary") bindPlanCheck(d);
  if(pg==="weight") bindWeight();
}
function foodGo(k){
  const t=todayISO(),n=isoAdd(foodSel,k); if(n>t||n<isoAdd(t,-120)) return;
  foodSel=n; buzz(5); renderFood(); animIn(k>0?"swl":"swr");
}
function targetLine(tg,isToday){
  if(tg.floored) return `Kept at your resting burn (${fmtK(DATA.energy?.bmr)} kcal): eating below it costs training quality.`;
  if(!tg.burn.fixed){const a=Math.round(tg.adj),what=isToday?(tg.burn.usual?"your usual daily burn":"what you're expected to burn today"):"what you burned";
    return a?`${fmtK(Math.abs(a))} kcal ${a<0?"under":"over"} ${what}, for your goal.`:`Matches ${what}.`;}
  const k=dayKind(tg.tr);
  return !isToday?`${k}.`:tg.tr.pending?`${k}. Set for the day: it changes only once, when the session is done.`:`${k}. Set for the day: it won't move.`;
}
function mealCard(m,n,its,d){
  const T=ftot(its),prev=its.length?[]:foodDay(isoAdd(d,-1)).filter(x=>x.meal===m&&!x.fuel);
  return `<div class="meal"><div class="ml-h"><i class="ml-i ml-${m}">${MEAL_ICON[m]}</i><b>${n}</b><span>${its.length?`${fmtK(Math.round(T.kcal))}<u>kcal</u>`:""}</span>
      <button class="ml-add" data-add="${m}" aria-label="Add to ${n}"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button></div>
    ${its.map(x=>`<div class="fi-w" data-fw="${x.id}"><div class="fi-bg">${TRASH}</div><button class="fi" data-fi="${x.id}"><span class="fn">${esc(x.name)}<small>${x.fuel?`${Math.round(x.c)} g carbs`:x.g?`${fmtNum(x.g)} g`:"Quick add"}${x.note?` · ${esc(x.note)}`:""}${x.brand?` · ${esc(x.brand)}`:""}</small></span><b>${fmtK(Math.round(x.kcal))}</b></button></div>`).join("")}
    ${!its.length?libAll().filter(e=>e.kind==="meal"&&e.for===m).map(e=>`<button class="ml-copy mine" data-libm="${e.id}|${m}">+ ${esc(e.name)} · ${fmtK(Math.round(ftot(e.items).kcal))} kcal</button>`).join(""):""}
    ${!its.length&&prev.length?`<button class="ml-copy" data-copy="${m}">Same as yesterday · ${prev.length} item${prev.length>1?"s":""}, ${fmtK(Math.round(ftot(prev).kcal))} kcal</button>`:""}
    ${its.some(x=>!x.fuel)?`<button class="ml-save" data-savem="${m}">Save as my meal</button>`:""}</div>`;
}
const MEAL_ICON={
  b:`<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M12 3v3"/></svg>`,
  l:`<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
  d:`<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>`,
  s:`<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7c-2-2-7-1.5-7 4 0 4 3 9 5 9 1 0 1.3-.5 2-.5s1 .5 2 .5c2 0 5-5 5-9 0-5.5-5-6-7-4zM12 7c0-2 1-4 3-4"/></svg>`};
const TRASH=`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>`;
// swipe a food to the left: the row turns red as it slides, the bin grows, and past the halfway mark it's deleted (with Undo)
function bindSwipeDelete(){
  document.querySelectorAll(".fi-w").forEach(w=>{
    const row=w.querySelector(".fi"),bg=w.querySelector(".fi-bg");let x0=null,y0=0,dx=0,horiz=null,moved=false;
    w.addEventListener("touchstart",e=>{x0=e.touches[0].clientX;y0=e.touches[0].clientY;dx=0;horiz=null;moved=false;row.style.transition="none";},{passive:true});
    w.addEventListener("touchmove",e=>{if(x0==null) return;const mx=e.touches[0].clientX-x0,my=e.touches[0].clientY-y0;
      if(horiz==null&&(Math.abs(mx)>8||Math.abs(my)>8)) horiz=Math.abs(mx)>Math.abs(my)*1.2;
      if(!horiz) return; if(e.cancelable) e.preventDefault(); moved=true;
      dx=Math.min(0,mx);const k=Math.min(1,-dx/(w.offsetWidth*.45));
      row.style.transform=`translateX(${dx}px)`;bg.style.opacity=String(Math.min(1,k*1.4));
      bg.style.background=`rgba(${Math.round(150+90*k)},${Math.round(60-20*k)},${Math.round(70-20*k)},1)`;
      bg.classList.toggle("armed",k>=1);},{passive:false});
    w.addEventListener("touchend",()=>{if(x0==null) return;x0=null;row.style.transition="";
      if(!moved){return;}
      if(-dx>=w.offsetWidth*.45){
        const it=foodDay(foodSel).find(x=>x.id===w.dataset.fw);buzz(14);
        row.style.transform="translateX(-110%)";w.style.height=w.offsetHeight+"px";
        requestAnimationFrame(()=>{w.classList.add("gone");});
        setTimeout(()=>{if(!it) return render();foodSave({id:it.id,date:it.date,del:true,ts:Date.now()});render();
          toast(`Deleted ${it.name}`,"Undo",()=>{foodSave({...it,ts:Date.now()});render();});},260);
      }else{row.style.transform="";bg.style.opacity="0";bg.classList.remove("armed");}
      if(moved) row.dataset.swiped="1";});
    row.addEventListener("click",e=>{if(row.dataset.swiped){delete row.dataset.swiped;e.stopImmediatePropagation();}},true);
  });
}
function copyMeal(m,d){
  const src=foodDay(isoAdd(d,-1)).filter(x=>x.meal===m&&!x.fuel),now=Date.now();
  src.forEach((x,i)=>foodSave({...x,id:uid(),date:d,ts:now+i,at:now+i}));
  buzz(); toast(`Copied ${src.length} item${src.length>1?"s":""} to ${MEAL_NAME[m]}`); renderFood();
}
function goalCard(){
  const gs=goalState();
  if(!gs) return `<section class="sec"><div class="sec-h"><h2>Goal</h2></div><button class="goal-c empty" id="goal-c"><b>Set a weight goal</b><span>Your daily target then follows what you burn, minus the deficit for your pace.</span></button></section>`;
  const {g,w,dir,adj,eta}=gs,from=w!=null?w.toFixed(1):"–";
  const pc=w!=null&&g.start!=null&&g.start!==g.target?clip((g.start-w)/(g.start-g.target)*100,0,100):dir===0?100:0;
  const sub=w==null?"Log your weight to start":dir===0?"Goal reached · eating to maintain":`${g.pace} kg a week · ${fmtK(Math.abs(adj))} kcal/day ${adj<0?"deficit":"surplus"} · around ${fmtDay(eta,{day:"numeric",month:"short"})}`;
  return `<section class="sec"><div class="sec-h"><h2>Goal</h2><span>Tap to edit</span></div><button class="goal-c" id="goal-c">
    <div class="gc-row"><div><small>NOW</small><b>${from}<u>kg</u></b></div><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--faint)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg><div style="text-align:right"><small>GOAL</small><b>${g.target.toFixed(1)}<u>kg</u></b></div></div>
    <div class="en-bar"><i style="width:${pc}%;background:linear-gradient(90deg,#d9c46a,#5fc795)"></i></div><span>${esc(sub)}</span></button></section>`;
}

/* ------------------------------------------------------------ food: target and goal sheets */
function openTarget(d){
  const tg=targetOf(d),gs=goalState(),M=burnModel(),T=trimGet(),W=weightTrend(),B=trimBand(),isToday=d===todayISO();
  if(!tg) return;
  const sg=v=>`${v<0?"−":"+"}${fmtK(Math.abs(v))}`,kgw=v=>Math.abs(v)<.05?"no change":`${v>0?"+":"−"}${Math.abs(v).toFixed(2)} kg a week`;
  const scale=!tg.burn.fixed?"":!W.ok?`It needs at least 4 weigh-ins over two weeks (${W.n} in the last three weeks so far): three or four mornings a week is ideal, same conditions each time. Until then the range stays as it is.`:
    `Your weigh-ins show ${kgw(W.slope)}${B.want?`, against ${kgw(B.want)} planned`:""}. ${T.at?`Last check on ${fmtDay(T.at,{day:"numeric",month:"short"})}: ${T.step>0?`you were losing faster than planned, so every day got ${T.step} kcal more`:T.step<0?`weight was going up, so every day got ${-T.step} kcal less`:T.held==="more"?"weight was going up, but you said you'd eaten more than the plan, so the range stays: coming back inside it is enough":T.held==="less"?"you were losing fast, but you said you'd eaten less than the plan, so the range stays: eat the full plan":"on course, nothing changed"}.`:"The first check comes with the next weigh-in."} Checked once a week, in small steps.`;
  openSheet(`<div class="sh-top"><h2>Daily range</h2>${X}</div>
    <div class="sh-big" style="color:#f59e0b;font-size:46px;white-space:nowrap">${rangeTxt(tg)}<small>kcal</small></div>
    <p class="sh-desc">${!tg.burn.fixed?"Still learning your days: for now it follows Garmin's estimate. After a week of data it becomes a fixed range for each kind of day.":`A range, not a number: neither the watch nor a food diary is precise to the calorie, so landing anywhere inside it is a day done right. ${isToday?"It is set from the training planned for today and changes only once, if the session ends up different.":"Based on the training you did that day."}`}</p>
    <div class="kv">${tg.burn.fixed?`<span>Everyday burn, no training</span><b>${fmtK(M.base)}</b>
      <span>${esc(dayKind(tg.tr))}${tg.tr.pending?" (planned)":""}</span><b>${tg.tr.kcal?sg(tg.tr.kcal):"–"}</b>`:`<span>${tg.burn.proj?"Expected burn":"Burned"}</span><b>${fmtK(tg.burn.v)}</b>`}
      ${tg.goal?`<span>Goal ${tg.goal<0?"deficit":"surplus"} (${gs.g.pace} kg/week)</span><b>${sg(tg.goal)}</b>`:""}
      ${tg.trim?`<span>Correction from your weight</span><b>${sg(tg.trim)}</b>`:""}
      <span>Range</span><b>${rangeTxt(tg)}</b>
      <span>Protein · 1.8 g per kg</span><b>${tg.p} g</b><span>Fat · 27% of energy</span><b>${tg.f} g</b><span>Carbs · the rest</span><b>${tg.c} g</b></div>
    ${tg.burn.fixed?`<p class="sh-note">Everyday burn is the middle value of your last ${M.n} days once training is taken out${tg.tr.names.length?`; ${isToday?"today's":"that day's"} training is ${esc(tg.tr.names.join(", "))}`:""}.</p>
    <h3 class="sh-h3">The scale has the last word</h3>
    <p class="sh-note">${scale}</p>
    ${T.v?`<button class="btn quiet" id="trim-0" style="margin-top:12px">Reset the correction</button>`:""}`:""}`);
  if($("trim-0")) $("trim-0").onclick=()=>{syncSet("rd_trim",{v:0,at:todayISO(),step:0});closeSheet();render();toast("Correction reset");};
}
function openGoal(){
  const g=goalGet(),w=weightNow();let pace=g?.pace||0.5;
  const render=()=>{
    const t=+String($("g-t").value).replace(",",".");
    const ok=t>=35&&t<=200,dir=ok&&w!=null?Math.sign(Math.abs(t-w)<0.3?0:t-w):0;
    const adj=Math.round(dir*pace*KCAL_KG/7/10)*10,weeks=dir?Math.abs(t-w)/pace:0;
    $("g-prev").innerHTML=!ok?"Enter a target between 35 and 200 kg.":w==null?"Log your weight first (Athlete → Weight), so the pace can be worked out.":dir===0?"That's your weight now: the target will simply match what you burn.":
      `<b>${adj<0?"−":"+"}${fmtK(Math.abs(adj))} kcal a day</b> against what you burn · ${Math.abs(t-w).toFixed(1)} kg in about ${Math.round(weeks)} weeks, around <b>${fmtDay(isoAdd(todayISO(),Math.round(weeks*7)),{day:"numeric",month:"long"})}</b>.`;
    document.querySelectorAll("#g-p button").forEach(b=>b.classList.toggle("on",+b.dataset.p===pace));
  };
  openSheet(`<div class="sh-top"><h2>Weight goal</h2>${X}</div>
    <p class="sh-desc">The deficit (or surplus) is taken from what you actually burn each day, so big training days automatically get more food.</p>
    <div class="kv"><span>Weight now</span><b>${w!=null?w.toFixed(1)+" kg":"Not logged"}</b></div>
    <div class="field"><label for="g-t">Target weight (kg)</label><input id="g-t" type="number" inputmode="decimal" step="0.5" min="35" max="200" value="${g?g.target:w!=null?Math.round(w-2):""}"></div>
    <div class="field"><label>Pace</label><div class="seg three" id="g-p">
      <button data-p="0.25"><b>0.25</b><span>Gentle</span></button><button data-p="0.5"><b>0.5</b><span>Steady</span></button><button data-p="0.75"><b>0.75</b><span>Faster</span></button></div>
      <p>kg a week. While training hard, 0.25–0.5 keeps sessions strong: a deep deficit costs power and recovery.</p></div>
    <div class="note-card" id="g-prev" style="margin-top:16px"></div>
    <div class="savebar" style="margin-top:22px"><button class="btn quiet" id="g-del" ${g?"":"hidden"}>Remove goal</button><span class="st" id="g-st"></span><button class="btn" id="g-save">Save goal</button></div>`);
  $("g-t").oninput=render;
  document.querySelectorAll("#g-p button").forEach(b=>b.onclick=()=>{pace=+b.dataset.p;buzz();render();});
  render();
  $("g-save").onclick=()=>{
    const t=+String($("g-t").value).replace(",",".");
    if(!(t>=35&&t<=200)){$("g-st").textContent="Check the target.";return;}
    const obj={target:r1(t),pace,start:g&&g.target===r1(t)?g.start:w,since:g&&g.target===r1(t)?g.since:todayISO(),ts:Date.now()};
    LS.set("rd_goal",JSON.stringify(obj));sendQ("goal",obj);CAL=null;buzz();closeSheet();render();toast("Goal saved");
  };
  $("g-del").onclick=()=>{const obj={target:null,ts:Date.now()};LS.set("rd_goal",JSON.stringify(obj));sendQ("goal",obj);closeSheet();render();toast("Goal removed");};
}

/* ------------------------------------------------------------ food: search and add */
/* ------------------------------------------------------------ food: my meals and recipes */
// Saved meals (one tap logs them all) and recipes (become a food you log by the serving).
function libLocal(){return lsJSON("rd_lib",{});}
function libAll(){
  const m={};
  for(const e of DATA.nutrition?.lib||[]) m[e.id]=e;
  for(const e of Object.values(libLocal())) if(!m[e.id]||(e.ts||0)>=(m[e.id].ts||0)) m[e.id]=e;
  return Object.values(m).filter(e=>!e.del).sort((a,b)=>a.name.localeCompare(b.name));
}
const LIB_KEYS=["name","brand","g","kcal","p","c","f","n","k100","p100","c100","f100","unit","serving","um","uq","src","code"];
function slim(it,full){const o={};for(const k of full?LIB_KEYS:LIB_KEYS.slice(0,full===0?8:7)) if(it[k]!=null&&it[k]!=="") o[k]=it[k];if(it.meal) o.meal=it.meal;return o;}
function libSave(e){
  e={...e,ts:Date.now()};
  if(e.items){e.items=e.items.map(x=>slim(x,true)); if(JSON.stringify(e).length>2600) e.items=e.items.map(x=>slim(x,0)); if(JSON.stringify(e).length>2600) e.items=e.items.map(x=>slim(x,false));
    if(JSON.stringify(e).length>2600) e.items=e.items.map(({brand,...x})=>x);}        // a whole day is long: one message must carry it
  const L=libLocal();L[e.id]=e;LS.set("rd_lib",JSON.stringify(L));sendQ("lib",e);
}
function recipeFood(e){
  const T=ftot(e.items),W=e.weight||e.items.reduce((a,x)=>a+(x.g||0),0)||1;
  const N=e.items.every(x=>x.n)?scaleN(ntot(e.items).sum,100/W):null;
  return {name:e.name,brand:"My recipe",k:Math.round(T.kcal/W*100),p:r1(T.p/W*100),c:r1(T.c/W*100),f:r1(T.f/W*100),n100:N,
    unit:e.servings>0?["serving",Math.round(W/e.servings)]:null,src:"recipe",rid:e.id};
}
function logLibMeal(e,meal,date){
  const now=Date.now();
  e.items.forEach((x,i)=>foodSave({...x,id:uid(),date,meal,at:now+i,ts:now+i}));
  buzz(); toast(`${e.name} added · ${fmtK(Math.round(ftot(e.items).kcal))} kcal`); render();
}
// A usual day: every meal of a day saved together. One tap fills the diary, then only the differences are edited.
function logLibDay(e,date){
  const now=Date.now(),ids=[];
  e.items.forEach((x,i)=>{const id=uid();ids.push(id);foodSave({...x,id,date,meal:MEAL_NAME[x.meal]?x.meal:"s",at:now+i,ts:now+i});});
  buzz(); render();
  toast(`${e.name} logged · ${fmtK(Math.round(ftot(e.items).kcal))} kcal`,"Undo",()=>{const ts=Date.now();ids.forEach(id=>foodSave({id,date,del:true,ts}));render();});
}
function openSaveDay(d){
  const its=foodDay(d).filter(x=>!x.fuel),days=libAll().filter(e=>e.kind==="day"),wd=(new Date(d+"T12:00").getDay()+6)%7;
  openSheet(`<div class="sh-top"><h2>Save as a usual day</h2>${X}</div>
    <p class="sh-desc">${its.length} items · ${fmtK(Math.round(ftot(its).kcal))} kcal, ride fuel left out (it comes in by itself). It will sit on top of an empty diary: one tap logs the whole day, then you only fix what was different.</p>
    <div class="field"><label for="sd-n">Name</label><input id="sd-n" type="text" maxlength="40" value="${wd<5?"Weekday":"Weekend"}"></div>
    <p class="src" id="sd-h" style="margin:8px 0 0"></p>
    <div class="savebar" style="margin-top:22px"><span></span><button class="btn" id="sd-s">Save</button></div>`);
  const same=()=>days.find(e=>norm(e.name)===norm($("sd-n").value.trim()));
  const hint=()=>{$("sd-h").textContent=same()?"You already have a day with this name: saving replaces it.":"";};
  $("sd-n").oninput=hint; hint();
  $("sd-s").onclick=()=>{const old=same();libSave({id:old?old.id:uid(),kind:"day",name:$("sd-n").value.trim()||"My day",items:its});buzz();closeSheet();render();toast("Saved to My days");};
}
function openLibDay(e){
  const d=foodSel||todayISO(),t=todayISO(),lab=d===t?"today":d===isoAdd(t,-1)?"yesterday":fmtDay(d,{weekday:"short",day:"numeric",month:"short"});
  const draw=()=>{
    openSheet(`<div class="sh-top"><h2>Usual day</h2>${X}</div>
      <div class="field"><label for="ld-n">Name</label><input id="ld-n" type="text" maxlength="40" value="${esc(e.name)}"></div>
      <h3 class="sh-sub">${fmtK(Math.round(ftot(e.items).kcal))} kcal · ${e.items.length} items</h3>
      ${MEALS.map(([m])=>e.items.map((x,i)=>x.meal===m||(m==="s"&&!MEAL_NAME[x.meal])?`<div class="ent"><span><i class="ent-m">${MEAL_TAG[m]}</i>${esc(x.name)}${x.g?` · ${x.g} g`:""}</span><b>${fmtK(Math.round(x.kcal))}</b><button data-rm="${i}">Remove</button></div>`:"").join("")).join("")}
      <button class="btn" id="ld-log" style="width:100%;margin-top:16px">Log it ${lab}</button>
      <div class="savebar" style="margin-top:14px"><button class="btn quiet" id="ld-del">Delete</button><button class="btn quiet" id="ld-s">Save changes</button></div>`);
    $("sheet").querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>{e.name=$("ld-n").value;e.items.splice(+b.dataset.rm,1);draw();});
    $("ld-s").onclick=()=>{e.name=$("ld-n").value.trim()||e.name;if(!e.items.length) return;libSave(e);buzz();openLibrary();render();};
    $("ld-del").onclick=()=>{libSave({id:e.id,del:true,name:e.name});closeSheet();render();toast(`Deleted ${e.name}`);};
    $("ld-log").onclick=()=>{closeSheet();logLibDay(e,d);};
  };
  draw();
}
function openSaveMeal(m,d){
  const its=foodDay(d).filter(x=>x.meal===m&&!x.fuel);
  openSheet(`<div class="sh-top"><h2>Save as my meal</h2>${X}</div>
    <p class="sh-desc">${its.length} item${its.length>1?"s":""} · ${fmtK(Math.round(ftot(its).kcal))} kcal. It will appear in ${MEAL_NAME[m]}, ready to log with one tap.</p>
    <div class="field"><label for="sm-n">Name</label><input id="sm-n" type="text" maxlength="40" value="My ${MEAL_NAME[m].toLowerCase().replace(/s$/,"")}"></div>
    <div class="savebar" style="margin-top:22px"><span></span><button class="btn" id="sm-s">Save</button></div>`);
  $("sm-s").onclick=()=>{libSave({id:uid(),kind:"meal",for:m,name:$("sm-n").value.trim()||"My meal",items:its});buzz();closeSheet();render();toast("Saved to My meals");};
}
function openLibrary(){
  const L=libAll(),row=e=>`<button class="fr-row" data-lib="${e.id}"><span class="fn">${esc(e.name)}<small>${e.kind==="recipe"?`Recipe · ${e.items.length} ingredients${e.servings?` · ${e.servings} servings`:""}`:e.kind==="day"?`Whole day · ${e.items.length} items`:`${MEAL_NAME[e.for]||"Meal"} · ${e.items.length} items`}</small></span>
    <b>${fmtK(Math.round(e.kind==="recipe"?recipeFood(e).k:ftot(e.items).kcal))}<u>${e.kind==="recipe"?"/100 g":"kcal"}</u></b></button>`;
  const meals=L.filter(e=>e.kind==="meal"),recs=L.filter(e=>e.kind==="recipe"),days=L.filter(e=>e.kind==="day");
  openSheet(`<div class="sh-top"><h2>My days, meals &amp; recipes</h2>${X}</div>
    <p class="sh-desc">Save a whole day from the diary with "Save this day as a usual day", or one meal with "Save as my meal". Recipes become a food you log by the serving.</p>
    <button class="btn" id="lb-new" style="width:100%">New recipe</button>
    ${days.length?`<h3 class="sh-sub">My days</h3>${days.map(row).join("")}`:""}
    ${meals.length?`<h3 class="sh-sub">My meals</h3>${meals.map(row).join("")}`:""}
    ${recs.length?`<h3 class="sh-sub">Recipes</h3>${recs.map(row).join("")}`:""}`);
  $("lb-new").onclick=()=>openRecipe({id:uid(),kind:"recipe",name:"",servings:4,items:[],isNew:true});
  $("sheet").querySelectorAll("[data-lib]").forEach(b=>b.onclick=()=>{const e=L.find(x=>x.id===b.dataset.lib);e.kind==="recipe"?openRecipe(structuredClone(e)):e.kind==="day"?openLibDay(structuredClone(e)):openLibMeal(structuredClone(e));});
}
function openLibMeal(e){
  const draw=()=>{
    openSheet(`<div class="sh-top"><h2>Edit meal</h2>${X}</div>
      <div class="field"><label for="lm-n">Name</label><input id="lm-n" type="text" maxlength="40" value="${esc(e.name)}"></div>
      <div class="field"><label>Shows up in</label><div class="seg four" id="lm-m">${MEALS.map(([m,n])=>`<button data-m="${m}" class="${m===e.for?"on":""}">${n}</button>`).join("")}</div></div>
      <h3 class="sh-sub">${fmtK(Math.round(ftot(e.items).kcal))} kcal</h3>
      ${e.items.map((x,i)=>`<div class="ent"><span>${esc(x.name)}${x.g?` · ${x.g} g`:""}</span><b>${fmtK(Math.round(x.kcal))}</b><button data-rm="${i}">Remove</button></div>`).join("")}
      <div class="savebar" style="margin-top:22px"><button class="btn quiet" id="lm-del">Delete</button><button class="btn" id="lm-s">Save</button></div>`);
    $("lm-m").querySelectorAll("button").forEach(b=>b.onclick=()=>{e.for=b.dataset.m;e.name=$("lm-n").value;draw();});
    $("sheet").querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>{e.name=$("lm-n").value;e.items.splice(+b.dataset.rm,1);draw();});
    $("lm-s").onclick=()=>{e.name=$("lm-n").value.trim()||e.name;if(!e.items.length) return;libSave(e);buzz();openLibrary();render();};
    $("lm-del").onclick=()=>{libSave({id:e.id,del:true,name:e.name});closeSheet();render();toast(`Deleted ${e.name}`);};
  };
  draw();
}
function openRecipe(e){
  const keep=()=>{e.name=$("rc-n").value;e.servings=+$("rc-s").value||0;e.weight=+$("rc-w").value||null;};
  const T=ftot(e.items),rf=e.items.length?recipeFood(e):null,per=e.servings>0?T.kcal/e.servings:null;
  openSheet(`<div class="sh-top"><h2>${e.isNew?"New recipe":"Recipe"}</h2>${X}</div>
    <div class="field"><label for="rc-n">Name</label><input id="rc-n" type="text" maxlength="40" value="${esc(e.name)}" placeholder="e.g. Grandma's jam tart"></div>
    <div class="qa-m" style="grid-template-columns:1fr 1fr"><div class="field"><label for="rc-s">Servings</label><input id="rc-s" type="number" inputmode="numeric" min="1" max="50" value="${e.servings||""}"></div>
      <div class="field"><label for="rc-w">Cooked weight (g)</label><input id="rc-w" type="number" inputmode="numeric" min="1" value="${e.weight||""}" placeholder="optional"></div></div>
    <p class="src" style="margin:8px 0 0">Weigh the finished dish if you can: cooking changes the weight (pasta absorbs water, a cake loses it).</p>
    <h3 class="sh-sub">Ingredients${e.items.length?` · ${fmtK(Math.round(T.kcal))} kcal`:""}</h3>
    ${e.items.map((x,i)=>`<div class="ent"><span>${esc(x.name)}${x.g?` · ${x.g} g`:""}</span><b>${fmtK(Math.round(x.kcal))}</b><button data-rm="${i}">Remove</button></div>`).join("")}
    <button class="btn quiet" id="rc-add" style="width:100%;margin-top:12px">+ Add ingredients</button>
    ${rf?`<div class="kv" style="margin-top:16px">${per?`<span>Per serving (${rf.unit?rf.unit[1]:"–"} g)</span><b>${fmtK(Math.round(per))} kcal</b>`:""}<span>Per 100 g</span><b>${fmtK(rf.k)} kcal · P ${rf.p} · C ${rf.c} · F ${rf.f}</b></div>`:""}
    <div class="savebar" style="margin-top:20px">${e.isNew?"<span></span>":`<button class="btn quiet" id="rc-del">Delete</button>`}<button class="btn" id="rc-save">Save recipe</button></div>`);
  $("rc-add").onclick=()=>{keep();openAddFood(null,null,{mode:"recipe",recipe:e});};
  $("sheet").querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>{keep();e.items.splice(+b.dataset.rm,1);openRecipe(e);});
  $("rc-save").onclick=()=>{keep();if(!e.name.trim()||!e.items.length){toast("Give it a name and at least one ingredient");return;}
    const {isNew,...rest}=e;libSave(rest);buzz();openLibrary();render();toast("Recipe saved");};
  const d=$("rc-del"); if(d) d.onclick=()=>{libSave({id:e.id,del:true,name:e.name});openLibrary();render();};
}

/* ------------------------------------------------------------ food: search */
let offCtl=null,offTimer=null,genTimer=null;const offCache=new Map();
const stem=w=>w.length>4?w.slice(0,-1):w;
function scoreFood(q,f){
  const ws=norm(q).split(/[^a-z0-9]+/).filter(w=>w.length>1); if(!ws.length) return 0;
  const toks=(norm(f.name)+" "+norm(f.alias||"")+" "+norm(f.brand||"")).split(/[^a-z0-9]+/).filter(Boolean);
  let hit=0; for(const w of ws){const s=stem(w); if(toks.some(t=>t.startsWith(s)||(t.length>3&&s.startsWith(stem(t))))) hit++;}
  if(hit<ws.length) return hit/ws.length*.5;
  // the same word (singular/plural, uovo/uova) counts as exact; plainer, shorter names come first
  const same=(t,w)=>t===w||t.replace(/s$/,"")===w.replace(/s$/,"")||(t.length>=4&&w.length>=4&&t.slice(0,-1)===w.slice(0,-1));
  const n=norm(f.name),exact=ws.filter(w=>toks.some(t=>same(t,w))).length;
  return 2+exact*.4+(n.startsWith(ws[0])?.5:0)+(same(norm(f.alias||"").split(/[^a-z0-9]+/)[0]||"",ws[0])?.6:0)-Math.min(.9,n.length/40);
}
function myFoods(){return libAll().filter(e=>e.kind==="recipe").map(recipeFood);}
function localSearch(q,n=14){
  return [...myFoods(),...FOOD_REF,...fdbAll()].map(f=>({f,s:scoreFood(q,f)})).filter(x=>x.s>=1).sort((a,b)=>b.s-a.s).slice(0,n).map(x=>x.f);
}
function bestMatch(q){
  const pool=[...myFoods(),...recents().map(itemFood),...FOOD_REF,...fdbAll()];
  let best=null,bs=0; for(const f of pool){const s=scoreFood(q,f); if(s>bs){bs=s;best=f;}}
  return bs>=1?best:null;
}
// The AI reads what you ate (food, grams, meal); the numbers come from the tables whenever a food is there.
// Each AI item carries "db", the plain name a nutrition table would use for that food in that state (raw, dry, cooked).
// When the table, your recipes or the food database the app has built find it with every word matching, its values per
// 100 g replace the AI's guess; a match that disagrees wildly with the AI (cooked vs dry pasta) is not trusted.
function groundFood(q){
  if(!q) return null;
  let best=null,bs=0;
  for(const f of [...myFoods(),...FOOD_REF,...fdbAll()]){const s=scoreFood(q,f);if(s>bs){bs=s;best=f;}}
  return bs>=2?best:null;
}
function groundAI(x){
  const g=+x.grams;if(!(g>0)) return x;
  const f=groundFood(x.db)||groundFood(x.name);if(!f||!(f.k>0)) return x;
  const k=f.k*g/100,ai=+x.kcal||0;
  if(ai>0&&(k>ai*2||k<ai/2)) return x;
  const N=f.n100?scaleN(f.n100,g/100):null;
  return {...x,kcal:Math.round(k),protein:r1(f.p*g/100),carbs:r1(f.c*g/100),fat:r1(f.f*g/100),n:N||x.n,nutrients:N?null:x.nutrients,ground:f.src==="ref"?"table":f.src==="ai"?"saved estimate":"your recipe"};
}
// Foods the built-in table doesn't have are looked up with the AI (generic foods and dishes, per 100 g, with their
// natural unit) and remembered on the phone: the second time a food is there at once, also offline and in Speak / Paste list.
let FDB=null;const FDB_MAX=1200,fdbBusy=new Map();
function fdbAll(){if(!FDB){const j=lsJSON("rd_fdb",null);FDB=j&&Array.isArray(j.f)?j:{f:[],q:{}};} return FDB.f;}
function fdbPut(q,foods){
  fdbAll();const nq=norm(q).trim();
  for(const f of foods){const i=FDB.f.findIndex(x=>norm(x.name)===norm(f.name));
    if(i>=0){const old=FDB.f[i];if(!(" "+old.alias+" ").includes(" "+nq+" ")) old.alias=(old.alias+" "+nq).trim().slice(0,120);}
    else FDB.f.push({...f,alias:nq});}
  if(FDB.f.length>FDB_MAX) FDB.f.splice(0,FDB.f.length-FDB_MAX);
  FDB.q[nq]=Date.now();const ks=Object.keys(FDB.q);if(ks.length>600) delete FDB.q[ks[0]];
  LS.set("rd_fdb",JSON.stringify(FDB));
}
const fdbAsked=q=>{fdbAll();return !!FDB.q[norm(q).trim()];};
function aiRefFood(x){
  const k=+x.kcal,p=+x.protein||+x.p||0,c=+x.carbs||+x.c||0,f=+x.fat||+x.f||0,name=String(x.name||"").trim().slice(0,60);
  // a row must be a plausible "per 100 g": the energy has to agree with the macros
  if(!name||!(k>=0&&k<=900)||p+c+f>101) return null;
  const est=4*p+4*c+9*f; if(k>40&&(est<k*.55||est>k*1.45)) return null;
  const ug=+x.unit_g,u=String(x.unit||"").trim().toLowerCase().slice(0,14);
  return {name,alias:"",brand:"",k:Math.round(k),p:r1(p),c:r1(c),f:r1(f),unit:u&&ug>0&&ug<1500&&u!=="g"?[u,Math.round(ug)]:null,n100:normN(x.nutrients),src:"ai"};
}
function aiSearch(q){
  const nq=norm(q).trim(); if(fdbBusy.has(nq)) return fdbBusy.get(nq);
  const run=(async()=>{
    const {json}=await aiCall([{role:"user",parts:[{text:`Food database lookup. The user searched: "${q}" (Italian or English).
List up to 6 foods they may mean, most likely first: the plain generic food or homemade/restaurant dish as eaten, then its common variants (baked vs fried, plain vs filled, raw vs cooked, with or without oil). A branded product only if the search names the brand.
Values per 100 g, realistic and consistent (Italian CREA tables, USDA, real labels; kcal must agree with protein, carbs and fat). "unit": the natural way to count it, English singular (slice, piece, pot, cup, portion, biscuit…), and "unit_g" its typical weight in grams; for a dish use "portion".
Names short and specific, in the language of the search. If it is not a food reply {"foods":[]}.
JSON only: {"foods":[{"name":"","kcal":0,"protein":0,"carbs":0,"fat":0,"unit":"","unit_g":0,${NUT_JSON.replace("for the portion","per 100 g")}}]}`}]}],20000);
    const out=(Array.isArray(json)?json:json.foods||json.items||[]).map(aiRefFood).filter(Boolean).slice(0,6);
    fdbPut(q,out);return out;
  })();
  fdbBusy.set(nq,run);run.catch(()=>{}).finally(()=>fdbBusy.delete(nq));
  return run;
}
function offFood(p){
  const n=p.nutriments||{},k=n["energy-kcal_100g"]??(n["energy_100g"]!=null?n["energy_100g"]/4.184:null);
  const name=p.product_name_it||p.product_name||p.product_name_en; if(!name||k==null) return null;
  // a label is trusted only when protein, carbs and fat are all there and the energy agrees with them
  const P=+n.proteins_100g,C=+n.carbohydrates_100g,F=+n.fat_100g,full=[n.proteins_100g,n.carbohydrates_100g,n.fat_100g].every(v=>v!=null&&v!==""&&isFinite(+v));
  const est=4*P+4*C+9*F,ok=full&&k<=900&&P+C+F<=101&&(k<=40||(est>=k*.6&&est<=k*1.4));
  const brand=Array.isArray(p.brands)?p.brands[0]:String(p.brands||"").split(",")[0].trim();
  const sv=+p.serving_quantity;
  // Open Food Facts stores minerals and vitamins in grams per 100 g
  const M={sugars:["sugars",1],fiber:["fiber",1],satfat:["saturated-fat",1],monofat:["monounsaturated-fat",1],polyfat:["polyunsaturated-fat",1],chol:["cholesterol",1e3],
    sodium:["sodium",1e3],potassium:["potassium",1e3],calcium:["calcium",1e3],iron:["iron",1e3],magnesium:["magnesium",1e3],zinc:["zinc",1e3],
    vita:["vitamin-a",1e6],vitc:["vitamin-c",1e3],vitd:["vitamin-d",1e6],vite:["vitamin-e",1e3],b12:["vitamin-b12",1e6],folate:["vitamin-b9",1e6]};
  const N={};for(const [key,[f,m]] of Object.entries(M)){const v=n[f+"_100g"];if(v!=null&&v!==""&&isFinite(+v)) N[key]=+v*m;}
  if(N.sodium==null&&n.salt_100g!=null&&isFinite(+n.salt_100g)) N.sodium=+n.salt_100g/2.5*1e3;
  return {name:String(name).trim(),brand:brand||"",k:Math.round(k),p:r1(+n.proteins_100g||0),c:r1(+n.carbohydrates_100g||0),f:r1(+n.fat_100g||0),
    n100:scaleN(N,1),serving:sv>0&&sv<2000?sv:null,src:"off",code:p.code||null,ok};
}
const OFF_F="code,product_name,product_name_it,product_name_en,brands,nutriments,serving_quantity";
async function offSearch(q,signal){
  if(offCache.has(q)) return offCache.get(q);
  const t=(u,pick)=>fetch(u,{signal}).then(r=>{if(!r.ok) throw new Error(r.status);return r.json();}).then(j=>{const h=(pick(j)||[]).map(offFood).filter(Boolean);if(!h.length) throw new Error("empty");return h;});
  // both Open Food Facts search services at once: the first useful answer wins
  const res=await Promise.any([
    t(`https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=24&langs=it,en&fields=${OFF_F}`,j=>j.hits),
    t(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=24&lc=it&fields=${OFF_F}`,j=>j.products),
    new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")),12000))]).catch(e=>{if(signal.aborted) throw new DOMException("","AbortError");return [];});
  const seen=new Set(),clean=res.filter(f=>{const key=norm(f.name+"|"+f.brand);if(seen.has(key)||!f.ok) return false;seen.add(key);return true;})
    .map((f,i)=>({f,s:scoreFood(q,f)-i/100})).sort((a,b)=>b.s-a.s).map(x=>x.f);
  if(clean.length) offCache.set(q,clean);
  return clean;
}
async function offBarcode(code){
  const r=await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_F}`);
  if(!r.ok) return null; const j=await r.json(); return j.status===1&&j.product?offFood({...j.product,code}):null;
}
const foodRow=(f,i)=>`<button class="fr-row" data-fr="${i}"><span class="fn">${esc(f.name)}<small>${f.quick?"Quick add":[f.brand,f.src==="ai"?"AI estimate":"",f.unit?`1 ${f.unit[0]} = ${f.unit[1]} g`:"",f.serving&&!f.unit?`serving ${fmtNum(f.serving)} g`:""].filter(Boolean).map(esc).join(" · ")||"per 100 g"}</small></span>
  <b>${f.quick?fmtK(Math.round(f.kcal)):fmtK(f.k)}<u>${f.quick?"kcal":"/100 g"}</u></b></button>`;
const withN=f=>f.n100||f.quick?f:{...f,n100:nCache(f.name)};
const fromFood=(f0,g,meal,f=withN(f0))=>({meal,name:f.name,brand:f.brand||"",g:Math.round(g),kcal:Math.round(f.k*g/100),p:r1(f.p*g/100),c:r1(f.c*g/100),f:r1(f.f*g/100),
  k100:f.k,p100:f.p,c100:f.c,f100:f.f,n100:f.n100||null,n:scaleN(f.n100,g/100),unit:f.unit||null,serving:f.serving||null,src:f.src,code:f.code||null});

/* ------------------------------------------------------------ food: add sheet with a tray */
// Pick as many foods as you like: they wait in the tray at the bottom and are saved together.
let ADD=null;
const trayTot=()=>ftot(ADD.tray.filter(x=>x.kcal!=null));
function openAddFood(meal,date,o={}){
  const mode=o.mode||"diary";
  if(!(ADD&&ADD.tray.length&&ADD.mode===mode&&ADD.date===date&&(mode!=="recipe"||ADD.recipe===o.recipe))) ADD={meal,date,mode,tray:[],q:"",recipe:o.recipe||null};
  if(meal) ADD.meal=meal; if(o.q!=null) ADD.q=o.q;
  addView();
}
function trayHTML(){
  if(!ADD.tray.length) return "";
  const n=ADD.tray.length;
  return `<div class="tray" id="tray"><button class="tr-l" id="tr-rev"><b>${n} item${n>1?"s":""}</b><span>${fmtK(Math.round(trayTot().kcal))} kcal · review</span></button>
    <button class="btn" id="tr-save">${ADD.mode==="recipe"?"Add to recipe":"Save all"}</button></div>`;
}
function bindTray(){
  const r=$("tr-rev"); if(r) r.onclick=trayView;
  const s=$("tr-save"); if(s) s.onclick=commitTray;
}
function addView(){
  const A=ADD,diary=A.mode==="diary",SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  let list=[];
  openSheet(`<div class="sh-top"><h2>${diary?"Add food":"Add ingredients"}</h2>${X}</div>
    ${diary?`<div class="seg four" id="af-m">${MEALS.map(([m,n])=>`<button data-m="${m}" class="${m===A.meal?"on":""}">${n}</button>`).join("")}</div>`:""}
    <div class="af-bar"><div class="af-in"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input id="af-q" type="search" placeholder="Search food or brand" autocomplete="off" enterkeyhint="search" value="${esc(A.q)}"></div>
      ${"BarcodeDetector" in window?`<button class="af-ic" id="af-scan" aria-label="Scan a barcode"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 8V5h3M20 8V5h-3M4 16v3h3M20 16v3h-3M8 9v6M11 9v6M14 9v6M17 9v6"/></svg></button>`:""}</div>
    ${diary?`<div class="af-acts">
      <button id="af-photo"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>Photo</button>
      <button id="af-voice"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>${SR?"Speak":"Type"}</button>
      <button id="af-paste"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/></svg>Paste list</button>
      <button id="af-quick"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3L5 13h6l-1 8 8-10h-6z"/></svg>Quick</button>
      <input type="file" id="af-file" accept="image/*" capture="environment" hidden></div>`:""}
    <div id="af-res"></div>${trayHTML()}`);
  const show=q=>{
    const rec=recents(),nq=norm(q),lib=libAll();let html="";list=[];
    const add=(title,arr)=>{if(!arr.length) return;html+=`<h3 class="sh-sub">${title}</h3>`+arr.map(f=>foodRow(f,list.push(f)-1)).join("");};
    if(!q.trim()){
      const meals=diary?lib.filter(e=>e.kind==="meal"):[];
      if(meals.length) html+=`<h3 class="sh-sub">My meals</h3>`+meals.map(e=>`<button class="fr-row" data-lm="${e.id}"><span class="fn">${esc(e.name)}<small>${e.items.map(x=>x.name).slice(0,4).map(esc).join(", ")}</small></span><b>${fmtK(Math.round(ftot(e.items).kcal))}<u>kcal</u></b></button>`).join("");
      add("My recipes",myFoods());
      add("Recent",rec.slice(0,20).map(itemFood));
    }else{
      add("Recent",rec.filter(it=>norm(it.name+" "+(it.brand||"")).includes(nq)).slice(0,5).map(itemFood));
      add("Basics",localSearch(q));
      if(aiKey()&&q.trim().length>=3&&!fdbAsked(q)) html+=`<div id="af-gen"><p class="af-wait"><i class="spin"></i>Looking up more foods…</p></div>`;
      html+=`<div id="af-off">${q.trim().length>=3?`<p class="af-wait"><i class="spin"></i>Searching Open Food Facts…</p>`:""}</div>`;
      if(aiKey()&&diary) html+=`<button class="af-ai" id="af-ai">✦ Estimate “${esc(q.trim())}” with AI</button>`;
    }
    if(!html) html=`<p class="sh-note" style="margin-top:16px">Search a food, scan a barcode, or describe your meal with Photo, Speak or Paste list.</p>`;
    $("af-res").innerHTML=html;bindRows();
  };
  const bindRows=()=>{
    $("af-res").querySelectorAll("[data-fr]").forEach(b=>b.onclick=()=>{const f=list[+b.dataset.fr];
      f.quick?openQuick(A.meal,A.date,{name:f.name,kcal:f.kcal,p:f.p,c:f.c,f:f.f}):openPortion(f,{tray:true});});
    $("af-res").querySelectorAll("[data-lm]").forEach(b=>b.onclick=()=>{const e=libAll().find(x=>x.id===b.dataset.lm);
      e.items.forEach(x=>A.tray.push({...x,meal:A.meal}));buzz();addView();});
    const ai=$("af-ai"); if(ai) ai.onclick=()=>smartRun(A.q,"text");
  };
  const q=$("af-q");
  const search=v=>{show(v);clearTimeout(offTimer);clearTimeout(genTimer);if(offCtl) offCtl.abort();
    if(v.trim().length<3) return;
    // the AI lookup waits for a pause in typing, so half-written words don't use up the free requests
    if($("af-gen")) genTimer=setTimeout(async()=>{
      let res=[];try{res=await aiSearch(v.trim());}catch(e){}
      const box=$("af-gen");if(!box||q.value!==v) return;
      const have=new Set(list.map(f=>norm(f.name)));res=res.filter(f=>!have.has(norm(f.name)));
      box.innerHTML=res.length?`<h3 class="sh-sub">More foods</h3>`+res.map(f=>foodRow(f,list.push(f)-1)).join(""):"";bindRows();},900);
    offTimer=setTimeout(async()=>{offCtl=new AbortController();
      try{const res=await offSearch(v.trim(),offCtl.signal);const box=$("af-off");if(!box||q.value!==v) return;
        if(!res.length){box.innerHTML=`<p class="af-wait">No products found on Open Food Facts${navigator.onLine?"":" (offline)"}.</p>`;return;}
        box.innerHTML=`<h3 class="sh-sub">Products</h3>`+res.map(f=>foodRow(f,list.push(f)-1)).join("");bindRows();}
      catch(e){}},offCache.has(v.trim())?0:450);};
  q.oninput=()=>{A.q=q.value;search(q.value);};
  if(diary) $("af-m").querySelectorAll("button").forEach(b=>b.onclick=()=>{A.meal=b.dataset.m;
    A.tray.forEach(x=>{if(!x.fixed) x.meal=A.meal;});$("af-m").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));});
  const sc=$("af-scan"); if(sc) sc.onclick=()=>openScanner();
  if(diary){
    $("af-quick").onclick=()=>openQuick(A.meal,A.date);
    $("af-paste").onclick=()=>openSmart(false);
    $("af-voice").onclick=()=>openSmart(!!SR);
    $("af-photo").onclick=()=>{if(!aiKey()) return aiNeeded("Recognising food from a photo");$("af-file").click();};
    $("af-file").onchange=e=>{const f=e.target.files[0];if(f) smartPhoto(f);};
  }
  bindTray();
  search(A.q);
  if(!A.tray.length&&!A.q) setTimeout(()=>q.focus({preventScroll:true}),320);
}
function trayView(){
  const A=ADD,diary=A.mode==="diary";
  if(!A.tray.length) return addView();
  openSheet(`<div class="sh-top"><h2>Review</h2>${X}</div>
    <p class="sh-desc">${diary?"Tap the meal tag to move an item; change grams if needed.":"These go into the recipe."}</p>
    <div id="tv">${A.tray.map((x,i)=>`<div class="tv-r${x.kcal==null?" miss":""}">
      ${diary?`<button class="tv-m" data-mm="${i}">${MEAL_TAG[x.meal||A.meal]}</button>`:""}
      <span class="tv-n">${esc(x.name)}<small>${x.kcal==null?"Not found":x.guess?"Amount estimated":x.src==="ai"?(x.note?"AI: "+esc(x.note):"AI estimate"):x.brand?esc(x.brand):""}</small></span>
      ${x.kcal==null?`<button class="btn quiet tv-f" data-find="${i}">Search</button>`:`<input class="tv-g" data-g="${i}" type="number" inputmode="numeric" value="${x.g??""}" placeholder="–" ${x.g?"":"disabled"}><em>g</em><b data-k="${i}">${fmtK(Math.round(x.kcal))}</b>`}
      <button class="tv-x" data-rm="${i}" aria-label="Remove">×</button></div>`).join("")}</div>
    <div class="kv" style="margin-top:14px"><span>Total</span><b id="tv-t">${fmtK(Math.round(trayTot().kcal))} kcal</b></div>
    <div class="savebar" style="margin-top:16px"><button class="btn quiet" id="tv-more">Add more</button><button class="btn" id="tv-save">${diary?"Save all":"Add to recipe"}</button></div>`);
  $("tv").querySelectorAll("[data-mm]").forEach(b=>b.onclick=()=>{const x=A.tray[+b.dataset.mm],i=MEALS.findIndex(m=>m[0]===(x.meal||A.meal));
    x.meal=MEALS[(i+1)%4][0];x.fixed=true;b.textContent=MEAL_TAG[x.meal];buzz(4);});
  $("tv").querySelectorAll("[data-g]").forEach(inp=>inp.oninput=()=>{const x=A.tray[+inp.dataset.g],g=+inp.value;if(!(g>0)||!x.g) return;
    const k=g/x.g;for(const key of ["kcal","p","c","f"]) x[key]=key==="kcal"?x.kcal*k:r1(x[key]*k);if(x.n) x.n=scaleN(x.n,k);x.g=g;x.guess=false;
    $("tv").querySelector(`[data-k="${inp.dataset.g}"]`).textContent=fmtK(Math.round(x.kcal));$("tv-t").textContent=fmtK(Math.round(trayTot().kcal))+" kcal";});
  $("tv").querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>{A.tray.splice(+b.dataset.rm,1);trayView();});
  $("tv").querySelectorAll("[data-find]").forEach(b=>b.onclick=()=>{const x=A.tray.splice(+b.dataset.find,1)[0];A.q=x.name;if(x.meal) A.meal=x.meal;addView();});
  $("tv-more").onclick=addView; $("tv-save").onclick=commitTray;
}
function commitTray(){
  const A=ADD,ok=A.tray.filter(x=>x.kcal!=null);
  if(!ok.length) return toast("Nothing to save yet");
  if(A.mode==="recipe"){A.recipe.items.push(...ok.map(({meal,fixed,guess,exact,...x})=>x));ADD=null;return openRecipe(A.recipe);}
  const now=Date.now();
  ok.forEach(({fixed,guess,exact,miss,...x},i)=>foodSave({...x,id:uid(),date:A.date,meal:x.meal||A.meal,at:now+i,ts:now+i}));
  const k=Math.round(ftot(ok).kcal);ADD=null;buzz(12);closeSheet();foodSel=A.date;render();
  toast(`Saved ${ok.length} item${ok.length>1?"s":""} · ${fmtK(k)} kcal`);
}
function openPortion(f,o){
  f=withN(f);
  const units=[["g","g",1]];
  if(f.unit) units.push(["u",f.unit[0],f.unit[1]]);
  if(f.serving&&(!f.unit||f.unit[1]!==f.serving)) units.push(["s","serving",f.serving]);
  let meal=o.meal,mode,qty;
  const last=o.item||f.last;            // editing, or a food from Recent: start from the amount used last time
  if(last&&last.g){mode=last.um||"g";qty=mode==="g"?last.g:last.uq;}
  else if(f.unit){mode="u";qty=1;} else if(f.serving){mode="s";qty=1;} else {mode="g";qty=100;}
  if(!units.find(u=>u[0]===mode)||!(qty>0)){mode="g";qty=last?.g||100;}
  const grams=()=>{const u=units.find(x=>x[0]===mode);return qty*u[2];};
  const calc=()=>{const g=grams();return {g,kcal:f.k*g/100,p:f.p*g/100,c:f.c*g/100,f:f.f*g/100};};
  const upd=()=>{const v=calc();
    $("pp-k").innerHTML=`${fmtK(Math.round(v.kcal))}<small>kcal</small>`;
    $("pp-m").innerHTML=["p","c","f"].map(k=>`<div><i style="background:${MAC[k][1]}"></i><span>${MAC[k][0]}</span><b>${r1(v[k])} g</b></div>`).join("");
    $("pp-g").textContent=mode==="g"?"":`= ${fmtNum(Math.round(v.g))} g`;
    const nn=scaleN(f.n100,v.g/100),px=$("pp-n");
    if(px) px.innerHTML=nn?NUT.filter(x=>nn[x[0]]!=null).map(x=>`<span>${x[1].replace("of which ","")}<b>${nn[x[0]]} ${x[2]}</b></span>`).join(""):"";
    $("pp-add").disabled=!(v.g>0&&v.g<5000);};
  openSheet(`<div class="sh-top"><h2 class="pp-t">${esc(f.name)}</h2>${X}</div>
    <p class="src" style="margin:4px 0 10px">${[f.brand,f.src==="off"?"Open Food Facts":f.src==="ref"?"Reference table":f.src==="ai"?"AI estimate":"",`${fmtK(f.k)} kcal per 100 g`].filter(Boolean).map(esc).join(" · ")}</p>
    <div class="sh-big" id="pp-k" style="color:#f59e0b"></div>
    <div class="en-parts" id="pp-m"></div>
    ${f.n100?`<details class="pp-nd"><summary>More nutrients</summary><div class="pp-n" id="pp-n"></div></details>`:""}
    <div class="pp-amt"><button class="stp" id="pp-minus" aria-label="Less">−</button>
      <input id="pp-q" type="number" inputmode="decimal" step="any" min="0" value="${fmtNum(qty)}">
      <button class="stp" id="pp-plus" aria-label="More">+</button></div>
    <div class="seg pp-u" id="pp-u" style="grid-template-columns:repeat(${units.length},1fr)">${units.map(u=>`<button data-u="${u[0]}" class="${u[0]===mode?"on":""}">${u[0]==="g"?"grams":esc(u[1])+` · ${fmtNum(u[2])} g`}</button>`).join("")}</div>
    <p class="src" id="pp-g" style="text-align:center;margin:8px 0 0"></p>
    ${o.tray?"":`<div class="seg four" id="pp-meal" style="margin-top:18px">${MEALS.map(([m,n])=>`<button data-m="${m}" class="${m===meal?"on":""}">${n}</button>`).join("")}</div>`}
    <div class="savebar" style="margin-top:20px">${o.item?`<button class="btn quiet" id="pp-del">Delete</button>`:o.tray?`<button class="btn quiet" id="pp-back">Back</button>`:"<span></span>"}
      <button class="btn" id="pp-add">${o.item?"Save":o.tray?(ADD.tray.length?`Add · ${ADD.tray.length+1} in tray`:"Add"):"Add to diary"}</button></div>`);
  const q=$("pp-q"),step=()=>mode==="g"?(grams()>=100?10:5):0.5;
  q.oninput=()=>{qty=+String(q.value).replace(",",".")||0;upd();};
  q.onkeydown=e=>{if(e.key==="Enter") $("pp-add").click();};
  $("pp-minus").onclick=()=>{qty=Math.max(0,r1(qty-step()));q.value=fmtNum(qty);buzz(4);upd();};
  $("pp-plus").onclick=()=>{qty=r1(qty+step());q.value=fmtNum(qty);buzz(4);upd();};
  $("pp-u").querySelectorAll("button").forEach(b=>b.onclick=()=>{const g=grams();mode=b.dataset.u;const u=units.find(x=>x[0]===mode);
    qty=mode==="g"?Math.round(g):Math.max(0.5,Math.round(g/u[2]*2)/2);q.value=fmtNum(qty);
    $("pp-u").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));upd();});
  const pm=$("pp-meal"); if(pm) pm.querySelectorAll("button").forEach(b=>b.onclick=()=>{meal=b.dataset.m;pm.querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));});
  const bk=$("pp-back"); if(bk) bk.onclick=addView;
  $("pp-add").onclick=()=>{const v=calc(),now=Date.now();
    const base={name:f.name,brand:f.brand||"",g:Math.round(v.g),kcal:Math.round(v.kcal),p:r1(v.p),c:r1(v.c),f:r1(v.f),
      k100:f.k,p100:f.p,c100:f.c,f100:f.f,n100:f.n100||null,n:scaleN(f.n100,v.g/100),unit:f.unit||null,serving:f.serving||null,um:mode,uq:mode==="g"?null:qty,src:f.src,code:f.code||null};
    if(o.tray){ADD.tray.push({...base,meal:ADD.meal});ADD.q="";buzz();addView();
      const t=$("tray"); if(t){t.classList.remove("pop");void t.offsetWidth;t.classList.add("pop");} return;}
    foodSave({...base,id:o.item?.id||uid(),date:o.date,meal,at:o.item?.at||now,ts:now});buzz();closeSheet();foodSel=o.date;render();
    toast(o.item?"Saved":`Added to ${MEAL_NAME[meal]} · ${fmtK(base.kcal)} kcal`);};
  const del=$("pp-del"); if(del) del.onclick=()=>foodDelete(o.item);
  upd();
}
function foodDelete(it){
  foodSave({id:it.id,date:it.date,del:true,ts:Date.now()});buzz();closeSheet();render();
  toast(`Deleted ${it.name}`,"Undo",()=>{foodSave({...it,ts:Date.now()});render();});
}
function openQuick(meal,date,item){
  const ed=item&&item.id;
  openSheet(`<div class="sh-top"><h2>Quick add</h2>${X}</div>
    <p class="sh-desc">When you only know the calories: a restaurant dish, a homemade recipe, something from a label.</p>
    <div class="field"><label for="qa-n">Name (optional)</label><input id="qa-n" type="text" maxlength="60" value="${esc(item?.name||"")}" placeholder="e.g. Pizza with friends"></div>
    <div class="field"><label for="qa-k">Calories</label><input id="qa-k" type="number" inputmode="numeric" min="1" max="5000" value="${item?.kcal??""}"></div>
    <div class="qa-m">${["p","c","f"].map(k=>`<div class="field"><label for="qa-${k}">${MAC[k][0]} (g)</label><input id="qa-${k}" type="number" inputmode="decimal" min="0" max="500" value="${item?.[k]||""}" placeholder="–"></div>`).join("")}</div>
    ${ed?`<div class="seg four" id="qa-meal" style="margin-top:18px">${MEALS.map(([m,n])=>`<button data-m="${m}" class="${m===meal?"on":""}">${n}</button>`).join("")}</div>`:""}
    <div class="savebar" style="margin-top:20px">${ed?`<button class="btn quiet" id="qa-del">Delete</button>`:`<button class="btn quiet" id="qa-back">Back</button>`}<button class="btn" id="qa-add">${ed?"Save":"Add"}</button></div>`);
  const qm=$("qa-meal"); if(qm) qm.querySelectorAll("button").forEach(b=>b.onclick=()=>{meal=b.dataset.m;qm.querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));});
  const num=id=>+String($(id).value).replace(",",".")||0;
  $("qa-add").onclick=()=>{const k=num("qa-k");if(!(k>0&&k<=5000)){toast("Enter the calories");return;}
    const base={name:$("qa-n").value.trim()||"Quick add",brand:"",g:null,kcal:Math.round(k),p:r1(num("qa-p")),c:r1(num("qa-c")),f:r1(num("qa-f")),src:"quick"};
    if(!ed&&ADD){ADD.tray.push({...base,meal:ADD.meal});buzz();return addView();}
    const now=Date.now();foodSave({...base,id:ed?item.id:uid(),date,meal,at:item?.at||now,ts:now});buzz();closeSheet();render();toast("Saved");};
  const d=$("qa-del"); if(d) d.onclick=()=>foodDelete(item);
  const b=$("qa-back"); if(b) b.onclick=addView;
  setTimeout(()=>$(item?.kcal?"qa-k":"qa-n").focus({preventScroll:true}),320);
}
let camStop=null;
async function openScanner(){
  openSheet(`<div class="sh-top"><h2>Scan barcode</h2>${X}</div>
    <div class="scan"><video id="sc-v" playsinline muted></video><div class="sc-frame"></div></div>
    <p class="sh-note" id="sc-st" style="text-align:center;margin-top:12px">Point the camera at the barcode.</p>
    <button class="btn quiet" id="sc-b" style="width:100%">Back</button>`);
  $("sc-b").onclick=addView;
  let stream=null,alive=true;
  camStop=()=>{alive=false;if(stream) stream.getTracks().forEach(t=>t.stop());camStop=null;};
  try{
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"},audio:false});
    if(!alive){stream.getTracks().forEach(t=>t.stop());return;}
    const v=$("sc-v");v.srcObject=stream;await v.play();
    const det=new BarcodeDetector({formats:["ean_13","ean_8","upc_a","upc_e"]});
    while(alive){
      const codes=await det.detect(v).catch(()=>[]);
      if(codes.length){const code=codes[0].rawValue;camStop();buzz(20);$("sc-st").textContent="Looking it up…";
        const f=await offBarcode(code).catch(()=>null);
        if(f) openPortion(f,{tray:true});
        else{$("sc-st").innerHTML=`Product ${esc(code)} isn't on Open Food Facts yet.<br><button class="btn quiet" id="sc-q" style="margin-top:12px">Quick add instead</button>`;$("sc-q").onclick=()=>openQuick(ADD.meal,ADD.date);}
        return;}
      await new Promise(r=>setTimeout(r,180));
    }
  }catch(e){camStop&&camStop();const s=$("sc-st");if(s) s.textContent="The camera isn't available: allow it for Readiness in the phone settings, or search by name.";}
}

/* ------------------------------------------------------------ food: paste a list, speak, photo */
const MEAL_RE=[["b",/(breakfast|colazione)/i],["l",/(lunch|pranzo)/i],["d",/(dinner|cena)/i],["s",/(snacks?|spuntin[oi]|merend[ae])/i]];
const mealOf=s=>{const m=MEAL_RE.find(([,re])=>re.test(s));return m?m[0]:null;};
const NUMW={"un'":1,un:1,uno:1,una:1,mezzo:.5,mezza:.5,due:2,tre:3,quattro:4,cinque:5,sei:6,sette:7,otto:8,a:1,an:1,one:1,two:2,three:3,four:4,half:.5};
let AND_PHRASES=null;
function protectAnd(s){   // keep dishes like "pasta e fagioli" or "cacio e pepe" in one piece
  if(!AND_PHRASES){AND_PHRASES=new Set();for(const f of FOOD_REF){const t=norm(f.name+" "+f.alias);for(const m of t.matchAll(/([a-z']+) e ([a-z']+)/g)) AND_PHRASES.add(m[0]);}}
  let t=s;for(const p of AND_PHRASES){const re=new RegExp("\\b"+p.replace(/'/g,"'")+"\\b","gi");t=t.replace(re,m=>m.replace(/ e /i," _e_ "));}
  return t;
}
function parseList(text,def){
  let meal=def||"b";const out=[];
  for(const raw of String(text).split(/\n+/)){
    let line=raw.replace(/\*\*|__/g,"").replace(/^[\s\-–—•*·>#]+/,"").trim(); if(!line) continue;
    const hm=line.match(/^([^:\d]{0,32}?)\s*(:|$)/);
    if(hm){const m=mealOf(hm[1]); if(m&&hm[1].trim().split(/\s+/).length<=4){meal=m;line=line.slice(hm[0].length).trim();if(!line) continue;}}
    const structured=/\d\s*kcal/i.test(line);
    const chunks=structured?[line]:protectAnd(line).split(/\s*(?:,|;|\+|\.\s|\be\b|\bed\b|\bpoi\b|\band\b|\bthen\b)\s*/i).map(c=>c.replace(/ _e_ /g," e ")).filter(c=>c.trim());
    for(let ch of chunks){
      const sm=ch.match(/\b(?:a|per|at|for)\s+(colazione|pranzo|cena|merenda|spuntino|breakfast|lunch|dinner|snack)\b/i);
      if(sm){meal=mealOf(sm[1]);ch=ch.replace(sm[0]," ");}
      ch=ch.replace(/\b(stamattina|stasera|oggi|ho mangiato|ho bevuto|ho preso|mangiato|bevuto|i had|i ate|i drank|circa|about|anche)\b/gi," ").trim();
      if(ch.replace(/[^a-zà-ú0-9]/gi,"").length<2) continue;
      out.push(...parseItem(ch,meal));
    }
  }
  return out;
}
function parseItem(s,meal){
  let t=" "+s+" ";const N="(\\d+(?:[.,]\\d+)?)";
  const grab=re=>{const m=t.match(re);if(!m) return null;t=t.replace(m[0]," ");return +m[1].replace(",",".");};
  const kcal=grab(new RegExp(N+"\\s*kcal","i"));
  const p=grab(new RegExp("\\b(?:p|prot|protein[ei]?|proteine)\\.?\\s*:?\\s*"+N+"\\s*g?(?![a-z])","i"));
  const c=grab(new RegExp("\\b(?:c|carb|carbs|carboidrati)\\.?\\s*:?\\s*"+N+"\\s*g?(?![a-z])","i"));
  const f=grab(new RegExp("\\b(?:f|fat|grassi)\\.?\\s*:?\\s*"+N+"\\s*g?(?![a-z])","i"));
  const g=grab(new RegExp(N+"\\s*(?:g|gr|grammi|grams?|ml)(?![a-z])","i"));
  let qty=null,unitSaid=false;const qm=t.match(/^\s*(\d+(?:[.,]\d+)?|un'|un|uno|una|mezzo|mezza|due|tre|quattro|cinque|sei|sette|otto|an?|one|two|three|four|half)\s+(?:di\s+|d'|of\s+)?/i);
  if(qm){qty=NUMW[qm[1].toLowerCase()]??+qm[1].replace(",",".");t=t.slice(qm[0].length);}
  // "2 fette di pane", "un bicchiere di latte", "1 slice bread": the unit word goes, the food's own unit is used
  const um=t.match(/^\s*(?:(?:fett[ae]|pezz[oi]|bicchier[ei]|tazz[ae]|tazzin[ae]|cucchiai(?:o|ni)?|cucchiain[oi]|porzion[ei]|piatt[oi]|vasett[oi]|scatolett[ae]|manciat[ae]|barrett[ae]|lattin[ae]|bottigli(?:a|e|etta))\s+(?:di\s+|d')|(?:slices?|glass(?:es)?|cups?|pieces?|bowls?|plates?|portions?|tablespoons?|teaspoons?|tbsp|tsp|cans?|handfuls?)\s+(?:of\s+)?)/i);
  if(um){t=t.slice(um[0].length);unitSaid=true;if(qty==null) qty=1;}
  const name=t.replace(/^\s*(?:di|d'|of)\s+/i,"").replace(/[|·•—–()\[\]]/g," ").replace(/\s[-:]\s/g," ").replace(/^[\s,.\-:]+|[\s,.\-:]+$/g,"").replace(/\s+/g," ").trim();
  if(!name) return [];
  const cap=x=>x[0].toUpperCase()+x.slice(1);
  if(kcal!=null) return [{meal,name:cap(name),brand:"",g:g?Math.round(g):null,kcal:Math.round(kcal),p:r1(p||0),c:r1(c||0),f:r1(f||0),
    k100:g?Math.round(kcal/g*100):null,p100:g&&p!=null?r1(p/g*100):null,c100:g&&c!=null?r1(c/g*100):null,f100:g&&f!=null?r1(f/g*100):null,src:"list",exact:true}];
  // whole name first, then shorter versions ("fette biscottate con marmellata" → "fette biscottate"), then each part of "x con y"
  let m=bestMatch(name),used=name;
  if(!m){const parts=name.split(/\s+(?:con|col|coi|with|and)\s+/i);
    if(parts.length>1) return [...parseItem((qty!=null?qty+" ":"")+parts[0]+(g!=null?` ${g} g`:""),meal),...parts.slice(1).flatMap(x=>parseItem(x,meal))];
    const ws=name.split(/\s+/);for(let k=ws.length-1;k>=1&&!m;k--){m=bestMatch(ws.slice(0,k).join(" "));used=ws.slice(0,k).join(" ");}}
  if(!m) return [{meal,name:cap(name),kcal:null,miss:true}];
  const unitG=m.unit?m.unit[1]:m.serving||100;
  const grams=g??(qty!=null?qty*unitG:unitG);
  return [{...fromFood(m,grams,meal),guess:g==null&&qty==null,um:g==null&&qty!=null&&m.unit?"u":"g",uq:g==null&&qty!=null&&m.unit?qty:null}];
}
function openSmart(listen){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  openSheet(`<div class="sh-top"><h2>${listen?"Say what you ate":"Paste or type a list"}</h2>${X}</div>
    <p class="sh-desc">${listen?"Talk as long as you like, pauses included; tap Stop when you're done. E.g. “a colazione 2 fette biscottate con marmellata e un cappuccino, a pranzo 100 grammi di pasta al pomodoro”.":"One food per line. Lines like “Breakfast” or “Pranzo:” set the meal. Paste the list Claude prepares for you and everything goes in at once."}</p>
    <textarea id="sm-t" class="sm-t" placeholder="${listen?"Your words appear here":"Breakfast\nOats, 60 g, 224 kcal, P 8, C 36, F 4\nBanana, 120 g\nLunch\n100 g pasta al pomodoro"}"></textarea>
    <div class="savebar" style="margin-top:14px">${SR?`<button class="btn quiet mic" id="sm-mic">${listen?"Stop":"Dictate"}</button>`:"<span></span>"}<button class="btn" id="sm-go">Read it</button></div>
    <p class="src" style="margin-top:12px">${aiKey()?"Understood by AI (Gemini), with your Basics and recipes as a fallback.":"Read on the phone: foods are matched to the Basics, your recipes and recent foods. For free speech and photos, add a free Gemini key in Settings."}</p>
    <button class="btn quiet" id="sm-b" style="width:100%;margin-top:6px">Back</button>`);
  const ta=$("sm-t"),mic=$("sm-mic");
  const D=dictation(ta,null,on=>{if(mic){mic.textContent=on?"Stop":"Dictate";mic.classList.toggle("on",on);}});
  const stop=()=>D&&D.stop(),start=()=>D&&D.start();
  if(mic) mic.onclick=()=>D.toggle();
  $("sm-go").onclick=()=>{stop();const v=ta.value.trim();if(v) smartRun(v,"text");};
  $("sm-b").onclick=()=>{stop();addView();};
  const old=camStop;camStop=()=>{stop();camStop=old;};
  if(listen&&SR) start(); else setTimeout(()=>ta.focus({preventScroll:true}),320);
}
async function smartRun(text,kind){
  const A=ADD;
  const local=parseList(text,A.meal);
  const exact=local.length&&local.every(x=>x.exact);
  let items=local;
  if(!exact&&aiKey()){
    openSheet(`<div class="sh-top"><h2>Reading…</h2>${X}</div><p class="af-wait" style="justify-content:center;margin:40px 0"><i class="spin"></i>Working out foods and portions</p>`);
    try{items=await aiItems([{text:`The user wrote (Italian or English):\n${text}`}]);}
    catch(e){toast(e.message);items=local;}
  }
  if(!items.length){toast("Nothing recognised: try one food per line");return addView();}
  items.forEach(x=>{x.fixed=true;A.tray.push(x);});
  buzz();trayView();
}
async function smartPhoto(file){
  openSheet(`<div class="sh-top"><h2>Looking at your plate…</h2>${X}</div><img id="ph-i" class="ph-i" alt=""><p class="af-wait" style="justify-content:center;margin:16px 0"><i class="spin"></i>Recognising foods and portions</p>`);
  try{
    const b=await createImageBitmap(file),k=Math.min(1,1024/Math.max(b.width,b.height)),cv=document.createElement("canvas");
    cv.width=Math.round(b.width*k);cv.height=Math.round(b.height*k);cv.getContext("2d").drawImage(b,0,0,cv.width,cv.height);
    const url=cv.toDataURL("image/jpeg",.82),im=$("ph-i");if(im) im.src=url;
    const items=await aiItems([{text:"Identify every food and drink in this photo and estimate each portion's weight from visual cues (a dinner plate is about 26 cm, look at cutlery, packaging and glasses)."},
      {inline_data:{mime_type:"image/jpeg",data:url.split(",")[1]}}]);
    if(!items.length){toast("No food recognised in the photo");return addView();}
    items.forEach(x=>{x.fixed=true;ADD.tray.push(x);});buzz();trayView();
  }catch(e){toast(e.message||"Couldn't read the photo");addView();}
}

/* ------------------------------------------------------------ food: AI (your own free Gemini key) */
const aiKey=()=>LS.get("rd_gemini")||"";
function aiNeeded(what){
  openSheet(`<div class="sh-top"><h2>Needs a Gemini key</h2>${X}</div>
    <p class="sh-desc">${what} uses Google's Gemini. It is free with a personal key: create one at aistudio.google.com (Get API key), then paste it in Settings → AI key. It stays on this phone.</p>
    <p class="sh-note">On the free tier Google may use what you send to improve its models.</p>
    <div class="savebar"><button class="btn quiet" id="an-b">Back</button><button class="btn" id="an-s">Open Settings</button></div>`);
  $("an-b").onclick=()=>ADD?addView():closeSheet(); $("an-s").onclick=openSettings;
}
// Speech on Android Chrome sends each growing version of the phrase as a new result ("sei", "sei in", "sei in grado"…):
// a result that starts with what we have replaces it instead of being appended
function srText(e){
  let out="";
  for(const r of e.results){const t=r[0].transcript.trim();if(!t) continue;
    const lo=out.toLowerCase(),tl=t.toLowerCase();
    if(!out||tl.startsWith(lo)) out=t; else if(!lo.endsWith(tl)) out=out+" "+t;}
  return out;
}
// Dictation: phones end recognition after a short pause, so it restarts by itself and keeps what you said
// until you tap Stop or Send (or after 10 minutes)
// The text is never cleared: each restart continues after what's already written (typed or dictated), and if the
// phone refuses to restart a few times in a row it pauses, keeping everything, until you tap the mic again.
function dictation(ta,onText,onState){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR) return null;
  let rec=null,on=false,t0=0,base="",fails=0,heard=false;
  const begin=()=>{rec=new SR();rec.lang="it-IT";rec.continuous=true;rec.interimResults=true;base=ta.value.trim()?ta.value.trim()+" ":"";heard=false;
    rec.onresult=e=>{const t=srText(e);if(t){heard=true;fails=0;}ta.value=base+t;onText&&onText();};
    rec.onerror=e=>{if(e.error==="not-allowed"||e.error==="service-not-allowed"){toast("Allow the microphone for Readiness");stop();}else if(e.error!=="no-speech"&&e.error!=="aborted") fails++;};
    rec.onend=()=>{rec=null;if(!on) return;
      if(Date.now()-t0>15*60000||fails>=4){stop();toast("Dictation paused — your text is kept. Tap the mic to go on.");return;}
      if(!heard) fails++;
      setTimeout(()=>{if(on) try{begin();}catch(err){fails++;stop();toast("Dictation paused — tap the mic to go on.");}},fails?400:120);};
    rec.start();};
  const stop=()=>{const was=on;on=false;if(rec){rec.onend=null;try{rec.stop();}catch(e){}rec=null;}if(was) onState&&onState(false);};
  const start=()=>{if(on) return;on=true;fails=0;t0=Date.now();try{begin();onState&&onState(true);buzz(10);}catch(e){stop();}};
  return {start,stop,toggle:()=>on?stop():start(),get on(){return on;}};
}
// Which Gemini models this key can use: asked once a day, newest Flash first (names change over time)
async function aiModels(){
  const c=lsJSON("rd_gm",null);if(c&&c.v2&&Date.now()-c.t<864e5&&c.k===aiKey().slice(-6)&&c.m.length) return c.m;
  let m=[];
  try{
    const r=await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200",{headers:{"x-goog-api-key":aiKey()}});
    if(r.ok){const j=await r.json();
      m=(j.models||[]).filter(x=>(x.supportedGenerationMethods||[]).includes("generateContent")).map(x=>x.name.replace(/^models\//,""))
        .filter(n=>/flash/.test(n)&&!/(image|tts|audio|live|thinking|exp|embedding|8b)/.test(n));
      const ver=n=>parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/)||[])[1]||0);
      const rank=n=>(/latest/.test(n)?100:0)+ver(n)*10-(/lite/.test(n)?3:0)-(/preview/.test(n)?12:0)-(/\d{3}$/.test(n)?1:0);
      m.sort((a,b)=>rank(b)-rank(a));
      // the fallbacks must not all be the same model under other names: when one generation is overloaded (503)
      // they all are, so the list keeps the two best of the newest generation, then the best of each older one
      const gen=n=>Math.floor(ver(n))||0,out=[],seen={};
      const top=m.length?gen(m.find(n=>!/latest/.test(n))||m[0]):0;
      for(const n of m){if(/latest/.test(n)) continue;const g=gen(n);seen[g]=(seen[g]||0)+1;if(seen[g]<=(g===top?2:1)) out.push(n);}
      m=out;
    }else if(r.status===400||r.status===403){const t=await r.text();if(/API key|API_KEY|PERMISSION/i.test(t)) throw new Error("The Gemini key isn't valid: check it in Settings");}
  }catch(e){if(/key/.test(e.message)) throw e;}
  if(!m.length) m=["gemini-flash-latest","gemini-2.5-flash","gemini-2.5-flash-lite"];
  if(!m.some(n=>/2\.5-flash$/.test(n))) m.push("gemini-2.5-flash");      // a steady older model always closes the list
  LS.set("rd_gm",JSON.stringify({v2:1,t:Date.now(),k:aiKey().slice(-6),m:m.slice(0,5)}));
  return m.slice(0,5);
}
// one call to Gemini that must answer with JSON. Each try has a time limit, "thinking" is kept low
// (it can make a Flash model take a minute or more), and a slow or failing model hands over to the next one.
// "deep" (the coach answering a question) lets the model reason a little; logging food stays fast
const thinkCfg=(m,deep)=>/gemini-2\.5/.test(m)?{thinkingBudget:deep?1536:0}:/gemini-[3-9]|latest/.test(m)?{thinkingLevel:"low"}:null;
async function aiCall(contents,limitMs=35000,deep=false){
  const errs=[];let netRetry=false;
  for(const model of await aiModels()){
    let think=thinkCfg(model,deep);
    for(let attempt=0;attempt<3;attempt++){
      const cfg={responseMimeType:"application/json",temperature:0.2};if(think) cfg.thinkingConfig=think;
      const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),limitMs);
      let r=null,timedOut=false;
      try{r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:"POST",signal:ctl.signal,
        headers:{"Content-Type":"application/json","x-goog-api-key":aiKey()},body:JSON.stringify({contents,generationConfig:cfg})});}
      catch(e){timedOut=e.name==="AbortError";}
      finally{clearTimeout(timer);}
      if(!r&&!timedOut&&!netRetry){netRetry=true;await new Promise(z=>setTimeout(z,900));attempt--;continue;}   // a dropped request: once more
      if(timedOut){errs.push(`${model}: no answer within ${Math.round(limitMs/1000)} s`);break;}
      if(!r) throw new Error(navigator.onLine?"Couldn't reach Gemini just now: send it again in a moment":"No internet connection: the AI needs one");
      if(r.ok){
        const j=await r.json(),txt=(j.candidates?.[0]?.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||"").join("");
        if(!txt){errs.push(`${model}: empty answer (${j.candidates?.[0]?.finishReason||j.promptFeedback?.blockReason||"?"})`);break;}
        try{return {json:JSON.parse(txt.replace(/^\s*```(?:json)?|```\s*$/g,"").trim()),raw:txt};}
        catch(e){errs.push(`${model}: answer not readable`);break;}
      }
      const t=await r.text();let msg=t;try{msg=JSON.parse(t).error?.message||t;}catch(e){}
      if(/API key|API_KEY_INVALID/i.test(msg)) throw new Error("The Gemini key isn't valid: check it in Settings");
      if(r.status===400&&think&&/think/i.test(msg)){think=null;continue;}      // this model doesn't take that setting
      errs.push(`${model}: ${r.status} ${String(msg).slice(0,90)}`);
      if(r.status===404){LS.del("rd_gm");break;}
      if(r.status>=500&&attempt<2){await new Promise(z=>setTimeout(z,attempt?5000:2000));continue;}   // overloaded: usually gone in seconds
      if(r.status===429&&attempt===0){await new Promise(z=>setTimeout(z,1500));continue;}
      break;
    }
  }
  const quota=errs.length&&errs.every(e=>/ 429 /.test(e));
  const busy=errs.length&&errs.every(e=>/ 50[0-9] | 429 /.test(e));
  throw new Error(quota?"Gemini's free limit is used up for now: try again in a while":busy?"Gemini is overloaded right now (it happens at peak times and passes quickly): try again in a minute":"The AI didn't answer. "+(errs[errs.length-1]||""));
}
const aiFood=(x,def)=>{const g=+x.grams||null,k=+x.kcal||0,n=x.n||normN(x.nutrients);
  return {meal:["b","l","d","s"].includes(x.meal)?x.meal:def,name:String(x.name||"Food").slice(0,60),brand:"",g:g?Math.round(g):null,kcal:Math.round(k),
    p:r1(+x.protein||+x.p||0),c:r1(+x.carbs||+x.c||0),f:r1(+x.fat||+x.f||0),k100:g?Math.round(k/g*100):null,p100:g?r1((+x.protein||+x.p||0)/g*100):null,c100:g?r1((+x.carbs||+x.c||0)/g*100):null,f100:g?r1((+x.fat||+x.f||0)/g*100):null,
    n,n100:n&&g?scaleN(n,100/g):null,note:x.note?String(x.note).slice(0,90):null,src:"ai"};};
const AI_DB=`"db": the plain generic name a nutrition table would use for that food in the SAME state as the grams, in Italian (e.g. "avena fiocchi", "yogurt greco 0%", "pasta secca" for dry weight, "pasta cotta" for cooked, "petto di pollo cotto", "olio extravergine"); for a mixed dish the dish name. The app looks it up in its tables, so keep it simple.`;
// How to estimate when the user can't weigh things (homemade food, "a full plate", "a small slice", unknown oil)
const AI_ESTIMATE=`When quantities are vague, never refuse and never ask: estimate like an Italian dietitian and say what you assumed in "note" (max 12 words, user's language).
Portions: "piatto pieno/fondo" of soup or minestra ≈ 350–400 g, of pasta ≈ 100 g dry (≈ 250 g cooked); a slice of bread ≈ 25–30 g ("piccola" ≈ 20 g); a slice of homemade pizza ≈ 80–100 g ("piccola" ≈ 60–70 g); a slice of cake or tart ≈ 70–80 g ("mini/piccola" ≈ 35–40 g); a small pear ≈ 120 g.
Homemade dishes: unless told otherwise, count the cooking or dressing fat inside the dish: about 1 tablespoon (10 g) of olive oil per portion of soup, legumes, vegetables or sauce; a tart made with oil instead of butter has a similar fat content.
Branded items: use the real product (e.g. one Baci Perugina ≈ 12.5 g, 67 kcal).
If the user gives a weight, use it even if it seems unusual.`;
async function aiItems(parts){
  const def=ADD?.meal||"b";
  const rules=`You fill in a food diary. Reply with JSON only, no prose: {"items":[{"meal":"b","name":"","db":"","grams":0,"kcal":0,"protein":0,"carbs":0,"fat":0,"note":""}]}.
${AI_DB}
meal: "b" breakfast/colazione, "l" lunch/pranzo, "d" dinner/cena, "s" snack/spuntino/merenda; when not stated use "${def}".
One entry per distinct food or drink. grams = weight as eaten (cooked dishes cooked, drinks in ml). When the amount isn't given, assume a typical Italian portion.
Use realistic nutrition values (Italian CREA tables, USDA, typical product labels). Keep names short, in the language the user used.
${AI_ESTIMATE}`;
  const {json}=await aiCall([{role:"user",parts:[{text:rules},...parts]}]);
  return (json.items||[]).filter(x=>x&&x.name&&x.kcal>=0).map(groundAI).map(x=>aiFood(x,def));
}

