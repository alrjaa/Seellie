/**
 * خريطة ترجمة محتوى البذرة (عربي → إنجليزي).
 * تُطبَّق عند تحميل البيانات إذا كانت لغة التطبيق English.
 */
export const CONTENT_EN: Record<string, string> = {
  // Users
  'المشرف الرئيسي': 'Lead Admin',
  'منظم بطولة الأبطال': 'Champions Cup Organizer',
  'منظم دوري النجوم': 'Stars League Organizer',
  'منظم كأس التحدي': 'Challenge Cup Organizer',
  'منظم بطولة المستقبل': 'Future Cup Organizer',
  'متابع شغوف': 'Passionate Follower',
  'سارة المشجع': 'Sara the Fan',
  'أحمد المتابع': 'Ahmed the Follower',
  'نورة الرياضية': 'Noura the Athlete',
  'خالد المشجع': 'Khaled the Fan',
  'لاعب حر موهوب': 'Talented Freelancer',

  // Places
  'المملكة العربية السعودية': 'Saudi Arabia',
  'منطقة الرياض': 'Riyadh Region',
  'الرياض': 'Riyadh',
  'منطقة مكة المكرمة': 'Makkah Region',
  'جدة': 'Jeddah',
  'المنطقة الشرقية': 'Eastern Province',
  'الدمام': 'Dammam',
  'منطقة عسير': 'Asir Region',
  'أبها': 'Abha',
  مصر: 'Egypt',
  القاهرة: 'Cairo',
  الكويت: 'Kuwait',
  العاصمة: 'Capital',
  البحرين: 'Bahrain',
  المحرق: 'Muharraq',
  'الإمارات العربية المتحدة': 'United Arab Emirates',
  دبي: 'Dubai',
  '1234 طريق الملك فهد': '1234 King Fahd Road',
  '5678 طريق الأمير محمد': '5678 Prince Mohammed Road',
  '9101 شارع العليا': '9101 Olaya Street',
  '1122 طريق المطار': '1122 Airport Road',
  'طريق الملك خالد': 'King Khalid Road',
  'طريق الأمير سلطان': 'Prince Sultan Road',
  'طريق النصر': 'Al Nasr Road',
  'حي النخيل': 'Al Nakheel District',
  'حي السلامة': 'Al Salamah District',
  'حي الشاطئ': 'Al Shati District',
  'حي الملقا': 'Al Malqa District',
  'حي السودة': 'Al Soudah District',

  // Competitions & venues
  'بطولة الأبطال': 'Champions Cup',
  'دوري النجوم': 'Stars League',
  'كأس القاهرة': 'Cairo Cup',
  'ملعب الملك فهد الدولي': 'King Fahd International Stadium',
  'مدينة الملك عبدالله الرياضية': 'King Abdullah Sports City',
  'استاد القاهرة الدولي': 'Cairo International Stadium',
  'ملعب الملك فهد الدولي، طريق الملك خالد، الرياض، منطقة الرياض، المملكة العربية السعودية':
    'King Fahd International Stadium, King Khalid Road, Riyadh, Riyadh Region, Saudi Arabia',
  'مدينة الملك عبدالله الرياضية، جدة، منطقة مكة المكرمة، المملكة العربية السعودية':
    'King Abdullah Sports City, Jeddah, Makkah Region, Saudi Arabia',
  'استاد القاهرة الدولي، القاهرة، مصر':
    'Cairo International Stadium, Cairo, Egypt',

  // Teams
  النسور: 'The Eagles',
  الصقور: 'The Falcons',
  الأبطال: 'The Champions',
  العمالقة: 'The Giants',
  'النسور 1': 'The Eagles 1',

  // Staff / referees / roles
  'سعود العتيبي': 'Saud Al-Otaibi',
  'نورة الشمري': 'Noura Al-Shammari',
  'فهد الدوسري': 'Fahd Al-Dosari',
  'ماجد الغامدي': 'Majed Al-Ghamdi',
  'أحمد حسن': 'Ahmed Hassan',
  'خليل جلال': 'Khalil Jalal',
  'فهد المرداسي': 'Fahd Al-Mirdasi',
  'مرعي العواجي': 'Marai Al-Awaji',
  'صالح الهذلول': 'Saleh Al-Hathlool',
  'عبدالرحمن العمري': 'Abdulrahman Al-Omari',
  'مدير إداري': 'Administrative Manager',
  'منسقة البطولة': 'Competition Coordinator',
  'منسق البطولة': 'Competition Coordinator',
  'مسؤول تشغيل الملعب': 'Stadium Operations Lead',
  'حكم ساحة': 'Referee',
  'رجل خط': 'Assistant Referee',
  مراقب: 'Observer',
  مدرب: 'Coach',
  'مساعد مدرب': 'Assistant Coach',
  'مدير الفريق': 'Team Manager',
  'مساعد مدير الفريق': 'Assistant Team Manager',
  'أخصائي علاج طبيعي': 'Physiotherapist',

  // Positions & skills
  'حارس مرمى': 'Goalkeeper',
  دفاع: 'Defense',
  وسط: 'Midfield',
  هجوم: 'Forward',
  مهاري: 'Skilled',
  هداف: 'Striker',
  'صخرة دفاعية': 'Defensive Rock',
  قائد: 'Leader',
  'مجهود وافر': 'High Effort',

  // Support levels
  إبداع: 'Creativity',
  برونزي: 'Bronze',
  فضي: 'Silver',
  ذهبي: 'Gold',
  ماسي: 'Diamond',
  شريك: 'Partner',
  'للإشادة بالمهارات الاستثنائية والأفكار المبتكرة.':
    'To celebrate exceptional skills and innovative ideas.',
  'تقديرًا للجهد المتميز والأداء المتطور.':
    'In recognition of outstanding effort and progressing performance.',
  'للاحتفاء بالإنجازات البارزة والمساهمات القيمة.':
    'To celebrate notable achievements and valuable contributions.',
  'للاعتراف بالتفوق الواضح وتحقيق نتائج مبهرة.':
    'In recognition of clear excellence and impressive results.',
  'أعلى مراتب التكريم، للإنجازات الاستثنائية والتأثير الملهم.':
    'The highest honor, for exceptional achievements and inspiring impact.',

  // Bios / posts / history
  'لاعب وسط مهاجم، أبحث عن فرصة لإثبات مهاراتي. أتميز بالتسديد القوي والرؤية الممتازة للملعب.':
    'Attacking midfielder looking for a chance to prove my skills. Strong shooting and excellent vision.',
  'جاهز للتحدي القادم!': 'Ready for the next challenge!',
  ' - لعب في دوري الهواة بالرياض 2023\n - شارك في بطولة الشركات لكرة القدم 2022':
    ' - Played in the Riyadh amateur league 2023\n - Took part in the corporate football cup 2022',
  'لاعب طموح يسعى للاحتراف': 'Ambitious player aiming for professionalism',

  // Analysis
  'تحليل تكتيكي لمباراة النسور والصقور':
    'Tactical analysis: Eagles vs Falcons',
  'كانت مباراة مثيرة ومليئة بالتحولات التكتيكية. اعتمد فريق النسور على الضغط العالي في الشوط الأول مما أربك فريق الصقور وأثمر عن هدفين.\n\nفي الشوط الثاني، غير فريق الصقور من استراتيجيته بالاعتماد على الهجمات المرتدة السريعة، ونجح في تقليص الفارق لكن الوقت لم يسعفه لإدراك التعادل. نقطة التحول كانت تبديل المدرب في الدقيقة 60 الذي أعاد الحيوية لخط الوسط.':
    'An exciting match full of tactical shifts. The Eagles pressed high in the first half, unsettling the Falcons and scoring twice.\n\nIn the second half, the Falcons switched to quick counters and cut the deficit, but ran out of time to equalize. The turning point was the 60th-minute substitution that revived midfield play.',
  'أخطاء دفاعية قاتلة في دوري النجوم':
    'Costly defensive errors in the Stars League',
  'شهدت المباراة أخطاء دفاعية بالجملة من كلا الفريقين، وهو ما يفسر النتيجة الكبيرة. يجب على المدربين مراجعة تمركز اللاعبين أثناء الكرات الثابتة.':
    'Both teams made many defensive mistakes, which explains the high scoreline. Coaches should review positioning on set pieces.',
  'مراجعة مرئية لأداء خط الوسط': 'Visual review of midfield performance',
  'فيديو تحليلي يوضح تحركات لاعبي الوسط أثناء الانتقال من الدفاع إلى الهجوم، مع ملاحظات حول المسافات بين الخطوط.':
    'An analysis video showing midfield movement when transitioning from defense to attack, with notes on spacing between lines.',

  // Comments / forums
  'مباراة رائعة! أداء الفريقين كان مذهلاً. من برأيكم كان نجم المباراة؟':
    'Great match! Both teams played brilliantly. Who do you think was the player of the match?',
  'أتفق معك، كانت مباراة حماسية. أعتقد أن حارس مرمى فريق النسور كان له الدور الأكبر في الفوز.':
    'Agreed — it was an exciting match. I think the Eagles goalkeeper played the biggest role in the win.',
  'نشكر الجميع على المشاركة في بطولة الأبطال، ونأمل أن تكونوا قد استمتعتم بالمنافسة. نراكم في الموسم القادم!':
    'Thanks everyone for joining the Champions Cup — we hope you enjoyed the competition. See you next season!',
  'نقاش صوتي حول أفضل تكتيك دفاعي.':
    'Voice discussion about the best defensive tactic.',
  'مقطع قصير من تدريبي اليوم — أقل من 30 ثانية.':
    'A short clip from today’s training — under 30 seconds.',
  'مرحباً بالجميع في مجموعة متابعي Seellie 👋 من يتابع مباراة اليوم؟':
    'Welcome everyone to the Seellie followers group 👋 Who’s watching today’s match?',
  'أهلاً سارة! أنا متحمس لمباراة النسور والصقور الليلة.':
    'Hi Sara! I’m excited for the Eagles vs Falcons match tonight.',
  'من برأيكم أفضل لاعب في البطولة حتى الآن؟':
    'Who do you think is the best player in the competition so far?',
  'أعتقد حارس النسور يستحق الإشادة. تصدياته كانت رائعة.':
    'I think the Eagles keeper deserves praise. His saves were excellent.',
  'اتفق مع خالد. ومن يتابع التحليلات الجديدة في قسم عام؟':
    'Agreed with Khaled. Who’s following the new analyses in General?',
  '@أحمد المتابع هل ستكتب تقييماً بعد المباراة؟':
    '@Ahmed the Follower will you write a review after the match?',
  'أكيد سارة! سأنشر رأيي هنا مباشرة بعد الصافرة النهائية.':
    'Absolutely Sara! I’ll post my take here right after the final whistle.',

  // Offer
  'لقد أعجبنا بملفك الشخصي ونود أن تنضم إلى فريق النسور في بطولة الأبطال. نتطلع إلى ردك.':
    'We liked your profile and would love you to join The Eagles in the Champions Cup. Looking forward to your reply.',

  // Venue fallback
  'لم يُحدد موقع المسابقة بعد': 'No venue has been set yet',
  'بدون موقع محدد': 'No venue set',
  'بدون مدينة': 'No city',
};

const PLAYER_NAME_RE = /^لاعب\s+(\d+)$/;
const COACH_NAME_RE = /^مدرب فريق\s+(\d+)$/;

/** ترجمة نص محتوى بذرة واحد */
export function localizeContentText(value: string): string {
  const mapped = CONTENT_EN[value];
  if (mapped) return mapped;

  const player = value.match(PLAYER_NAME_RE);
  if (player) return `Player ${player[1]}`;

  const coach = value.match(COACH_NAME_RE);
  if (coach) return `Team coach ${coach[1]}`;

  return value;
}

const SKIP_KEYS = new Set([
  'id',
  'email',
  'passwordHash',
  'handle',
  'visibleId',
  'avatar',
  'logo',
  'url',
  'imageUrl',
  'videoUrl',
  'audioUrl',
  'posterUrl',
  'href',
  'iconUrl',
  'mobile',
  'bankAccountNumber',
  'accountNumber',
  'certificateNumber',
  'status', // active | suspended | …
  'recipientType',
  'mediaSource',
  'type',
  // مواقع جغرافية تبقى عربية لتطابق المدينة/البحث في الرئيسية
  'city',
  'region',
  'country',
  'street',
  'neighborhood',
  'buildingNumber',
  'houseNumber',
  'address',
  // fullAddress يُترجم للعرض — ليس مفتاح مطابقة
]);

function shouldSkipKey(key: string) {
  return (
    SKIP_KEYS.has(key) ||
    key.endsWith('Id') ||
    key.endsWith('Ids') ||
    key.endsWith('Url') ||
    key.endsWith('Avatar') ||
    key.endsWith('Logo')
  );
}

/** نسخ عميق مع ترجمة النصوص العربية الظاهرة للمستخدم */
export function localizeContentTree<T>(value: T): T {
  return walk(value) as T;
}

function walk(value: unknown, parentKey?: string): unknown {
  if (value == null) return value;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    if (parentKey && shouldSkipKey(parentKey)) return value;
    if (
      value.startsWith('http') ||
      value.startsWith('@') ||
      value.startsWith('SA') ||
      /^[A-Z]{2,4}-\d+/.test(value) ||
      /^P\d+/.test(value) ||
      /^C\d+/.test(value)
    ) {
      return value;
    }
    return localizeContentText(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => walk(item, parentKey));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = walk(v, k);
    }
    return out;
  }
  return value;
}
