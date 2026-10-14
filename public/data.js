/* Steady — static content. Carb counts are approximate; confirm with a dietitian. */
window.SD = (function(){
  // [emoji, name, portion, carbs(g), light(go|care|stop), tip, group]
  const F = [
    // Staples
    ['🌽','Stiff pap','½ cup cooked',17,'care','Keep to ½–1 cup and add protein + veg.','Staples'],
    ['🌽','Pap (soft/porridge)','1 cup',30,'care','Softer pap digests faster — smaller portion.','Staples'],
    ['🍚','White rice','½ cup cooked',22,'care','Swap half for cauliflower rice or extra veg.','Staples'],
    ['🍚','Brown rice','½ cup cooked',22,'go','Slower release than white rice.','Staples'],
    ['🫘','Samp & beans','1 cup',35,'go','High fibre — a great staple in measured portions.','Staples'],
    ['🍞','Seed / low-GI bread','1 slice',13,'go','Look for “seed” or “low GI” on the pack.','Staples'],
    ['🍞','White bread','1 slice',15,'care','Pair with egg/peanut butter, not jam.','Staples'],
    ['🥔','Potato (boiled)','1 medium',25,'care','Leave the skin on and cool it first for slower release.','Staples'],
    ['🍠','Sweet potato','½ cup',15,'go','Better than white potato in small portions.','Staples'],
    ['🥣','Rolled oats (cooked)','1 cup',27,'go','No sugar — add cinnamon, nuts, berries.','Staples'],
    ['🍝','Pasta','½ cup cooked',20,'care','Al dente is gentler on sugar.','Staples'],
    ['🌽','Mielie on the cob','1 medium',25,'care','Count it as a starch portion.','Staples'],
    ['🥟','Dumpling (dombolo)','1 piece',28,'care','Keep it small; skip with pap + rice on one plate.','Staples'],
    ['🍟','Slap chips','1 medium',48,'stop','Big sugar spike — rare treat, small size, after a walk.','Staples'],
    ['🍩','Vetkoek','1',35,'stop','Refined flour + oil. Treat-only; choose mince inside, not jam.','Staples'],
    // Protein
    ['🍗','Grilled chicken','100 g',0,'go','Skin off, grilled/baked rather than fried.','Protein'],
    ['🐟','Fish (hake/pilchards)','100 g',0,'go','Grilled or tinned in water/tomato.','Protein'],
    ['🥚','Eggs','2 eggs',1,'go','Boiled, poached or scrambled with little oil.','Protein'],
    ['🥩','Lean beef / mince','100 g',0,'go','Choose lean mince and trim the fat.','Protein'],
    ['🌭','Boerewors','1 link',4,'care','High in fat and salt — small portion.','Protein'],
    ['🥓','Polony / viennas','2 slices',4,'care','Processed — keep rare.','Protein'],
    ['🥩','Biltong','30 g',1,'go','A good snack; watch salt.','Protein'],
    ['🫘','Lentils / dry beans','½ cup cooked',20,'go','Protein + fibre — keeps you full.','Protein'],
    // Veg
    ['🥬','Morogo / spinach','1 cup cooked',3,'go','Eat plenty!','Veg'],
    ['🥗','Cabbage','1 cup',5,'go','Fill half your plate with veg like this.','Veg'],
    ['🥕','Carrots','½ cup',6,'go','','Veg'],
    ['🥦','Broccoli / green beans','1 cup',6,'go','','Veg'],
    ['🎃','Butternut / pumpkin','½ cup',10,'care','Count as part of your starch.','Veg'],
    ['🌶️','Chakalaka','½ cup',8,'go','Check for added sugar in tinned versions.','Veg'],
    ['🍅','Tomato & onion','1 cup',8,'go','','Veg'],
    ['🥒','Cucumber / lettuce','1 cup',2,'go','Unlimited.','Veg'],
    // Fruit
    ['🍎','Apple','1 medium',20,'go','Eat with the skin; pair with nuts.','Fruit'],
    ['🍊','Naartjie','1',9,'go','','Fruit'],
    ['🍊','Orange','1 medium',15,'go','Whole fruit, not juice.','Fruit'],
    ['🍐','Pear','1 small',22,'care','','Fruit'],
    ['🍌','Banana','½ medium',14,'care','Half a banana is plenty; choose less ripe.','Fruit'],
    ['🍇','Grapes','10 grapes',12,'care','Easy to over-eat — count them out.','Fruit'],
    ['🍉','Watermelon','1 cup',11,'care','','Fruit'],
    ['🥭','Mango','¼ large',18,'care','','Fruit'],
    ['🍓','Berries','1 cup',15,'go','Best fruit choice.','Fruit'],
    ['🍍','Pineapple','1 slice',13,'care','','Fruit'],
    ['🥭','Dried fruit','1 Tbsp',10,'stop','Very concentrated sugar.','Fruit'],
    // Dairy
    ['🥛','Amasi / maas','½ cup',6,'go','Unsweetened only.','Dairy'],
    ['🥛','Milk','1 cup',12,'go','Low-fat is fine.','Dairy'],
    ['🍶','Plain unsweetened yoghurt','150 g',8,'go','Add cinnamon + berries.','Dairy'],
    ['🍦','Sweetened / fruit yoghurt','150 g',22,'care','Often as much sugar as dessert.','Dairy'],
    ['🧀','Cheese','30 g',0,'go','','Dairy'],
    // Drinks
    ['💧','Water','1 glass',0,'go','Your best friend.','Drinks'],
    ['🍵','Rooibos / tea (no sugar)','1 cup',0,'go','Add milk + cinnamon for “sweet” flavour.','Drinks'],
    ['☕','Coffee (no sugar)','1 cup',0,'go','','Drinks'],
    ['🥤','Diet cooldrink','330 ml',0,'care','OK sometimes; may keep sweet cravings alive.','Drinks'],
    ['🥤','Regular cooldrink','330 ml',35,'stop','Only for treating a LOW.','Drinks'],
    ['🧃','Fruit juice','250 ml',26,'stop','Only for treating a LOW.','Drinks'],
    ['🍫','Hot chocolate / Milo','1 mug',22,'stop','Try unsweetened cocoa + milk + sweetener.','Drinks'],
    ['🥤','Mageu','250 ml',22,'care','','Drinks'],
    ['🍺','Beer','340 ml',12,'care','Never on an empty stomach; can cause lows hours later.','Drinks'],
    // Snacks & sweets
    ['🥜','Nuts (unsalted)','small handful',5,'go','About 30 g.','Snacks & sweets'],
    ['🍿','Plain popcorn','3 cups',15,'care','Without butter/caramel.','Snacks & sweets'],
    ['🥨','Provita / rice cakes','2',10,'care','Add cheese or peanut butter.','Snacks & sweets'],
    ['🥔','Chips (Simba etc.)','small pack 36 g',18,'stop','Fat + refined carbs.','Snacks & sweets'],
    ['🍪','Biscuits','2',16,'stop','','Snacks & sweets'],
    ['🍫','Chocolate bar','1 bar (50 g)',30,'stop','A square or two of 70–85% dark is a better choice.','Snacks & sweets'],
    ['🍫','Dark chocolate 70–85%','2 blocks',6,'care','Slow-sipping treat.','Snacks & sweets'],
    ['🍬','Sweets / jelly babies','5 pieces',20,'stop','Keep for LOW sugar only.','Snacks & sweets'],
    ['🍩','Koeksister','1',30,'stop','Treat only — half, after a meal.','Snacks & sweets'],
    ['🍰','Cake / pudding','1 slice',40,'stop','Share a slice; eat after a meal.','Snacks & sweets'],
    ['🍨','Ice cream','1 scoop',15,'care','Small scoop after a meal.','Snacks & sweets'],
    ['🍞','Rusk','1',14,'care','','Snacks & sweets']
  ].map(([e,n,p,c,l,t,g])=>({e,n,p,c,l,t,g}));

  // Low-sugar rescue (only when sugar is LOW)
  const RESCUE = [
    ['🧃','Fruit juice','150 ml (~½ cup)'],
    ['🥤','Regular cooldrink','150 ml (~½ cup)'],
    ['🍬','Glucose tablets','3–4 tablets'],
    ['🍯','Sugar or honey','1 Tbsp'],
    ['🍭','Jelly sweets','4–5 jelly babies']
  ];

  // Craving swaps
  const SWAPS = [
    ['🫐','Frozen berries + plain yoghurt','Cold, sweet, ~10 g carbs'],
    ['🍎','Apple slices + peanut butter','Crunch + fat slows sugar'],
    ['🍵','Rooibos + milk + cinnamon','“Sweet” taste, zero sugar'],
    ['🍫','2 blocks 85% dark chocolate','Slow-melt, ~6 g carbs'],
    ['🍮','Sugar-free jelly','Almost zero carbs'],
    ['🚶','10-minute walk','Cravings drop; sugar too'],
    ['💧','Big glass of cold water','Thirst often feels like craving'],
    ['🦷','Brush teeth / sugar-free gum','Signals “kitchen closed”']
  ].map(([e,n,d])=>({e,n,d}));

  // Quick treats and their typical carbs (small portions)
  const TREATS = [
    ['🍫','Chocolate square(s)',6],['🍪','1 biscuit',8],['🍨','Small scoop ice cream',15],
    ['🍩','Half a koeksister',15],['🍰','Small slice of cake',20],['🍬','A few sweets',10],
    ['🥤','Small cooldrink',20],['🍮','Pudding (small)',18]
  ].map(([e,n,c])=>({e,n,c}));

  // 7-day sample plan. slot, time, title, description, carbs
  const P = (s,t,ti,d,c)=>({s,t,ti,d,c});
  const PLAN = {
    1:[ P('Breakfast','07:30','Oats + egg','½ cup rolled oats with cinnamon, 1 boiled egg',32),
        P('Snack','10:00','Apple + almonds','1 apple, 10 almonds',22),
        P('Lunch','12:30','Chicken & morogo plate','Grilled chicken, 1 cup morogo, ½ cup samp & beans',40),
        P('Snack','15:30','Yoghurt + berries','150 g plain yoghurt, ½ cup berries',14),
        P('Dinner','18:30','Hake & veg','Grilled hake, steamed veg, ½ cup brown rice',30)],
    2:[ P('Breakfast','07:30','Egg & toast','2 eggs, 1 slice seed bread, sliced tomato',16),
        P('Snack','10:00','Amasi + nuts','½ cup amasi, small handful nuts',11),
        P('Lunch','12:30','Bean & veg soup','Big bowl bean-veg soup + 1 slice seed bread',40),
        P('Snack','15:30','Carrots + hummus','Carrot sticks, 2 Tbsp hummus',12),
        P('Dinner','18:30','Beef stew & cabbage','Lean beef stew, ½ cup stiff pap, 1 cup cabbage',28)],
    3:[ P('Breakfast','07:30','Yoghurt bowl','150 g plain yoghurt, nuts, ½ cup berries',20),
        P('Snack','10:00','Naartjie + biltong','1 naartjie, 30 g biltong',10),
        P('Lunch','12:30','Chicken wrap','Whole-wheat wrap, chicken, salad, no sweet sauce',36),
        P('Snack','15:30','Egg & cucumber','1 boiled egg, cucumber slices',3),
        P('Dinner','18:30','Mince & green beans','Lean mince, green beans, ½ cup sweet potato',24)],
    4:[ P('Breakfast','07:30','Peanut-butter toast','1 slice seed bread, 1 Tbsp sugar-free peanut butter, tea',16),
        P('Snack','10:00','Pear + cheese','½ pear, 30 g cheese',12),
        P('Lunch','12:30','Tuna salad bowl','Tuna, mixed salad, ½ cup brown rice, olive oil',28),
        P('Snack','15:30','Popcorn','2 cups plain popcorn',10),
        P('Dinner','18:30','Chicken curry & veg','Chicken curry (little oil), 1 cup veg, ½ cup basmati',32)],
    5:[ P('Breakfast','07:30','Scrambled eggs','2 eggs, spinach, 1 slice seed bread',15),
        P('Snack','10:00','Orange + nuts','1 orange, small handful nuts',20),
        P('Lunch','12:30','Samp & beans','1 cup samp & beans, chakalaka, side salad',42),
        P('Snack','15:30','Amasi','1 cup amasi',12),
        P('Dinner','18:30','Grilled fish & salad','Grilled fish, big salad, 1 small boiled potato',25)],
    6:[ P('Breakfast','07:30','Oats & berries','½ cup oats, ½ cup berries, cinnamon',32),
        P('Snack','10:00','Biltong + naartjie','30 g biltong, 1 naartjie',10),
        P('Lunch','12:30','Braai plate (light)','Grilled chicken/lean chop, big salad, ½ cup pap',24),
        P('Snack','15:30','Dark-choc moment','2 blocks 85% dark chocolate + rooibos',6),
        P('Dinner','18:30','Veg stir-fry','Chicken & veg stir-fry, ½ cup brown rice',32)],
    0:[ P('Breakfast','08:00','Veg omelette','2-egg omelette with veg, 1 slice seed bread',16),
        P('Snack','10:30','Apple + peanut butter','1 apple, 1 Tbsp peanut butter',22),
        P('Lunch','13:00','Sunday roast (balanced)','Roast chicken, 2 veg, ½ cup sweet potato, salad',30),
        P('Snack','16:00','Treat window','Your planned small treat — after a walk (see Treats)',15),
        P('Dinner','18:30','Soup night','Veg & lentil soup + 1 slice seed bread',34)]
  };

  const SYMPTOMS = ['Shaky','Sweaty','Dizzy','Very hungry','Very thirsty','Tired','Headache','Blurry vision','Fast heartbeat','Irritable','Nausea','Need to wee a lot'];
  const CONTEXTS = [['fasting','🌅','Fasting'],['before','🍽️','Before meal'],['after','⏱️','After meal'],['walk','🚶','After walk'],['bed','🌙','Bedtime'],['random','🎲','Other']];
  const MOODS = ['😣','😕','😐','🙂','😄'];
  const AVATARS = ['🌸','🌻','🦋','🌈','🐝','🌺','🍀','⭐','🦄','🐱','🦊','💜'];

  return {foods:F,rescue:RESCUE,swaps:SWAPS,treats:TREATS,plan:PLAN,symptoms:SYMPTOMS,contexts:CONTEXTS,moods:MOODS,avatars:AVATARS};
})();
