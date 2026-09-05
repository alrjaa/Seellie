/**
 * قصة هوية Seellie — عربي / إنجليزي.
 * تُعرض حسب لغة التطبيق الحالية.
 */

export type StoryBlock = {
  /** عنوان القسم (اختياري للفقرة الافتتاحية) */
  title?: string;
  paragraphs: string[];
};

export type SeellieStory = {
  brand: string;
  tagline: string;
  subtitle: string;
  blocks: StoryBlock[];
  closing: string[];
};

export const SEELLIE_STORY_AR: SeellieStory = {
  brand: 'Seellie',
  tagline: 'انظر [[لي]]',
  subtitle: 'لكل اسم حكاية...',
  blocks: [
    {
      paragraphs: [
        'وبعض الأسماء لا تُختار لتكون مجرد اسم، بل لتختصر فكرة، وتحمل رسالة، وتعبّر عن حلم.',
        'Seellie واحدة من هذه الأسماء.',
        'في اسم Seellie فكرة بسيطة:',
        'See — انظر، شاهد.',
        '[[لي]] — تعني [[لي]] كتطبيق يقدم لك معلومة في نفس الوقت، ويقدم لك موهبة، ويقدم لك تنافسًا بين الفرق، ويقدم لك المتعة لتنظر إليها. وتعني [[لي]] كلاعب، كموهبة، كفريق، كحكم، كمنظم مسابقات، كدوري قائم، كمنافسة قوية. وتعني [[لي]] كمحلل وناقد.',
        'Seellie لا تقول فقط: «انظر [[لي]]».\nبل تقول أيضًا: «هذا لك.»',
        'لك ما تبحث عنه.\nلك ما تريد أن تراه.\nلك ما تريد أن تتابعه.\nولك مكانك في عالم الرياضة.',
        'وعندما اجتمعت الكلمتان، ظهرت الفكرة التي وُلدت منها هوية Seellie.',
      ],
    },
    {
      title: 'لأن خلف كل موهبة قصة',
      paragraphs: [
        'في الملاعب، لا تبدأ كل القصص من الأندية الكبيرة.',
        'أحيانًا تبدأ من ملعب صغير...\nمن بطولة محلية...\nمن فريق من الأصدقاء...\nأو من لاعب يقف وحده، يحمل حلمًا أكبر من المكان الذي يلعب فيه.',
        'قد يكون سريعًا.\nقد يمتلك مهارة استثنائية.\nقد يسجل أهدافًا لا تُنسى.\nوقد يكون لديه من الموهبة ما يكفي ليصنع لنفسه مستقبلًا كبيرًا.',
        'لكن هناك مشكلة واحدة:\nلم يره الشخص المناسب بعد.',
        'وهنا تبدأ قصة Seellie.',
      ],
    },
    {
      title: 'الموهبة لا ينبغي أن تبقى مخفية',
      paragraphs: [
        'نؤمن أن عالم الرياضة لا يفتقر إلى المواهب بقدر ما يفتقر أحيانًا إلى الطرق التي تجعل هذه المواهب مرئية.',
        'هناك لاعب يريد أن يُرى...\nوهناك مدرب يبحث عن لاعب.',
        'هناك فريق يبحث عن إضافة جديدة...\nوأكاديمية تبحث عن مستقبل...\nوكشاف يبحث عن موهبة لم يسمع بها أحد من قبل.',
        'Seellie جاءت لتقرّب المسافة بين الاثنين.',
        'لتمنح اللاعب مساحة يقول فيها للعالم:\nانظر لي.\nشاهد مهاراتي.\nتابع أدائي.\nتعرف على إمكاناتي.\nشاهد ما أستطيع فعله.\nثم احكم بنفسك.',
      ],
    },
    {
      title: 'المواهب... عندما تصبح الفرصة أقرب',
      paragraphs: [
        'هناك آلاف اللاعبين الذين يمتلكون الطموح والمهارة، لكنهم لا ينتمون إلى نادٍ أو فريق في الوقت الحالي.',
        'لا يعني ذلك أنهم أقل موهبة.\nولا يعني أن رحلتهم انتهت.\nربما يعني فقط أن فرصتهم لم تأتِ بعد.',
        'في Seellie يستطيع صاحب حساب المواهب أن يصنع لنفسه حضورًا رياضيًا حقيقيًا.',
        'ينشئ ملفه.\nيعرّف بنفسه.\nيُظهر مركزه ومهاراته.\nيشارك مقاطع لعبه وأبرز لحظاته.\nويعرض مشاركاته وإحصاءاته وأداءه في المباريات والبطولات.',
        'ليصبح له مكان يستطيع من خلاله أن يقول:\nهذا أنا... وهذه موهبتي.',
      ],
    },
    {
      title: 'لا تقل فقط إنك موهوب... دع أداءك يتحدث',
      paragraphs: [
        'الموهبة كلمة جميلة.\nلكن الملعب هو المكان الذي تثبت فيه الموهبة نفسها.',
        'ولهذا لا نريد أن يكون ملف اللاعب مجرد كلمات يكتبها عن نفسه.',
        'نريد أن تتحدث المباريات.\nأن تظهر الإحصائيات.\nأن تُوثق المشاركات.\nأن تظهر الأهداف والتمريرات والأداء.\nوأن تصبح مسيرة اللاعب شيئًا يمكن متابعته، وليس مجرد وصف على صفحة.',
        'فربما لا تحتاج الموهبة إلى من يصفها...\nبل تحتاج فقط إلى من يراها.',
      ],
    },
    {
      title: 'من يراك قد يفتح لك الباب',
      paragraphs: [
        'قد يشاهد ملف اللاعب مدرب.\nأو فريق.\nأو أكاديمية.\nأو كشاف.\nأو نادٍ يبحث عن لاعب في مركز معين.',
        'قد تكون الموهبة التي يبحث عنها أقرب مما يتخيل.',
        'لا تستطيع Seellie أن تعد اللاعب بأن ناديًا سيختاره، لأن القرار في النهاية يعود إلى الجهات الرياضية.',
        'لكنها تستطيع أن تمنحه شيئًا بالغ الأهمية:\nأن تكون فرصته في الظهور أكبر.\nأن يصبح الوصول إليه أسهل.\nوأن تصبح موهبته قابلة للاكتشاف.',
        'فنحن لا نعدك بأن الفرصة ستأتي...\nلكننا نؤمن أنه عندما تكون الموهبة موجودة، يجب أن تكون هناك مساحة يمكن أن تظهر فيها.',
        'لا نستطيع أن نقرر من سيختاره النادي.\nلكننا نستطيع أن نساعدك على أن تجعل ما تملكه مرئيًا.',
      ],
    },
    {
      title: 'والبطولة ليست مجرد بطولة',
      paragraphs: [
        'ننظر إلى البطولة بطريقة مختلفة.',
        'البطولة ليست فقط جدول مباريات.\nوليست فقط نتائج وترتيبًا.',
        'خلف كل مباراة قصة.\nوخلف كل فريق مجموعة من الأحلام.\nوخلف كل لاعب فرصة.',
        'قد يدخل اللاعب الملعب للمشاركة في بطولة...\nلكنه قد يخرج منها بسجل رياضي جديد، وإحصائيات جديدة، ومقاطع جديدة، وربما بفرصة لم تكن موجودة قبل المباراة.',
        'قد تبدأ القصة بمباراة...\nثم تظهر موهبة...\nثم تُوثق أرقامها...\nثم يشاهدها شخص لم يكن يعرفها...\nثم تأتي فرصة لم تكن في الحسبان.',
        'ولهذا نريد أن تجمع Seellie بين:\nالبطولات والمباريات والفرق واللاعبين والجمهور والمواهب.',
        'ليصبح الملعب نقطة البداية...\nوليس نقطة النهاية.',
      ],
    },
    {
      title: 'سجل رياضي يحكي رحلتك',
      paragraphs: [
        'نؤمن أن اللاعب لا يجب أن يُعرّف فقط بما يقوله عن نفسه، بل بما يقدمه داخل الملعب.',
        'مشاركاتك.\nمبارياتك.\nإحصاءاتك.\nأهدافك.\nتمريراتك.\nفرقك.\nبطولاتك.\nوأبرز لحظاتك.',
        'كل ذلك يمكن أن يصبح جزءًا من سجل رياضي يعكس رحلتك ويجعل أداءك حاضرًا أمام من يريد أن يعرفك أكثر.',
        'ملفك الرياضي لا يروي من أنت فقط... بل يروي ما قدمته.',
      ],
    },
    {
      title: 'إلى اللاعب الذي ينتظر فرصته',
      paragraphs: [
        'إذا كنت من المواهب...\nإذا كنت تؤمن أن لديك شيئًا يستحق أن يُرى...\nإذا كنت تتدرب بينما لا يراك أحد...\nإذا كنت تلعب وتقول في داخلك:\n«متى تأتي فرصتي؟»',
        'فربما لا تحتاج إلى انتظارها فقط.',
        'اصنع لنفسك فرصة لأن تُرى.\nأظهر مهاراتك.\nوثّق أداءك.\nشارك مسيرتك.\nدع أرقامك تتحدث.\nودع من يبحث عن موهبة جديدة يجدك.',
        'لأنك لا تعرف من قد يشاهدك غدًا.\nولا تعرف أين يمكن أن تقودك مباراة واحدة.',
        'فالموهبة عندما تُرى... تبدأ رحلة جديدة.',
      ],
    },
    {
      title: 'إلى الأندية والفرق والكشافين',
      paragraphs: [
        'وفي الجانب الآخر، هناك من يبحث.',
        'مدرب يبحث عن لاعب.\nفريق يبحث عن موهبة.\nأكاديمية تبحث عن مستقبل.\nونادٍ يبحث عن إضافة جديدة.',
        'قد تكون الموهبة التي تبحث عنها أقرب مما تتخيل.',
        'ولهذا نريد أن تجعل Seellie اكتشاف اللاعبين أكثر سهولة، وأن تفتح مساحة جديدة للتعرف على المواهب التي قد لا تصل إليها الطرق التقليدية.',
        'هناك من يريد أن يُرى... وهناك من يبحث عمّن يراه.',
        'وSeellie تريد أن تكون المساحة التي تلتقي فيها هذه الرغبة مع هذا البحث.',
      ],
    },
    {
      title: 'لماذا Seellie؟',
      paragraphs: [
        'لأننا لا نريد أن تكون Seellie مجرد منصة تُستخدم لتنظيم بطولة ثم تنتهي القصة.',
        'نريد أن يكون لكل بطولة أثر.\nولكل مباراة قيمة.\nولكل لاعب فرصة.\nولكل موهبة مساحة.',
        'أن يبدأ اللاعب من الملعب...\nثم يبني سجله...\nثم يظهر أداؤه...\nثم يصل صوته إلى جمهور أكبر...\nوربما يراه الشخص الذي يستطيع أن يغيّر مسيرته.',
        'من الملعب إلى الفرصة.\nهذه هي الفكرة التي نريد أن نصنعها.',
      ],
    },
    {
      title: 'Seellie ليست مجرد اسم',
      paragraphs: [
        'Seellie ليست مجرد كلمة اخترناها.\nإنها الفكرة التي نريد أن نحملها مع كل لاعب، وكل فريق، وكل بطولة.',
        'See + لي\nانظر لي.\nشاهدني.\nتابعني.\nاكتشفني.\nامنحني فرصة.',
        'وربما خلف هذه الكلمات لاعب صغير في ملعب بعيد...\nيمتلك موهبة كبيرة...\nويتدرب كل يوم...\nويحلم بأن يصل إلى مكان أكبر.',
        'ربما لا يحتاج إلى معجزة.\nربما لا يحتاج إلا إلى مساحة تظهر فيها موهبته...\nوإلى شخص يراه في الوقت المناسب.',
      ],
    },
  ],
  closing: [
    'Seellie',
    'انظر [[لي]]... ربما أكون الموهبة التي تبحث عنها.',
  ],
};

export const SEELLIE_STORY_EN: SeellieStory = {
  brand: 'Seellie',
  tagline: 'See [[لي]]',
  subtitle: 'Every name has a story...',
  blocks: [
    {
      paragraphs: [
        'And some names are not chosen to be just a name — they are chosen to hold an idea, carry a message, and express a dream.',
        'Seellie is one of those names.',
        'In the name Seellie there is a simple idea:',
        'See — look, watch.',
        '[[لي]] — means [[لي]] as an app that gives you information in the moment, offers you talent, brings you competition between teams, and gives you the joy of watching it. And [[لي]] means for you as a player, as a talent, as a team, as a referee, as a competition organizer, as an active league, as strong rivalry. And [[لي]] means for you as an analyst and critic.',
        'Seellie does not only say: “See [[لي]].”\nIt also says: “This is for you.”',
        'For you — what you are looking for.\nFor you — what you want to see.\nFor you — what you want to follow.\nAnd for you — your place in the world of sport.',
        'When the two words came together, the idea that shaped Seellie’s identity was born.',
      ],
    },
    {
      title: 'Because behind every talent there is a story',
      paragraphs: [
        'On the pitches, not every story begins at the big clubs.',
        'Sometimes it begins on a small field...\nfrom a local tournament...\nfrom a team of friends...\nor from a player standing alone, carrying a dream bigger than the place where they play.',
        'They may be fast.\nThey may have exceptional skill.\nThey may score unforgettable goals.\nAnd they may have enough talent to build a great future.',
        'But there is one problem:\nthe right person has not seen them yet.',
        'And that is where the Seellie story begins.',
      ],
    },
    {
      title: 'Talent should not stay hidden',
      paragraphs: [
        'We believe the world of sport does not lack talent as much as it sometimes lacks the paths that make talent visible.',
        'There is a player who wants to be seen...\nand a coach looking for a player.',
        'There is a team looking for a new addition...\nan academy looking toward the future...\nand a scout searching for a talent no one has heard of yet.',
        'Seellie was created to close that distance.',
        'To give the player a space to tell the world:\nSee me.\nWatch my skills.\nFollow my performance.\nDiscover what I can do.\nThen decide for yourself.',
      ],
    },
    {
      title: 'Talents… when opportunity draws closer',
      paragraphs: [
        'There are thousands of players with ambition and skill who do not belong to a club or team right now.',
        'That does not mean they have less talent.\nIt does not mean their journey is over.\nIt may simply mean their chance has not arrived yet.',
        'On Seellie, a Talent account can build a real sporting presence.',
        'Create a profile.\nIntroduce yourself.\nShow your position and skills.\nShare match clips and highlight moments.\nPresent your appearances, stats, and performance across matches and competitions.',
        'So there is a place from which you can say:\nThis is me... and this is my talent.',
      ],
    },
    {
      title: 'Don’t just say you’re talented… let your performance speak',
      paragraphs: [
        'Talent is a beautiful word.\nBut the pitch is where talent proves itself.',
        'That is why we do not want a player’s profile to be only words they write about themselves.',
        'We want matches to speak.\nStats to appear.\nAppearances to be recorded.\nGoals, assists, and performance to show.\nAnd a player’s journey to become something you can follow — not just a description on a page.',
        'Perhaps talent does not need someone to describe it...\nit only needs someone to see it.',
      ],
    },
    {
      title: 'Whoever sees you may open a door',
      paragraphs: [
        'A coach may view a player’s profile.\nOr a team.\nOr an academy.\nOr a scout.\nOr a club looking for a player in a specific position.',
        'The talent they are looking for may be closer than they imagine.',
        'Seellie cannot promise a player that a club will choose them — that decision belongs to sporting organizations.',
        'But it can give something vital:\na greater chance to be seen.\neasier access to them.\nand a talent that can be discovered.',
        'We do not promise that opportunity will come...\nbut we believe that when talent exists, there must be a space where it can appear.',
        'We cannot decide whom a club will choose.\nBut we can help you make what you have visible.',
      ],
    },
    {
      title: 'And a competition is not just a competition',
      paragraphs: [
        'We look at competitions differently.',
        'A competition is not only a fixture list.\nNot only results and a table.',
        'Behind every match is a story.\nBehind every team is a set of dreams.\nBehind every player is a chance.',
        'A player may enter the pitch to take part in a competition...\nand leave with a new sporting record, new stats, new clips — and maybe an opportunity that did not exist before the match.',
        'A story may begin with a match...\nthen a talent appears...\nthen numbers are recorded...\nthen someone who did not know them watches...\nthen an unexpected opportunity arrives.',
        'That is why we want Seellie to bring together:\ncompetitions, matches, teams, players, fans, and talents.',
        'So the pitch becomes the starting point...\nnot the end.',
      ],
    },
    {
      title: 'A sporting record that tells your journey',
      paragraphs: [
        'We believe a player should not be defined only by what they say about themselves, but by what they deliver on the pitch.',
        'Your appearances.\nYour matches.\nYour stats.\nYour goals.\nYour assists.\nYour teams.\nYour competitions.\nAnd your highlight moments.',
        'All of that can become part of a sporting record that reflects your journey and puts your performance in front of anyone who wants to know you better.',
        'Your sporting profile does not only tell who you are... it tells what you have delivered.',
      ],
    },
    {
      title: 'To the player waiting for a chance',
      paragraphs: [
        'If you are a Talent...\nif you believe you have something worth seeing...\nif you train while no one is watching...\nif you play and say inside:\n“When will my chance come?”',
        'Perhaps you do not only need to wait for it.',
        'Create a chance to be seen.\nShow your skills.\nDocument your performance.\nShare your journey.\nLet your numbers speak.\nAnd let those searching for new talent find you.',
        'Because you do not know who may watch you tomorrow.\nAnd you do not know where a single match can lead.',
        'When talent is seen... a new journey begins.',
      ],
    },
    {
      title: 'To clubs, teams, and scouts',
      paragraphs: [
        'On the other side, there are those who search.',
        'A coach looking for a player.\nA team looking for talent.\nAn academy looking toward the future.\nA club looking for a new addition.',
        'The talent you are looking for may be closer than you think.',
        'That is why we want Seellie to make discovering players easier — and to open a new space to meet talents that traditional paths may never reach.',
        'There are those who want to be seen... and those who are looking for someone to see.',
        'And Seellie wants to be the space where that desire meets that search.',
      ],
    },
    {
      title: 'Why Seellie?',
      paragraphs: [
        'Because we do not want Seellie to be only a platform used to organize a competition — and then the story ends.',
        'We want every competition to leave an impact.\nEvery match to hold value.\nEvery player to have a chance.\nEvery talent to have a space.',
        'For a player to begin on the pitch...\nthen build their record...\nthen show their performance...\nthen reach a wider audience...\nand maybe be seen by the person who can change their path.',
        'From the pitch to opportunity.\nThat is the idea we want to build.',
      ],
    },
    {
      title: 'Seellie is not just a name',
      paragraphs: [
        'Seellie is not just a word we chose.\nIt is the idea we want to carry with every player, every team, and every competition.',
        'See + لي\nSee me.\nWatch me.\nFollow me.\nDiscover me.\nGive me a chance.',
        'And perhaps behind these words is a young player on a distant pitch...\nwith great talent...\ntraining every day...\ndreaming of reaching a bigger place.',
        'Perhaps they do not need a miracle.\nPerhaps they only need a space where their talent can appear...\nand someone who sees them at the right time.',
      ],
    },
  ],
  closing: [
    'Seellie',
    'See [[لي]]... I may be the talent you are looking for.',
  ],
};

export function getSeellieStory(lang: 'ar' | 'en'): SeellieStory {
  return lang === 'en' ? SEELLIE_STORY_EN : SEELLIE_STORY_AR;
}
