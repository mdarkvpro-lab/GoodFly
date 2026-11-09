import { AGENCY } from "@/config/site";
import type { Locale } from "@/i18n/config";

/**
 * Texts of the legal pages. A part written {{like this}} is information the agency still has to
 * give (company numbers, licence…): it is shown highlighted as "to complete" until it is replaced.
 */
/** Rendered in this order: paragraphs, list, then `after`. */
export type LegalSection = { title: string; paragraphs?: string[]; list?: string[]; after?: string[] };
export type LegalPage = { title: string; eyebrow: string; intro: string; updated: string; sections: LegalSection[] };
export type LegalKind = "mentions" | "privacy";

const phones = AGENCY.phones.map((p) => p.display).join(" · ");
const UPDATED = { fr: "Dernière mise à jour : 9 novembre 2026", ar: "آخر تحديث: 9 نونبر 2026" };

const FR: Record<LegalKind, LegalPage> = {
  mentions: {
    eyebrow: "Informations légales",
    title: "Mentions légales",
    intro: "Qui édite ce site, qui l'héberge, et les règles qui s'appliquent à son contenu.",
    updated: UPDATED.fr,
    sections: [
      {
        title: "Éditeur du site",
        paragraphs: [
          "Le site GoodFly est édité par l'agence de voyages GoodFly.",
          `Siège : ${AGENCY.address.fr}.`,
          `Téléphone : ${phones} · E-mail : ${AGENCY.email}.`,
        ],
        list: [
          "Raison sociale : {{à fournir}}",
          "Forme juridique et capital : {{à fournir}}",
          "Registre de commerce (RC) : {{à fournir}}",
          "Identifiant commun de l'entreprise (ICE) : {{à fournir}}",
          "Identifiant fiscal (IF) : {{à fournir}} · Patente : {{à fournir}}",
          "Licence d'agence de voyages n° : {{à fournir}}",
        ],
      },
      { title: "Directeur de la publication", paragraphs: ["{{Nom et fonction — à fournir}}"] },
      {
        title: "Hébergement",
        paragraphs: [
          "Le site est hébergé par Netlify, Inc. (États-Unis), netlify.com.",
          "Les demandes de réservation sont enregistrées dans une base de données Supabase, sur des serveurs situés dans l'Union européenne (Paris).",
        ],
      },
      { title: "Conception et réalisation", paragraphs: ["Mohamed Amine Lamghayri."] },
      {
        title: "Propriété intellectuelle",
        paragraphs: [
          "Le nom GoodFly, le logo et les textes du site appartiennent à GoodFly. Toute reproduction, même partielle, sans autorisation écrite est interdite.",
          "Photographies : {{origine et droits d'utilisation — à vérifier}}.",
        ],
      },
      {
        title: "Offres et prix",
        paragraphs: [
          "Les destinations et programmes présentés sur le site sont donnés à titre indicatif. Les prix, les dates et les places sont confirmés par un conseiller GoodFly au moment de la réservation. Aucun paiement n'est effectué en ligne.",
        ],
      },
      {
        title: "Liens vers d'autres sites",
        paragraphs: ["Le site contient des liens vers des services tiers (WhatsApp, par exemple). GoodFly n'est pas responsable de leur contenu."],
      },
      {
        title: "Droit applicable",
        paragraphs: ["Ces mentions sont régies par le droit marocain. En cas de litige, les tribunaux marocains sont compétents."],
      },
    ],
  },
  privacy: {
    eyebrow: "Vos données",
    title: "Politique de confidentialité",
    intro:
      "Ce que GoodFly fait des informations que vous donnez sur ce site, conformément à la loi marocaine n° 09-08 sur la protection des données personnelles.",
    updated: UPDATED.fr,
    sections: [
      {
        title: "Responsable du traitement",
        paragraphs: [`L'agence de voyages GoodFly, ${AGENCY.address.fr}. E-mail : ${AGENCY.email} · Téléphone : ${phones}.`],
      },
      {
        title: "Les informations que nous recevons",
        paragraphs: ["Quand vous envoyez une demande de réservation, nous recevons :"],
        list: [
          "votre nom, votre téléphone et votre adresse e-mail ;",
          "votre voyage : départ, destination, dates souhaitées, nombre d'adultes et d'enfants, service ou programme choisi, et les précisions que vous écrivez ;",
          "la langue du site que vous utilisez.",
        ],
      },
      {
        title: "Ce que nous ne gardons jamais en clair",
        paragraphs: [
          "Le code à 6 chiffres envoyé par e-mail n'est jamais enregistré tel quel : seule une empreinte chiffrée est gardée, et elle est supprimée au bout de 2 jours.",
          "Votre adresse IP n'est pas enregistrée non plus : nous gardons seulement une empreinte chiffrée et irréversible, qui sert à limiter les abus (par exemple un robot qui envoie des centaines de demandes).",
        ],
      },
      {
        title: "Pourquoi nous les utilisons",
        list: [
          "vous rappeler et préparer votre voyage avec vous ;",
          "vous envoyer le code de vérification et la confirmation de votre demande ;",
          "protéger le formulaire contre les robots et les abus.",
        ],
        after: ["Ces traitements reposent sur votre consentement, donné en cochant la case du formulaire. Vos données ne sont jamais vendues ni louées."],
      },
      {
        title: "Qui y a accès",
        paragraphs: [
          "Seule l'équipe GoodFly autorisée (la Direction et les employés qui suivent les réservations) voit vos demandes, depuis un espace protégé par mot de passe.",
          "Pour faire fonctionner le site, nous utilisons ces services, qui peuvent traiter vos données hors du Maroc :",
        ],
        list: [
          "Supabase : base de données (serveurs dans l'Union européenne) ;",
          "Netlify : hébergement du site ;",
          "Google (Gmail) : envoi des e-mails ;",
          "Cloudflare Turnstile : vérification anti-robot du formulaire.",
        ],
      },
      {
        title: "Durée de conservation",
        paragraphs: [
          "Les demandes de réservation sont gardées {{durée à décider par l'agence, par exemple 3 ans après la dernière demande}}, puis supprimées. Les codes de vérification sont supprimés après 2 jours.",
        ],
      },
      {
        title: "Cookies et stockage dans votre navigateur",
        paragraphs: [
          "Le site n'utilise ni publicité ni outil de mesure d'audience.",
          "Il retient seulement votre choix de thème (clair ou sombre) dans votre navigateur. L'espace équipe utilise les cookies nécessaires à la connexion. La vérification anti-robot de Cloudflare utilise des données techniques de votre navigateur.",
        ],
      },
      {
        title: "Vos droits",
        paragraphs: [
          `Vous pouvez à tout moment demander à voir, corriger ou supprimer vos données, ou vous opposer à leur utilisation. Écrivez à ${AGENCY.email} ou à l'adresse de l'agence, en précisant si possible la référence de votre demande (GF-…).`,
        ],
      },
      {
        title: "Sécurité",
        paragraphs: [
          "Le site est servi en HTTPS. L'espace équipe est réservé aux comptes autorisés, chacun avec ses propres droits, et chaque action importante est inscrite dans un journal.",
        ],
      },
      { title: "Déclaration à la CNDP", paragraphs: ["Récépissé ou autorisation de la CNDP n° : {{à compléter}}."] },
    ],
  },
};

const AR: Record<LegalKind, LegalPage> = {
  mentions: {
    eyebrow: "معلومات قانونية",
    title: "الإشعارات القانونية",
    intro: "من ينشر هذا الموقع، ومن يستضيفه، والقواعد التي تسري على محتواه.",
    updated: UPDATED.ar,
    sections: [
      {
        title: "ناشر الموقع",
        paragraphs: [
          "تنشر موقع GoodFly وكالةُ الأسفار GoodFly.",
          `المقر: ${AGENCY.address.ar}.`,
          `الهاتف: ${phones} · البريد الإلكتروني: ${AGENCY.email}.`,
        ],
        list: [
          "الاسم التجاري: {{يُقدَّم لاحقًا}}",
          "الشكل القانوني ورأس المال: {{يُقدَّم لاحقًا}}",
          "السجل التجاري: {{يُقدَّم لاحقًا}}",
          "التعريف الموحد للمقاولة (ICE): {{يُقدَّم لاحقًا}}",
          "التعريف الضريبي: {{يُقدَّم لاحقًا}} · الضريبة المهنية: {{يُقدَّم لاحقًا}}",
          "رقم رخصة وكالة الأسفار: {{يُقدَّم لاحقًا}}",
        ],
      },
      { title: "مدير النشر", paragraphs: ["{{الاسم والصفة — يُقدَّم لاحقًا}}"] },
      {
        title: "الاستضافة",
        paragraphs: [
          "يُستضاف الموقع لدى شركة Netlify (الولايات المتحدة)، netlify.com.",
          "تُحفَظ طلبات الحجز في قاعدة بيانات Supabase على خوادم داخل الاتحاد الأوروبي (باريس).",
        ],
      },
      { title: "التصميم والإنجاز", paragraphs: ["محمد أمين لمغيري."] },
      {
        title: "الملكية الفكرية",
        paragraphs: [
          "اسم GoodFly وشعارها ونصوص الموقع ملك لـ GoodFly. يُمنع أي نسخ، ولو جزئيًا، دون إذن كتابي.",
          "الصور: {{مصدرها وحقوق استعمالها — يجب التحقق}}.",
        ],
      },
      {
        title: "العروض والأسعار",
        paragraphs: [
          "الوجهات والبرامج المعروضة في الموقع إرشادية. يؤكد مستشار GoodFly الأسعار والتواريخ والأماكن عند الحجز. لا يتم أي دفع عبر الإنترنت.",
        ],
      },
      {
        title: "روابط لمواقع أخرى",
        paragraphs: ["يحتوي الموقع على روابط لخدمات أخرى (مثل واتساب). GoodFly غير مسؤولة عن محتواها."],
      },
      { title: "القانون المطبَّق", paragraphs: ["تخضع هذه الإشعارات للقانون المغربي، وتختص المحاكم المغربية بأي نزاع."] },
    ],
  },
  privacy: {
    eyebrow: "معطياتك",
    title: "سياسة الخصوصية",
    intro: "ما تفعله GoodFly بالمعلومات التي تقدمها في هذا الموقع، وفقًا للقانون المغربي رقم 09-08 المتعلق بحماية المعطيات الشخصية.",
    updated: UPDATED.ar,
    sections: [
      {
        title: "المسؤول عن المعالجة",
        paragraphs: [`وكالة الأسفار GoodFly، ${AGENCY.address.ar}. البريد الإلكتروني: ${AGENCY.email} · الهاتف: ${phones}.`],
      },
      {
        title: "المعلومات التي نتلقاها",
        paragraphs: ["عندما ترسل طلب حجز، نتلقى:"],
        list: [
          "اسمك ورقم هاتفك وبريدك الإلكتروني؛",
          "رحلتك: مكان الانطلاق، الوجهة، التواريخ المرغوبة، عدد الكبار والأطفال، الخدمة أو البرنامج المختار، والتفاصيل التي تكتبها؛",
          "لغة الموقع التي تستعملها.",
        ],
      },
      {
        title: "ما لا نحفظه أبدًا كما هو",
        paragraphs: [
          "الرمز المكون من 6 أرقام المرسل بالبريد لا يُحفظ كما هو أبدًا: تُحفظ بصمة مشفرة فقط، وتُحذف بعد يومين.",
          "لا نحفظ عنوان IP الخاص بك أيضًا: نحتفظ فقط ببصمة مشفرة لا يمكن عكسها، تُستعمل للحد من الإساءة (مثل روبوت يرسل مئات الطلبات).",
        ],
      },
      {
        title: "لماذا نستعملها",
        list: ["للاتصال بك وتحضير رحلتك معك؛", "لإرسال رمز التحقق وتأكيد طلبك؛", "لحماية الاستمارة من الروبوتات والإساءة."],
        after: ["تقوم هذه المعالجة على موافقتك، التي تعطيها بتحديد خانة الاستمارة. لا تُباع معطياتك ولا تُؤجَّر أبدًا."],
      },
      {
        title: "من يطلع عليها",
        paragraphs: [
          "لا يرى طلباتك إلا فريق GoodFly المرخَّص له (الإدارة والموظفون الذين يتابعون الحجوزات)، من فضاء محمي بكلمة مرور.",
          "لتشغيل الموقع نستعمل الخدمات التالية، وقد تعالج معطياتك خارج المغرب:",
        ],
        list: [
          "Supabase: قاعدة البيانات (خوادم داخل الاتحاد الأوروبي)؛",
          "Netlify: استضافة الموقع؛",
          "Google (Gmail): إرسال الرسائل الإلكترونية؛",
          "Cloudflare Turnstile: التحقق من أن مرسل الاستمارة ليس روبوتًا.",
        ],
      },
      {
        title: "مدة الحفظ",
        paragraphs: ["تُحفظ طلبات الحجز {{مدة تحددها الوكالة، مثلًا 3 سنوات بعد آخر طلب}}، ثم تُحذف. وتُحذف رموز التحقق بعد يومين."],
      },
      {
        title: "ملفات تعريف الارتباط والتخزين في متصفحك",
        paragraphs: [
          "لا يستعمل الموقع أي إشهار ولا أي أداة لقياس الزيارات.",
          "يحتفظ فقط باختيارك للمظهر (فاتح أو داكن) في متصفحك. ويستعمل فضاء الفريق ملفات تعريف الارتباط اللازمة لتسجيل الدخول. ويستعمل تحقق Cloudflare معطيات تقنية من متصفحك.",
        ],
      },
      {
        title: "حقوقك",
        paragraphs: [
          `يمكنك في أي وقت أن تطلب الاطلاع على معطياتك أو تصحيحها أو حذفها، أو أن تعترض على استعمالها. اكتب إلى ${AGENCY.email} أو إلى عنوان الوكالة، مع ذكر مرجع طلبك (GF-…) إن أمكن.`,
        ],
      },
      {
        title: "الأمان",
        paragraphs: ["يُقدَّم الموقع عبر HTTPS. فضاء الفريق مخصص للحسابات المرخَّص لها، لكل منها صلاحياتها، وتُسجَّل كل عملية مهمة في سجل."],
      },
      { title: "التصريح لدى اللجنة الوطنية (CNDP)", paragraphs: ["رقم وصل أو إذن اللجنة الوطنية لمراقبة حماية المعطيات: {{يُكمَّل لاحقًا}}."] },
    ],
  },
};

export const legalContent = (lang: Locale, kind: LegalKind): LegalPage => (lang === "ar" ? AR : FR)[kind];
export const LEGAL_PATHS: Record<LegalKind, string> = { mentions: "mentions-legales", privacy: "confidentialite" };
