/* data.js — قاعدة البيانات الفريدة دون أي تكرار */

const DB = {
    department: {
        Department_id: 1,
        Department_name: "نظم معلومات الأعمال (Business Information Systems)",
        code: "BIS",
        head: "أ.د. هشام منصور"
    },

    levels: [
        { Level_Number: 1, Level_name: "الفرقة الأولى", status: "completed", note: "المقررات الأساسية العامة" },
        { Level_Number: 2, Level_name: "الفرقة الثانية", status: "completed", note: "مقررات التخصص الأساسية" },
        { Level_Number: 3, Level_name: "الفرقة الثالثة", status: "current", note: "مشروع تخرج مستقل خاص بالفرقة الثالثة" },
        { Level_Number: 4, Level_name: "الفرقة الرابعة", status: "upcoming", note: "مشروع التخرج النهائي وتكامل النظام" }
    ],

    semesters: [
        { 
            Semester_id: 101, 
            Semester_Name: "الفصل الدراسي الأول", 
            start_date: "2026-09-20", 
            end_date: "2027-01-15",
            schedule_status: "available"
        },
        { 
            Semester_id: 102, 
            Semester_Name: "الفصل الدراسي الثاني", 
            start_date: "2027-02-10", 
            end_date: "2027-06-05",
            schedule_status: "unavailable"
        }
    ],

    // الجدول الأسبوعي: صف واحد لكل مادة (المحاضرة + السكشن معًا بدون تكرار)
    fullWeeklySchedule: [
        {
            day: "الأحد", subject: "إدارة قواعد البيانات المتقدمة",
            lecture: { who: "أ.د. مصطفى كمال", time: "09:00 ص - 11:00 ص", hall: "مدرج 3" },
            section: { who: "م. أحمد محمود", time: "11:15 ص - 01:00 م", hall: "معمل قواعد البيانات (أ)" }
        },
        {
            day: "الإثنين", subject: "تحليل وتصميم النظم",
            lecture: { who: "أ.د. هشام منصور", time: "10:00 ص - 12:00 م", hall: "مدرج 1" },
            section: { who: "م. سارة إبراهيم", time: "12:15 م - 02:00 م", hall: "معمل الحاسب (2)" }
        },
        {
            day: "الثلاثاء", subject: "تطوير تطبيقات الويب",
            lecture: { who: "د. سامح عبد الله", time: "09:00 ص - 11:00 ص", hall: "مدرج 4" },
            section: { who: "م. محمد علي", time: "11:15 ص - 01:00 م", hall: "معمل الويب (ب)" }
        },
        {
            day: "الأربعاء", subject: "ذكاء الأعمال وتحليل البيانات",
            lecture: { who: "د. طارق فؤاد", time: "11:00 ص - 01:00 م", hall: "مدرج 2" },
            section: { who: "م. هبة حسن", time: "01:15 م - 03:00 م", hall: "معمل البرمجيات (1)" }
        }
    ],

    subjects: [
        { Subject_id: 3101, Subject_Name: "إدارة قواعد البيانات المتقدمة", Credits: 3, term: "First", prof: "أ.د. مصطفى كمال", ta: "م. أحمد محمود" },
        { Subject_id: 3102, Subject_Name: "تحليل وتصميم النظم", Credits: 3, term: "First", prof: "أ.د. هشام منصور", ta: "م. سارة إبراهيم" },
        { Subject_id: 3103, Subject_Name: "تطوير تطبيقات الويب", Credits: 3, term: "First", prof: "د. سامح عبد الله", ta: "م. محمد علي" },
        { Subject_id: 3104, Subject_Name: "ذكاء الأعمال وتحليل البيانات", Credits: 2, term: "First", prof: "د. طارق فؤاد", ta: "م. هبة حسن" },
        { Subject_id: 3201, Subject_Name: "تخطيط موارد المؤسسات (ERP)", Credits: 3, term: "Second", prof: "أ.د. هشام منصور", ta: "م. أحمد محمود" },
        { Subject_id: 3202, Subject_Name: "التنقيب في البيانات", Credits: 3, term: "Second", prof: "د. طارق فؤاد", ta: "م. سارة إبراهيم" }
    ],

    student: {
        Student_id: 20230145,
        Student_name: "أحمد محمد علي",
        gender: "ذكر",
        email: "ahmed.ali@university.edu",
        Level_Number: 3,
        password: "1234"
    },

    courses: [
        { 
            course_id: 1, 
            courses_title: "إكسل متقدم للأعمال وتحليل البيانات", 
            Certification: "شهادة إتمام معتمدة", 
            description: "جداول البيانات المتقدمة، اللوحة التفاعلية وتقارير الأعمال الاحترافية التي تمكنك من اتخاذ قرارات دقيقة مبنية على تحليل الأرقام والبيانات الضخمة داخل الشركات والمؤسسات الكبرى.", 
            Cost: 600,
            instructor: "د. خالد عبد الرحمن (متخصص في النمذجة المالية وتحليل الأعمال - خبير معتمد من Microsoft)",
            externalNote: "خبير زائر من شركة Global Tech الاستشارية."
        },
        { 
            course_id: 2, 
            courses_title: "لغة SQL الاحترافية لتحليل البيانات", 
            Certification: "شهادة احترافية معتمدة", 
            description: "كتابة الاستعلامات المعقدة، عمليات الربط المتقدمة بين الجداول واستخراج التقارير البرمجية الفعالة التي تتطلبها كبرى شركات التكنولوجيا وبنوك الاستثمار العالمية.", 
            Cost: 800,
            instructor: "م. رامي الشريف (مهندس قواعد بيانات أول ورئيس فريق هندسة البيانات)",
            externalNote: "محاضر خارجي من شركة Silicon Valley Software."
        },
        { 
            course_id: 3, 
            courses_title: "أساسيات Power BI لوحات المؤشرات", 
            Certification: "شهادة إتمام معتمدة", 
            description: "بناء لوحات مؤشرات الأداء التفاعلية للشركات وربط مصادر البيانات المختلفة لتحويل البيانات الخام إلى لوحات تحكم مرئية جذابة ومفهومة لمتخذي القرار.", 
            Cost: 750,
            instructor: "د. طارق فؤاد (أستاذ مساعد نظم معلومات الأعمال والتحليل الاستراتيجي)",
            externalNote: "عضو هيئة التدريس بالكلية."
        }
    ],

    completedCourses: [
        { course_id: 10, courses_title: "أساسيات البرمجة بلغة جافا", completion_date: "2025-08-12", certificate_url: "#" },
        { course_id: 11, courses_title: "مهارات التواصل وإدارة المشاريع", completion_date: "2025-01-20", certificate_url: "#" }
    ],

    registrations: [
        { term_name: "الفصل الدراسي الأول", period: "من 2026-09-01 إلى 2026-09-20", status: "متاح ومفتوح للتسجيل", subjects: [
            { id: 3101, name: "إدارة قواعد البيانات المتقدمة" },
            { id: 3102, name: "تحليل وتصميم النظم" },
            { id: 3103, name: "تطوير تطبيقات الويب" },
            { id: 3104, name: "ذكاء الأعمال وتحليل البيانات" }
        ]},
        { term_name: "الفصل الدراسي الثاني", period: "— (لم يحن موعد التسجيل بعد، مطلوب تسجيل مواد الترم الأول فقط)", status: "غير متاح حالياً", subjects: [
            { id: 3201, name: "تخطيط موارد المؤسسات (ERP)" },
            { id: 3202, name: "التنقيب في البيانات" }
        ]}
    ],

    maxAllowedAbsentRate: "25%",
    attendanceRecords: [
        { lecture_no: 1, subject: "إدارة قواعد البيانات المتقدمة", date: "2026-09-22", status: "حاضر" },
        { lecture_no: 2, subject: "إدارة قواعد البيانات المتقدمة", date: "2026-09-29", status: "حاضر" },
        { lecture_no: 3, subject: "إدارة قواعد البيانات المتقدمة", date: "2026-10-06", status: "غائب" },
        { lecture_no: 4, subject: "إدارة قواعد البيانات المتقدمة", date: "2026-10-13", status: "حاضر" },
        { lecture_no: 1, subject: "تحليل وتصميم النظم", date: "2026-09-23", status: "حاضر" },
        { lecture_no: 2, subject: "تحليل وتصميم النظم", date: "2026-09-30", status: "حاضر" },
        { lecture_no: 3, subject: "تحليل وتصميم النظم", date: "2026-10-07", status: "حاضر" },
        { lecture_no: 1, subject: "تطوير تطبيقات الويب", date: "2026-09-24", status: "غائب" },
        { lecture_no: 2, subject: "تطوير تطبيقات الويب", date: "2026-10-01", status: "حاضر" }
    ]
};

/* ============================================================
   بيانات إضافية للنسخة التجريبية (Frontend Demo)
   الأساتذة + الطلاب. الحسابات والحضور والدرجات تُبنى في store.js
   ============================================================ */

DB.professors = [
    { Prof_id: 1, name: "أ.د. مصطفى كمال", degree: "دكتور" },
    { Prof_id: 2, name: "أ.د. هشام منصور", degree: "دكتور" },
    { Prof_id: 3, name: "د. سامح عبد الله", degree: "دكتور" },
    { Prof_id: 4, name: "د. طارق فؤاد", degree: "دكتور" },
    { Prof_id: 5, name: "م. أحمد محمود", degree: "معيد" },
    { Prof_id: 6, name: "م. سارة إبراهيم", degree: "معيد" },
    { Prof_id: 7, name: "م. محمد علي", degree: "معيد" },
    { Prof_id: 8, name: "م. هبة حسن", degree: "معيد" }
];

DB.students = [
    { Student_id: 20230145, Student_name: "أحمد محمد علي", gender: "ذكر", email: "ahmed.ali@university.edu", Level_Number: 3, gpa: 3.68 },
    { Student_id: 20230146, Student_name: "سارة خالد حسن", gender: "أنثى", email: "sara.khaled@university.edu", Level_Number: 3, gpa: 3.45 },
    { Student_id: 20230147, Student_name: "محمود إبراهيم السيد", gender: "ذكر", email: "mahmoud.ibrahim@university.edu", Level_Number: 3, gpa: 3.12 },
    { Student_id: 20230148, Student_name: "منى عبد الرحمن فؤاد", gender: "أنثى", email: "mona.abdelrahman@university.edu", Level_Number: 3, gpa: 3.81 },
    { Student_id: 20230149, Student_name: "يوسف طارق عبد الله", gender: "ذكر", email: "youssef.tarek@university.edu", Level_Number: 3, gpa: 2.95 },
    { Student_id: 20230150, Student_name: "نور الدين مصطفى سالم", gender: "ذكر", email: "nour.mostafa@university.edu", Level_Number: 3, gpa: 3.27 },
    { Student_id: 20230151, Student_name: "هدى أحمد زكي", gender: "أنثى", email: "hoda.ahmed@university.edu", Level_Number: 3, gpa: 3.6 },
    { Student_id: 20230152, Student_name: "كريم وليد عثمان", gender: "ذكر", email: "karim.walid@university.edu", Level_Number: 3, gpa: 2.74 }
];
