// ══════════════ EXERCISE DATA ══════════════

// Global STRINGS object (language files will populate this)
var STRINGS = {};

const EXERCISES_BASE = {
  letters: {
    easy: 'a b c d e f g h i j k l m n o p q r s t u v w x y z'.split(' '),
    medium: 'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z'.split(' ')
  },
  numbers: {
    easy: '0 1 2 3 4 5 6 7 8 9'.split(' '),
    medium: '0 1 2 3 4 5 6 7 8 9'.split(' ')
  },
  words: {
    easy: ['cat','dog','the','and','for','you','can','run','sun','big','day','get','new','old','see','put','say'],
    medium: ['water','house','light','write','could','about','their','where','think','learn','dream','heart','smile','thank','today','under','voice','green','place','stand']
  },
  sentences: {
    easy: ['The cat sat.','I can do this.','One step at a time.','I am getting stronger.','Keep going.','Every day I improve.','Practice makes progress.'],
    medium: ['The quick brown fox jumped.','Writing helps my recovery.','I will practice every day.','Each letter is a small victory.','Slow and steady wins the race.']
  }
};

// Language-specific exercise content
const EXERCISES_LANG = {
  cy: {
    words: {
      easy: ['ci','cath','dŵr','tŷ','da','lle','un','dau','tri','nos','haul','glaw','bore','eira','gwynt','llun','hir'],
      medium: ['cartref','ysgol','cymraeg','croeso','diolch','amser','blodyn','mynydd','afon','gwyrdd','cariad','llyfr','geiriau','teulu','ffrind','heddiw','golau','bywyd','cerdded','yfory']
    },
    sentences: {
      easy: ['Y gath fach.','Un cam ar y tro.','Dal ati.','Dw i\u2019n gwella.','Ymarfer bob dydd.','Pob lwc.','Rwy\u2019n trio.'],
      medium: ['Mae\u2019r haul yn disgleirio heddiw.','Ymarfer sy\u2019n gwneud cynnydd.','Pob llythyren yn fuddugoliaeth.','Rwy\u2019n ysgrifennu bob dydd.','Araf a phwyllog piau hi.']
    }
  },
  ja: {
    letters: {
      easy: 'あ い う え お か き く け こ さ し す せ そ た ち つ て と な に ぬ ね の は ひ ふ へ ほ ま み む め も や ゆ よ ら り る れ ろ わ を ん'.split(' '),
      medium: 'ア イ ウ エ オ カ キ ク ケ コ サ シ ス セ ソ タ チ ツ テ ト ナ ニ ヌ ネ ノ ハ ヒ フ ヘ ホ マ ミ ム メ モ ヤ ユ ヨ ラ リ ル レ ロ ワ ヲ ン'.split(' ')
    },
    words: {
      easy: ['ねこ','いぬ','みず','やま','はな','そら','ひと','もり','うみ','くも','あめ','かぜ','ほし','つき','にわ','まち','いえ'],
      medium: ['ありがとう','おはよう','げんき','がんばる','しあわせ','ともだち','さくら','たいよう','こころ','せかい','ひかり','れんしゅう','じかん','きぼう','えがお','みらい','けんこう','しぜん','ことば','にほん']
    },
    sentences: {
      easy: ['ねこが いる。','がんばろう。','いち にち ずつ。','すこし ずつ。','きょうも れんしゅう。','できる。','よく やった。'],
      medium: ['まいにち すこしずつ じょうずに なる。','れんしゅうは ちからに なる。','あきらめない こころが たいせつ。','ひとつ ひとつが しょうり。','ゆっくり でも すすんで いる。']
    }
  },
  ko: {
    letters: {
      easy: 'ㄱ ㄴ ㄷ ㄹ ㅁ ㅂ ㅅ ㅇ ㅈ ㅊ ㅋ ㅌ ㅍ ㅎ ㅏ ㅑ ㅓ ㅕ ㅗ ㅛ ㅜ ㅠ ㅡ ㅣ'.split(' '),
      medium: '가 나 다 라 마 바 사 아 자 차 카 타 파 하 거 너 더 러 머 버 서 어 저 처 커 터 퍼 허'.split(' ')
    },
    words: {
      easy: ['고양이','강아지','물','산','꽃','하늘','사람','숲','바다','구름','비','바람','별','달','집','마을','길'],
      medium: ['감사합니다','안녕하세요','건강','노력','행복','친구','사랑','태양','마음','세계','빛','연습','시간','희망','미소','미래','자연','용기','생활','한국']
    },
    sentences: {
      easy: ['고양이가 있다.','힘내자.','하루 하루.','조금씩.','오늘도 연습.','할 수 있다.','잘했다.'],
      medium: ['매일 조금씩 나아지고 있다.','연습은 힘이 된다.','포기하지 않는 마음이 중요하다.','하나하나가 작은 승리이다.','천천히 하지만 앞으로 나아간다.']
    }
  },
  hi: {
    letters: {
      easy: 'अ आ इ ई उ ऊ ए ऐ ओ औ क ख ग घ च छ ज झ ट ठ ड ढ ण त थ द ध न प फ ब भ म य र ल व श ष स ह'.split(' '),
      medium: 'क्ष त्र ज्ञ श्र कि की कु कू के कै को कौ कं कः'.split(' ')
    },
    words: {
      easy: ['नमस्ते','पानी','घर','माँ','पापा','दिन','रात','हाथ','पैर','आँख','कान','मुँह','नाक','सर','दिल','फूल','पेड़'],
      medium: ['अभ्यास','स्वास्थ्य','सुधार','परिवार','दोस्त','खुशी','ताकत','हिम्मत','धैर्य','कोशिश','सफलता','विश्वास','प्रगति','इलाज','उम्मीद','जीवन','शांति','सूरज','चाँद','तारा']
    },
    sentences: {
      easy: ['मैं कर सकता हूँ।','एक कदम।','हर दिन बेहतर।','कोशिश करो।','मैं मजबूत हूँ।','अभ्यास करो।','शाबाश।'],
      medium: ['हर दिन थोड़ा-थोड़ा सुधार होता है।','अभ्यास से प्रगति होती है।','हर अक्षर एक छोटी जीत है।','धीरे लेकिन आगे बढ़ रहा हूँ।','हिम्मत मत हारो।']
    }
  },
  ar: {
    letters: {
      easy: 'ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي'.split(' '),
      medium: 'بـ تـ ثـ جـ حـ خـ سـ شـ صـ ضـ طـ ظـ عـ غـ فـ قـ كـ لـ مـ نـ هـ يـ'.split(' ')
    },
    words: {
      easy: ['بيت','ماء','يد','عين','قلب','شمس','قمر','نجم','زهرة','كتاب','باب','نور','سلام','حب','أمل','يوم','ليل'],
      medium: ['تمرين','صحة','تحسن','عائلة','صديق','سعادة','قوة','شجاعة','صبر','محاولة','نجاح','ثقة','تقدم','علاج','أمان','حياة','سكينة','شروق','غروب','حرية']
    },
    sentences: {
      easy: ['أنا أستطيع.','خطوة بخطوة.','كل يوم أفضل.','حاول مرة أخرى.','أنا قوي.','تمرّن يومياً.','أحسنت.'],
      medium: ['كل يوم تتحسن قليلاً.','التمرين يصنع التقدم.','كل حرف انتصار صغير.','ببطء ولكن إلى الأمام.','لا تفقد الأمل أبداً.']
    }
  },
  zh: {
    letters: {
      easy: '一 二 三 四 五 六 七 八 九 十 人 大 小 上 下 中 山 水 火 木 日 月 天 地 口 目 手 足 心 田'.split(' '),
      medium: '学 写 字 读 书 画 花 草 风 云 雨 雪 春 夏 秋 冬 东 南 西 北 好 美 新 老 高 长'.split(' ')
    },
    words: {
      easy: ['你好','谢谢','家','水','花','天空','太阳','月亮','星星','朋友','妈妈','爸爸','手','心','眼睛','耳朵','鼻子'],
      medium: ['练习','健康','进步','家人','快乐','力量','勇气','耐心','努力','成功','信心','希望','治疗','平安','生活','自然','阳光','微笑','坚持','未来']
    },
    sentences: {
      easy: ['我能做到。','一步一步。','每天进步。','继续努力。','我很坚强。','坚持练习。','做得好。'],
      medium: ['每天都在一点点进步。','练习带来力量。','每个字都是小小的胜利。','慢慢来但在前进。','永远不要放弃希望。']
    }
  },
  pl: {
    words: {
      easy: ['dom','woda','ręka','oko','serce','dzień','noc','kot','pies','mama','tata','kwiat','drzewo','słońce','niebo','droga','pokój'],
      medium: ['ćwiczenie','zdrowie','poprawa','rodzina','przyjaciel','szczęście','siła','odwaga','cierpliwość','próba','sukces','zaufanie','postęp','leczenie','nadzieja','życie','spokój','uśmiech','wiosna','wolność']
    },
    sentences: {
      easy: ['Ja to mogę.','Krok po kroku.','Każdy dzień lepszy.','Spróbuj jeszcze raz.','Jestem silny.','Ćwicz codziennie.','Brawo.'],
      medium: ['Każdego dnia jest trochę lepiej.','Ćwiczenie daje postęp.','Każda litera to małe zwycięstwo.','Powoli ale do przodu.','Nigdy nie trać nadziei.']
    }
  },
  es_mx: {
    words: {
      easy: ['casa','agua','mano','ojo','sol','luna','gato','perro','niño','día','luz','flor','vida','pan','amor','bien','hoy'],
      medium: ['hospital','ejercicio','familia','amigo','fuerza','trabajo','corazón','camino','esperanza','progreso','salud','valentía','paciencia','esfuerzo','victoria','confianza','futuro','alegría','montaña','escritura']
    },
    sentences: {
      easy: ['Yo puedo.','Paso a paso.','Cada día mejor.','Inténtalo.','Soy fuerte.','Practica hoy.','¡Bien hecho!'],
      medium: ['Cada día estoy un poco mejor.','La práctica hace el progreso.','Cada letra es una pequeña victoria.','Despacio pero hacia adelante.','Nunca pierdas la esperanza.']
    }
  },
  pt_br: {
    words: {
      easy: ['casa','água','mão','olho','sol','lua','gato','cão','dia','luz','flor','vida','pão','amor','bem','céu','paz'],
      medium: ['exercício','saúde','melhora','família','amigo','alegria','força','coragem','paciência','tentativa','sucesso','confiança','progresso','tratamento','esperança','vida','paz','sorriso','manhã','liberdade']
    },
    sentences: {
      easy: ['Eu consigo.','Passo a passo.','Cada dia melhor.','Tente de novo.','Eu sou forte.','Pratique hoje.','Muito bem!'],
      medium: ['Cada dia estou um pouco melhor.','A prática traz progresso.','Cada letra é uma pequena vitória.','Devagar, mas em frente.','Nunca perca a esperança.']
    }
  },
  fr_ca: {
    words: {
      easy: ['chat','eau','main','jour','nuit','soleil','lune','fleur','coeur','arbre','ciel','pain','amour','paix','bien','vie','ami'],
      medium: ['exercice','santé','progrès','famille','courage','patience','effort','réussite','confiance','espoir','bonheur','pratique','écriture','victoire','force','lumière','sourire','chemin','liberté','avenir']
    },
    sentences: {
      easy: ['Je suis capable.','Un pas à la fois.','Chaque jour est meilleur.','Essaie encore.','Je suis fort.','Pratique chaque jour.','Bravo!'],
      medium: ['Chaque jour, je m\'améliore un peu.','La pratique mène au progrès.','Chaque lettre est une petite victoire.','Doucement, mais sûrement.','N\'abandonne jamais l\'espoir.']
    }
  }
};

const HINTS_BASE = {
  letters: 'Focus on form — size, shape and proportions',
  numbers: 'Take it slowly — form each number carefully',
  words: 'Connect each letter smoothly',
  sentences: 'Take your time — accuracy matters more than speed'
};
const HINTS_LANG = {
  ja: { letters: '線の形やバランスに注意しましょう', words: '一文字ずつ丁寧に', sentences: 'ゆっくり、正確さが大切です' },
  ko: { letters: '획의 모양과 균형에 주의하세요', words: '한 글자씩 정성껏', sentences: '천천히, 정확도가 중요합니다' },
  cy: { letters: 'Canolbwyntiwch ar ffurf a maint', words: 'Cysylltwch bob llythyren yn esmwyth', sentences: 'Cymerwch eich amser — cywirdeb sy\'n bwysig' },
  hi: { letters: 'आकार और अनुपात पर ध्यान दें', words: 'हर अक्षर को जोड़कर लिखें', sentences: 'धीरे-धीरे — सटीकता ज़रूरी है' },
  ar: { letters: 'ركّز على شكل وحجم الحروف', words: 'اربط كل حرف بسلاسة', sentences: 'خذ وقتك — الدقة أهم من السرعة' },
  zh: { letters: '注意笔画的形状和平衡', words: '一笔一画认真写', sentences: '慢慢来——准确性最重要' },
  pl: { letters: 'Skup się na kształcie i proporcjach', words: 'Łącz litery płynnie', sentences: 'Nie spiesz się — liczy się dokładność' },
  es_mx: { letters: 'Concéntrate en la forma y las proporciones', words: 'Conecta cada letra con fluidez', sentences: 'Tómate tu tiempo — la precisión es lo que cuenta' },
  pt_br: { letters: 'Foque na forma e nas proporções', words: 'Conecte cada letra com suavidade', sentences: 'Vá com calma — precisão importa mais que velocidade' },
  fr_ca: { letters: 'Concentre-toi sur la forme et les proportions', words: 'Relie chaque lettre en douceur', sentences: 'Prends ton temps — la précision compte plus que la vitesse' }
};

const EXERCISES = EXERCISES_BASE; // fallback reference
