import { AGENCY } from "@/config/site";
import type { Locale } from "@/i18n/config";

/**
 * Texts of the legal pages. A part written {{like this}} is information the agency still has to
 * give (company numbers, licence…): it is shown highlighted as "to complete" until it is replaced.
 */
/** Rendered in this order: paragraphs, list, then `after`. */
export type LegalSection = { title: string; paragraphs?: string[]; list?: string[]; after?: string[] };
export type LegalPage = { title: string; eyebrow: string; intro: string; updated: string; sections: LegalSection[] };
export type LegalKind = "mentions" | "privacy" | "terms" | "refunds";

const phones = AGENCY.phones.map((p) => p.display).join(" · ");
const UPDATED = { fr: "Dernière mise à jour : 21 novembre 2026", ar: "آخر تحديث: 21 نونبر 2026" };

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
          "après un voyage confirmé, vous envoyer un seul e-mail pour vous demander votre avis ;",
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
        title: "Votre avis après le voyage",
        paragraphs: [
          "Deux jours après votre retour, vous recevez un lien personnel pour noter le voyage. Répondre est libre. Votre avis est relu par l'équipe avant d'être publié sur le site, avec la destination et le mois du voyage.",
          "Votre prénom et l'initiale de votre nom n'apparaissent que si vous cochez la case prévue. Votre e-mail, votre téléphone et votre nom complet ne sont jamais publiés. Vous pouvez demander à tout moment le retrait de votre avis.",
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
  terms: {
    eyebrow: "Informations légales",
    title: "Conditions générales",
    intro:
      "Les règles qui s'appliquent quand vous utilisez ce site et quand vous voyagez avec GoodFly. À lire avant d'envoyer une demande.",
    updated: UPDATED.fr,
    sections: [
      {
        title: "Qui nous sommes",
        paragraphs: [
          `GoodFly est une agence de voyages établie à Salé (${AGENCY.address.fr}), titulaire de la licence n° {{numéro de licence — à fournir}}, exerçant selon la loi n° 31-96 portant statut des agences de voyages.`,
        ],
      },
      {
        title: "Le site",
        paragraphs: [
          "Le site présente les services et les programmes de GoodFly et permet d'envoyer une demande de réservation. Il ne permet pas de payer en ligne.",
          "Les destinations, programmes, prix et dates affichés sont indicatifs. Ils peuvent changer selon les disponibilités des compagnies aériennes, des hôtels et des autres prestataires.",
        ],
      },
      {
        title: "Une demande n'est pas une réservation",
        paragraphs: ["Envoyer le formulaire ne vous engage à rien et n'engage pas GoodFly. Après votre demande :"],
        list: [
          "un conseiller vous contacte pour préciser votre voyage ;",
          "il vous propose une offre écrite (prix, dates, prestations incluses et non incluses, conditions d'annulation) ;",
          "la réservation devient ferme seulement quand vous acceptez cette offre et versez l'acompte demandé.",
        ],
      },
      {
        title: "Prix et paiement",
        paragraphs: [
          "Les prix sont en dirhams marocains (MAD), toutes taxes comprises sauf mention contraire. Le prix confirmé est celui de l'offre écrite, pas celui affiché sur le site.",
          "Les moyens de paiement, le montant de l'acompte et la date du solde sont indiqués dans l'offre écrite de chaque voyage.",
          "Un prix confirmé peut seulement changer dans les cas prévus par la loi (par exemple une hausse des taxes d'aéroport ou du carburant décidée par la compagnie). Vous en êtes informé par écrit avant le départ.",
        ],
      },
      {
        title: "Documents de voyage et visas",
        paragraphs: [
          "Vous devez avoir un passeport valide (souvent 6 mois après le retour) et les documents demandés par le pays de destination.",
          "Pour les visas, GoodFly vous aide à préparer le dossier, mais la décision appartient uniquement au consulat. Un refus de visa ne peut pas être reproché à l'agence. Les frais de consulat et de service déjà engagés ne sont pas remboursables ; le reste suit la politique d'annulation.",
        ],
      },
      {
        title: "Annulation et modification",
        paragraphs: [
          "Les règles d'annulation, de modification et de remboursement sont expliquées dans la page « Annulation et remboursement ». Les conditions précises de votre voyage sont celles de l'offre écrite que vous avez acceptée.",
        ],
      },
      {
        title: "Responsabilité",
        paragraphs: [
          "GoodFly est responsable de la bonne organisation des prestations qu'elle vend. Les compagnies aériennes, hôtels et transporteurs restent responsables de leurs propres services selon leurs conditions.",
          "GoodFly n'est pas responsable des retards, annulations ou changements causés par un cas de force majeure (grève, météo, décision des autorités, épidémie…), ni des conséquences d'un document de voyage manquant ou non valable.",
        ],
      },
      {
        title: "Réclamations",
        paragraphs: [
          `Pour toute réclamation, écrivez à ${AGENCY.email} ou passez à l'agence. Nous répondons dans les meilleurs délais.`,
        ],
      },
      {
        title: "Données personnelles",
        paragraphs: ["Ce que nous faisons de vos informations est expliqué dans la Politique de confidentialité."],
      },
      {
        title: "Droit applicable",
        paragraphs: [
          "Ces conditions sont régies par le droit marocain, notamment la loi n° 31-08 sur la protection du consommateur. En cas de litige, une solution amiable est recherchée d'abord ; à défaut, les tribunaux marocains sont compétents.",
        ],
      },
    ],
  },
  refunds: {
    eyebrow: "Avant de réserver",
    title: "Annulation et remboursement",
    intro: "Ce qui se passe si vous devez annuler ou changer votre voyage, et ce qui peut vous être remboursé.",
    updated: UPDATED.fr,
    sections: [
      {
        title: "Le principe",
        paragraphs: [
          "Un voyage regroupe des prestations que GoodFly paie à l'avance aux compagnies et aux hôtels. Plus l'annulation est proche du départ, plus ces frais sont déjà engagés et ne peuvent pas être récupérés.",
          "Les conditions de votre voyage sont toujours écrites dans l'offre que vous acceptez. Si elles diffèrent de cette page, ce sont elles qui s'appliquent.",
        ],
      },
      {
        title: "Si vous annulez un voyage organisé (programme, séjour)",
        paragraphs: [
          "Il n'y a pas de barème fixe : les frais d'annulation dépendent de ce que GoodFly a déjà payé aux compagnies et aux hôtels au moment de l'annulation. Le conseiller vous les explique dans l'offre, et à nouveau avant d'annuler.",
          "Les billets d'avion, visas et frais de dossier déjà émis suivent les règles ci-dessous, même si l'annulation est faite tôt.",
        ],
      },
      {
        title: "Billets d'avion seuls",
        paragraphs: [
          "Chaque billet suit le tarif de la compagnie aérienne. Beaucoup de tarifs économiques ne sont ni remboursables ni modifiables ; d'autres le sont avec des frais. Le conseiller vous indique les conditions du tarif avant l'émission.",
          "Si la compagnie rembourse, GoodFly vous reverse le montant reçu, moins les éventuels frais de service indiqués dans l'offre. Le délai dépend de la compagnie (souvent plusieurs semaines).",
          "Les taxes d'aéroport d'un billet non utilisé peuvent être remboursées sur demande.",
        ],
      },
      {
        title: "Hôtels",
        paragraphs: [
          "Chaque réservation d'hôtel a sa propre date limite d'annulation gratuite, indiquée dans l'offre. Après cette date, l'hôtel peut facturer une ou plusieurs nuits, ou la totalité du séjour.",
        ],
      },
      {
        title: "Visas",
        paragraphs: [
          "Les frais de consulat et les frais de service GoodFly ne sont pas remboursables une fois le dossier déposé, même en cas de refus.",
          "Si le visa est refusé pour un voyage organisé, les autres prestations sont remboursées selon leurs propres conditions ; présentez la lettre de refus du consulat.",
        ],
      },
      {
        title: "Omra et Hajj",
        paragraphs: [
          "Ces voyages dépendent de quotas et de règles fixés par les autorités saoudiennes et marocaines. Leurs conditions d'annulation sont précisées dans l'offre de chaque programme.",
        ],
      },
      {
        title: "Si GoodFly ou un prestataire annule",
        paragraphs: [
          "Si un voyage est annulé par GoodFly (par exemple faute d'un nombre suffisant de participants), vous choisissez entre un autre voyage équivalent ou le remboursement intégral des sommes versées à l'agence.",
          "Si une compagnie ou un hôtel annule, GoodFly vous propose une solution de remplacement ou vous reverse ce que le prestataire rembourse.",
        ],
      },
      {
        title: "Modifier un voyage",
        paragraphs: [
          "Un changement de dates, de nom ou de prestation est possible si les prestataires l'acceptent. Les frais qu'ils facturent restent à votre charge ; le conseiller vous les annonce avant toute modification.",
        ],
      },
      {
        title: "Comment annuler",
        paragraphs: [
          `Par écrit : e-mail à ${AGENCY.email}, message WhatsApp ou lettre déposée à l'agence. La date de réception fixe les frais. Vous recevez une confirmation écrite.`,
        ],
      },
      {
        title: "Délai et mode de remboursement",
        paragraphs: [
          "Le remboursement est fait par le même moyen que le paiement (ou par virement), dès que possible après votre demande, ou après le remboursement reçu du prestataire quand il en dépend.",
        ],
      },
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
        list: ["للاتصال بك وتحضير رحلتك معك؛", "لإرسال رمز التحقق وتأكيد طلبك؛", "بعد رحلة مؤكدة، لإرسال رسالة إلكترونية واحدة نطلب فيها رأيك؛", "لحماية الاستمارة من الروبوتات والإساءة."],
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
        title: "رأيك بعد الرحلة",
        paragraphs: [
          "بعد عودتك بيومين، تتوصل برابط شخصي لتقييم الرحلة، والإجابة اختيارية. يراجع الفريق رأيك قبل نشره في الموقع مع الوجهة وشهر الرحلة.",
          "لا يظهر اسمك الأول والحرف الأول من اسمك العائلي إلا إذا حددت الخانة المخصصة لذلك. لا يُنشر أبدًا بريدك الإلكتروني ولا هاتفك ولا اسمك الكامل، ويمكنك في أي وقت طلب سحب رأيك.",
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
  terms: {
    eyebrow: "معلومات قانونية",
    title: "الشروط العامة",
    intro: "القواعد التي تطبَّق عند استعمالك لهذا الموقع وعند سفرك مع GoodFly. يُرجى قراءتها قبل إرسال أي طلب.",
    updated: UPDATED.ar,
    sections: [
      {
        title: "من نحن",
        paragraphs: [
          `GoodFly وكالة أسفار مقرها بسلا (${AGENCY.address.ar})، حاصلة على الرخصة رقم {{رقم الرخصة — يُقدَّم لاحقًا}}، وتعمل وفق القانون رقم 31-96 المتعلق بالنظام الأساسي لوكالات الأسفار.`,
        ],
      },
      {
        title: "الموقع",
        paragraphs: [
          "يعرض الموقع خدمات وبرامج GoodFly ويتيح إرسال طلب حجز. لا يمكن الأداء عبر الموقع.",
          "الوجهات والبرامج والأسعار والتواريخ المعروضة إرشادية، وقد تتغير حسب توفر شركات الطيران والفنادق وباقي مقدمي الخدمات.",
        ],
      },
      {
        title: "الطلب ليس حجزًا",
        paragraphs: ["إرسال الاستمارة لا يُلزمك بشيء ولا يُلزم GoodFly. بعد طلبك:"],
        list: [
          "يتصل بك مستشار لتحديد تفاصيل رحلتك؛",
          "يقترح عليك عرضًا مكتوبًا (السعر، التواريخ، الخدمات المشمولة وغير المشمولة، شروط الإلغاء)؛",
          "يصبح الحجز نهائيًا فقط عند قبولك لهذا العرض ودفع التسبيق المطلوب.",
        ],
      },
      {
        title: "الأسعار والأداء",
        paragraphs: [
          "الأسعار بالدرهم المغربي، شاملة لجميع الرسوم ما لم يُذكر خلاف ذلك. السعر المعتمد هو سعر العرض المكتوب، وليس السعر المعروض في الموقع.",
          "وسائل الأداء ومبلغ التسبيق وأجل أداء الباقي مذكورة في العرض المكتوب لكل رحلة.",
          "لا يتغير السعر المعتمد إلا في الحالات التي يسمح بها القانون (مثل ارتفاع رسوم المطار أو الوقود الذي تقرره شركة الطيران)، ويتم إخبارك كتابيًا قبل المغادرة.",
        ],
      },
      {
        title: "وثائق السفر والتأشيرات",
        paragraphs: [
          "يجب أن يكون لديك جواز سفر صالح (غالبًا 6 أشهر بعد العودة) والوثائق التي يطلبها بلد الوجهة.",
          "بالنسبة للتأشيرات، تساعدك GoodFly في إعداد الملف، لكن القرار يعود للقنصلية وحدها، ولا تتحمل الوكالة مسؤولية رفض التأشيرة. رسوم القنصلية ورسوم الخدمة المدفوعة غير قابلة للاسترجاع، والباقي يخضع لسياسة الإلغاء.",
        ],
      },
      {
        title: "الإلغاء والتعديل",
        paragraphs: [
          "قواعد الإلغاء والتعديل والاسترجاع مشروحة في صفحة « الإلغاء والاسترجاع ». والشروط الدقيقة لرحلتك هي المكتوبة في العرض الذي قبلته.",
        ],
      },
      {
        title: "المسؤولية",
        paragraphs: [
          "تتحمل GoodFly مسؤولية حسن تنظيم الخدمات التي تبيعها. وتبقى شركات الطيران والفنادق والناقلون مسؤولين عن خدماتهم وفق شروطهم.",
          "لا تتحمل GoodFly مسؤولية التأخير أو الإلغاء أو التغيير الناتج عن قوة قاهرة (إضراب، أحوال جوية، قرار السلطات، وباء…)، ولا عواقب نقص وثيقة سفر أو عدم صلاحيتها.",
        ],
      },
      {
        title: "الشكايات",
        paragraphs: [`لأي شكاية، راسلنا على ${AGENCY.email} أو زر الوكالة. نجيبك في أقرب الآجال.`],
      },
      {
        title: "المعطيات الشخصية",
        paragraphs: ["طريقة تعاملنا مع معلوماتك مشروحة في سياسة الخصوصية."],
      },
      {
        title: "القانون المطبَّق",
        paragraphs: [
          "تخضع هذه الشروط للقانون المغربي، ولا سيما القانون رقم 31-08 المتعلق بحماية المستهلك. في حالة النزاع، يُبحث أولًا عن حل ودي، وإلا تختص المحاكم المغربية.",
        ],
      },
    ],
  },
  refunds: {
    eyebrow: "قبل الحجز",
    title: "الإلغاء والاسترجاع",
    intro: "ما يحدث إذا اضطررت لإلغاء رحلتك أو تغييرها، وما يمكن استرجاعه.",
    updated: UPDATED.ar,
    sections: [
      {
        title: "المبدأ",
        paragraphs: [
          "تجمع الرحلة خدمات تدفعها GoodFly مسبقًا لشركات الطيران والفنادق. وكلما اقترب الإلغاء من تاريخ المغادرة، كانت هذه المصاريف قد صُرفت ولا يمكن استرجاعها.",
          "شروط رحلتك مكتوبة دائمًا في العرض الذي تقبله، وإذا اختلفت عن هذه الصفحة فهي التي تُطبَّق.",
        ],
      },
      {
        title: "إذا ألغيت رحلة منظمة (برنامج، إقامة)",
        paragraphs: [
          "لا يوجد سُلَّم ثابت: مصاريف الإلغاء تتوقف على ما دفعته GoodFly لشركات الطيران والفنادق عند تاريخ الإلغاء. يشرحها لك المستشار في العرض، ومرة أخرى قبل الإلغاء.",
          "تذاكر الطيران والتأشيرات ومصاريف الملف الصادرة تخضع للقواعد أسفله، حتى لو تم الإلغاء مبكرًا.",
        ],
      },
      {
        title: "تذاكر الطيران وحدها",
        paragraphs: [
          "تخضع كل تذكرة لتسعيرة شركة الطيران. كثير من التسعيرات الاقتصادية غير قابلة للاسترجاع ولا للتعديل، وبعضها قابل لذلك مع مصاريف. يُعلمك المستشار بشروط التسعيرة قبل إصدار التذكرة.",
          "إذا استرجعت الشركة المبلغ، تعيد لك GoodFly ما توصلت به، ناقص مصاريف الخدمة المذكورة في العرض إن وُجدت. المدة تتوقف على الشركة (غالبًا عدة أسابيع).",
          "يمكن استرجاع رسوم المطار لتذكرة لم تُستعمل عند الطلب.",
        ],
      },
      {
        title: "الفنادق",
        paragraphs: [
          "لكل حجز فندقي آخر أجل للإلغاء المجاني، مذكور في العرض. بعد هذا الأجل، يمكن للفندق احتساب ليلة أو أكثر، أو الإقامة كاملة.",
        ],
      },
      {
        title: "التأشيرات",
        paragraphs: [
          "رسوم القنصلية ورسوم خدمة GoodFly غير قابلة للاسترجاع بعد إيداع الملف، حتى في حالة الرفض.",
          "إذا رُفضت التأشيرة في إطار رحلة منظمة، تُسترجع باقي الخدمات حسب شروطها الخاصة، مع تقديم رسالة الرفض من القنصلية.",
        ],
      },
      {
        title: "العمرة والحج",
        paragraphs: [
          "ترتبط هذه الرحلات بحصص وقواعد تحددها السلطات السعودية والمغربية، وشروط إلغائها مذكورة في عرض كل برنامج.",
        ],
      },
      {
        title: "إذا ألغت GoodFly أو أحد مقدمي الخدمات",
        paragraphs: [
          "إذا ألغت GoodFly رحلة (مثلًا لعدم اكتمال العدد)، تختار بين رحلة أخرى مماثلة أو استرجاع كامل المبالغ المدفوعة للوكالة.",
          "إذا ألغت شركة طيران أو فندق، تقترح عليك GoodFly حلًا بديلًا أو تعيد لك ما يسترجعه مقدم الخدمة.",
        ],
      },
      {
        title: "تعديل الرحلة",
        paragraphs: [
          "يمكن تغيير التواريخ أو الاسم أو الخدمة إذا قبل مقدمو الخدمات ذلك. وتبقى على عاتقك المصاريف التي يحتسبونها، ويُعلمك المستشار بها قبل أي تعديل.",
        ],
      },
      {
        title: "كيف تلغي",
        paragraphs: [
          `كتابيًا: بريد إلكتروني إلى ${AGENCY.email}، أو رسالة واتساب، أو رسالة تودعها بالوكالة. تاريخ التوصل هو الذي يحدد المصاريف، وتتوصل بتأكيد مكتوب.`,
        ],
      },
      {
        title: "أجل وطريقة الاسترجاع",
        paragraphs: [
          "يتم الاسترجاع بنفس وسيلة الأداء (أو بتحويل بنكي) في أقرب وقت بعد طلبك، أو بعد توصلنا بالمبلغ من مقدم الخدمة عندما يتوقف الأمر عليه.",
        ],
      },
    ],
  },
};

export const legalContent = (lang: Locale, kind: LegalKind): LegalPage => (lang === "ar" ? AR : FR)[kind];
export const LEGAL_PATHS: Record<LegalKind, string> = {
  mentions: "mentions-legales",
  privacy: "confidentialite",
  terms: "conditions",
  refunds: "annulation-remboursement",
};
