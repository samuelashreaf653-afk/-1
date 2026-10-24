/* ============================================================
   store.js — طبقة البيانات والصلاحيات (نسخة تجريبية Frontend Demo)
   ------------------------------------------------------------
   تنبيه: كل شيء هنا يعمل داخل المتصفح فقط (localStorage).
   تسجيل الدخول والصلاحيات وسجلات الحضور "لعرض الفكرة" وليست آمنة
   ولا تصلح للاستخدام الفعلي. الأمان الحقيقي يحتاج Backend وقاعدة بيانات.
   ============================================================ */

const Store = (() => {
    const KEY = "acp_demo_v2";
    const SESSION_KEY = "acp_demo_session";
    const PERSIST = ["professors", "students", "subjects", "courses", "fullWeeklySchedule", "sessions", "attendance", "grades", "accounts"];
    const SESSION_MINUTES = 10;   // مدة فتح المحاضرة للتسجيل
    const SLOT_MS = 20000;        // الـ QR يتغير كل 20 ثانية
    const ROLE_LABEL = { student: "طالب", doctor: "دكتور", admin: "أدمن" };
    const MAX = { midterm: 20, coursework: 20, final: 60 };

    let seedSnapshot = null;

    const clone = (o) => JSON.parse(JSON.stringify(o));
    const now = () => Date.now();
    const pad = (n) => String(n).padStart(2, "0");
    function todayStr() {
        const d = new Date();
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    /* ---------- بناء البيانات الابتدائية ---------- */
    function subjectIdByName(name) {
        const s = DB.subjects.find((x) => x.Subject_Name === name);
        return s ? s.Subject_id : null;
    }

    function buildAccounts() {
        const acc = [{ username: "admin", password: "1234", role: "admin", ref: 0, name: "مدير النظام" }];
        DB.professors.filter((p) => p.degree === "دكتور").forEach((p, i) => {
            acc.push({ username: i === 0 ? "doctor" : "doctor" + (i + 1), password: "1234", role: "doctor", ref: p.Prof_id, name: p.name });
        });
        acc.push({ username: "student", password: "1234", role: "student", ref: DB.student.Student_id, name: DB.student.Student_name });
        DB.students.forEach((s) => {
            acc.push({ username: String(s.Student_id), password: "1234", role: "student", ref: s.Student_id, name: s.Student_name });
        });
        return acc;
    }

    function buildAttendance() {
        const sessions = [];
        const attendance = {};
        const rows = DB.attendanceRecords.map((r) => ({ sid: subjectIdByName(r.subject), no: r.lecture_no, date: r.date, present: r.status === "حاضر" }));
        rows.push({ sid: 3104, no: 1, date: "2026-10-14", present: true });
        rows.forEach((r) => {
            const id = `S-${r.sid}-${r.no}`;
            sessions.push({ id, Subject_id: r.sid, lecture_no: r.no, date: r.date, status: "closed", secret: null, endsAt: null, createdBy: "seed" });
            attendance[id] = {};
            DB.students.forEach((st, i) => {
                const present = st.Student_id === DB.student.Student_id ? r.present : ((i * 7 + r.no * 3 + (r.sid % 10)) % 5) !== 0;
                attendance[id][st.Student_id] = { status: present ? "present" : "absent", method: "seed", at: r.date };
            });
        });
        return { sessions, attendance };
    }

    function buildGrades() {
        const g = {};
        DB.subjects.filter((s) => s.term === "First").forEach((s) => {
            g[s.Subject_id] = {};
            DB.students.forEach((st, i) => {
                g[s.Subject_id][st.Student_id] = {
                    midterm: 10 + ((i * 3 + s.Subject_id) % 10),
                    coursework: 12 + ((i * 5 + s.Subject_id) % 9),
                    final: null
                };
            });
        });
        return g;
    }

    function initSeed() {
        DB.fullWeeklySchedule.forEach((r, i) => { if (!r.id) r.id = i + 1; });
        DB.accounts = buildAccounts();
        const att = buildAttendance();
        DB.sessions = att.sessions;
        DB.attendance = att.attendance;
        DB.grades = buildGrades();
        seedSnapshot = {};
        PERSIST.forEach((k) => (seedSnapshot[k] = clone(DB[k])));
    }

    /* ---------- حفظ وتحميل (localStorage) ---------- */
    function save() {
        try {
            const o = { v: 2 };
            PERSIST.forEach((k) => (o[k] = DB[k]));
            localStorage.setItem(KEY, JSON.stringify(o));
        } catch (e) { /* التخزين غير متاح: نكمل بدون حفظ */ }
    }

    function load() {
        try {
            const raw = localStorage.getItem(KEY);
            if (!raw) return;
            const o = JSON.parse(raw);
            if (o.v !== 2) return;
            PERSIST.forEach((k) => { if (o[k] !== undefined) DB[k] = o[k]; });
        } catch (e) { /* بيانات تالفة: نتجاهلها */ }
    }

    function expireSessions() {
        let changed = false;
        DB.sessions.forEach((s) => {
            if (s.status === "open" && now() >= s.endsAt) { s.status = "closed"; changed = true; }
        });
        if (changed) save();
    }

    // مزامنة مع التخزين (لو التبويب الآخر غيّر شيئًا)
    function sync() { load(); expireSessions(); }

    function reset() {
        PERSIST.forEach((k) => (DB[k] = clone(seedSnapshot[k])));
        try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
        save();
    }

    /* ---------- الدخول والصلاحيات (محاكاة) ---------- */
    function login(role, username, password) {
        sync();
        const u = String(username || "").trim().toLowerCase();
        const acc = DB.accounts.find((a) => a.username.toLowerCase() === u && a.password === password);
        if (!acc) throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة.");
        if (acc.role !== role) throw new Error(`هذا الحساب خاص بـ (${ROLE_LABEL[acc.role]}). اختر تبويب "${ROLE_LABEL[acc.role]}" من الأعلى.`);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ username: acc.username, role: acc.role }));
        return current();
    }

    function current() {
        let s;
        try { s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch (e) { s = null; }
        if (!s) return null;
        const acc = DB.accounts.find((a) => a.username === s.username && a.role === s.role);
        if (!acc) return null;
        const user = { username: acc.username, role: acc.role, ref: acc.ref, name: acc.name };
        if (acc.role === "student") {
            user.student = DB.students.find((x) => x.Student_id === acc.ref);
            if (!user.student) return null;
        }
        if (acc.role === "doctor") {
            user.professor = DB.professors.find((p) => p.Prof_id === acc.ref);
            if (!user.professor) return null;
        }
        return user;
    }

    function logout() { sessionStorage.removeItem(SESSION_KEY); }

    function need(...roles) {
        const u = current();
        if (!u || !roles.includes(u.role)) throw new Error("غير مسموح لهذا الدور بتنفيذ هذا الإجراء (محاكاة صلاحيات للعرض فقط).");
        return u;
    }

    function canManageSubject(u, sid) {
        if (u.role === "admin") return true;
        if (u.role !== "doctor") return false;
        const s = DB.subjects.find((x) => x.Subject_id === sid);
        return !!(s && u.professor && (s.prof === u.professor.name || s.ta === u.professor.name));
    }

    // ملاحظة: لا تستدعي sync() هنا؛ كل دالة تستدعيها أولاً حتى لا تفقد مراجع الصفوف
    function needSubject(sid) {
        const u = need("doctor", "admin");
        if (!canManageSubject(u, sid)) throw new Error("هذه المادة ليست ضمن المواد المسندة إليك.");
        return u;
    }

    /* ---------- استعلامات ---------- */
    const subjectById = (sid) => DB.subjects.find((s) => s.Subject_id === Number(sid));
    const isEnrolled = (studentId, sid) => { const s = subjectById(sid); return !!s && s.term === "First"; };
    const enrolledStudents = (sid) => (isEnrolled(0, sid) ? DB.students : []);

    function mySubjects(u) {
        return DB.subjects.filter((s) => canManageSubject(u, s.Subject_id));
    }

    function subjectsOfProfessor(p) {
        return DB.subjects.filter((s) => s.prof === p.name || s.ta === p.name);
    }

    function sessionsOf(sid, student) {
        return DB.sessions
            .filter((s) => s.Subject_id === Number(sid) && (!student || !student.joined || s.date >= student.joined))
            .sort((a, b) => a.lecture_no - b.lecture_no);
    }

    function attendanceOf(sessionId, studentId) {
        const rec = (DB.attendance[sessionId] || {})[studentId];
        return rec ? rec.status : "absent";
    }

    function attendanceStats(sid, student) {
        const list = sessionsOf(sid, student);
        const present = list.filter((s) => attendanceOf(s.id, student.Student_id) === "present").length;
        const total = list.length;
        const absent = total - present;
        const rate = total ? Math.round((absent / total) * 100) : 0;
        return { total, present, absent, rate, exceeded: total > 0 && rate > parseInt(DB.maxAllowedAbsentRate, 10) };
    }

    function studentAttendanceRows(student) {
        const rows = [];
        DB.subjects.forEach((sub) => {
            sessionsOf(sub.Subject_id, student).forEach((s) => {
                const rec = (DB.attendance[s.id] || {})[student.Student_id];
                rows.push({ subject: sub.Subject_Name, Subject_id: sub.Subject_id, lecture_no: s.lecture_no, date: s.date, status: rec ? rec.status : "absent", method: rec ? rec.method : "seed" });
            });
        });
        return rows;
    }

    function gradeOf(sid, studentId) {
        const g = (DB.grades[sid] || {})[studentId];
        return g || { midterm: null, coursework: null, final: null };
    }

    function gradeTotal(g) {
        const vals = [g.midterm, g.coursework, g.final].filter((v) => v !== null && v !== undefined);
        return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
    }

    function gradeLetter(g) {
        if ([g.midterm, g.coursework, g.final].some((v) => v === null || v === undefined)) return "—";
        const t = gradeTotal(g);
        if (t >= 90) return "A+";
        if (t >= 85) return "A";
        if (t >= 80) return "B+";
        if (t >= 75) return "B";
        if (t >= 70) return "C+";
        if (t >= 65) return "C";
        if (t >= 60) return "D";
        return "F";
    }

    /* ---------- جلسات المحاضرات و QR ---------- */
    function genSecret() { return Math.random().toString(36).slice(2, 10) + now().toString(36); }
    function hash(str) {
        let h = 2166136261;
        for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
        return (h >>> 0).toString(36);
    }
    const slotNow = (t) => Math.floor((t === undefined ? now() : t) / SLOT_MS);
    const nonceFor = (s, slot) => hash(s.secret + ":" + slot);
    const isOpen = (s) => s.status === "open" && now() < s.endsAt;
    const tokenFor = (s, t) => `ACP1|${s.id}|${nonceFor(s, slotNow(t))}`;
    const msToNextSlot = () => SLOT_MS - (now() % SLOT_MS);

    function openSessionOf(sid) { return DB.sessions.find((s) => s.Subject_id === Number(sid) && isOpen(s)) || null; }

    function startSession(sid) {
        sync();
        sid = Number(sid);
        const u = needSubject(sid);
        const sub = subjectById(sid);
        if (sub.term !== "First") throw new Error("الفصل الدراسي الثاني غير متاح حالياً، لا يمكن بدء محاضرة لمادة من الترم الثاني.");
        if (openSessionOf(sid)) throw new Error("توجد محاضرة مفتوحة بالفعل لهذه المادة. أنهِها أولاً.");
        const no = Math.max(0, ...DB.sessions.filter((s) => s.Subject_id === sid).map((s) => s.lecture_no)) + 1;
        const id = `S-${sid}-${no}`;
        const s = { id, Subject_id: sid, lecture_no: no, date: todayStr(), status: "open", secret: genSecret(), openedAt: now(), endsAt: now() + SESSION_MINUTES * 60000, createdBy: u.username };
        DB.sessions.push(s);
        DB.attendance[id] = {};
        save();
        return s;
    }

    function closeSession(sessionId) {
        sync();
        const s = DB.sessions.find((x) => x.id === sessionId);
        if (!s) throw new Error("المحاضرة غير موجودة.");
        needSubject(s.Subject_id);
        s.status = "closed";
        save();
    }

    function markAttendance(sessionId, studentId, status) {
        sync();
        const s = DB.sessions.find((x) => x.id === sessionId);
        if (!s) throw new Error("المحاضرة غير موجودة.");
        needSubject(s.Subject_id);
        if (!["present", "absent"].includes(status)) throw new Error("حالة غير صحيحة.");
        const st = DB.students.find((x) => x.Student_id === Number(studentId));
        if (!st) throw new Error("الطالب غير موجود.");
        (DB.attendance[sessionId] || (DB.attendance[sessionId] = {}))[st.Student_id] = { status, method: "manual", at: new Date().toISOString() };
        save();
    }

    function scanAttendance(token) {
        sync();
        const u = need("student");
        const parts = String(token || "").trim().split("|");
        if (parts.length !== 3 || parts[0] !== "ACP1") throw new Error("رمز QR غير صالح لهذه المنصة.");
        const s = DB.sessions.find((x) => x.id === parts[1]);
        if (!s) throw new Error("المحاضرة غير موجودة.");
        if (!isOpen(s)) throw new Error("هذه المحاضرة مغلقة أو انتهى وقت التسجيل.");
        const slot = slotNow();
        if (!(nonceFor(s, slot) === parts[2] || nonceFor(s, slot - 1) === parts[2])) {
            throw new Error("انتهت صلاحية هذا الرمز. امسح الرمز الحالي المعروض على شاشة الدكتور.");
        }
        if (!isEnrolled(u.student.Student_id, s.Subject_id)) throw new Error("أنت غير مسجل في هذه المادة.");
        const sub = subjectById(s.Subject_id);
        const rec = DB.attendance[s.id] || (DB.attendance[s.id] = {});
        const existing = rec[u.student.Student_id];
        if (existing && existing.status === "present") {
            return { duplicate: true, subject: sub.Subject_Name, lecture_no: s.lecture_no, time: existing.at };
        }
        const at = new Date().toISOString();
        rec[u.student.Student_id] = { status: "present", method: "qr", at };
        save();
        return { duplicate: false, subject: sub.Subject_Name, lecture_no: s.lecture_no, time: at };
    }

    function setGrade(sid, studentId, field, value) {
        sync();
        sid = Number(sid);
        needSubject(sid);
        if (!MAX[field]) throw new Error("حقل غير معروف.");
        if (!DB.students.some((s) => s.Student_id === Number(studentId))) throw new Error("الطالب غير موجود.");
        let v = null;
        if (value !== "" && value !== null && value !== undefined) {
            v = Number(value);
            if (isNaN(v) || v < 0 || v > MAX[field]) throw new Error(`الدرجة يجب أن تكون رقمًا بين 0 و ${MAX[field]}.`);
        }
        const bySubject = DB.grades[sid] || (DB.grades[sid] = {});
        const g = bySubject[studentId] || (bySubject[studentId] = { midterm: null, coursework: null, final: null });
        g[field] = v;
        save();
    }

    /* ---------- إدارة البيانات (أدمن فقط) ---------- */
    const nextId = (arr, f, start) => Math.max(start - 1, ...arr.map((x) => x[f])) + 1;
    const txt = (v) => String(v === undefined || v === null ? "" : v).trim();
    function req(v, label) { if (!txt(v)) throw new Error(`حقل "${label}" مطلوب.`); return txt(v); }
    function posInt(v, label) {
        const n = Number(v);
        if (!Number.isInteger(n) || n <= 0) throw new Error(`"${label}" يجب أن يكون رقمًا صحيحًا موجبًا.`);
        return n;
    }

    const ENTITIES = {
        students: {
            arr: () => DB.students, id: "Student_id",
            add(d) {
                const id = posInt(d.Student_id, "الرقم الجامعي");
                if (DB.students.some((s) => s.Student_id === id)) throw new Error("الرقم الجامعي مستخدم بالفعل.");
                if (DB.accounts.some((a) => a.username.toLowerCase() === String(id))) throw new Error("اسم المستخدم مستخدم بالفعل.");
                const pass = req(d.password, "كلمة المرور");
                if (pass.length < 4) throw new Error("كلمة المرور يجب ألا تقل عن 4 أحرف.");
                const row = this.build(d);
                row.Student_id = id;
                row.joined = todayStr();
                DB.students.push(row);
                DB.accounts.push({ username: String(id), password: pass, role: "student", ref: id, name: row.Student_name });
            },
            build(d) {
                const gpa = Number(d.gpa);
                if (isNaN(gpa) || gpa < 0 || gpa > 4) throw new Error("المعدل التراكمي يجب أن يكون بين 0 و 4.");
                const email = txt(d.email);
                if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new Error("البريد الإلكتروني غير صالح.");
                return { Student_name: req(d.Student_name, "اسم الطالب"), gender: d.gender === "أنثى" ? "أنثى" : "ذكر", email, Level_Number: posInt(d.Level_Number || 3, "الفرقة"), gpa };
            },
            update(row, d) {
                const nr = this.build(d);
                Object.assign(row, nr);
                DB.accounts.filter((a) => a.role === "student" && a.ref === row.Student_id).forEach((a) => {
                    a.name = row.Student_name;
                    if (txt(d.password)) {
                        if (txt(d.password).length < 4) throw new Error("كلمة المرور يجب ألا تقل عن 4 أحرف.");
                        a.password = txt(d.password);
                    }
                });
            },
            remove(row) {
                DB.students = DB.students.filter((s) => s !== row);
                DB.accounts = DB.accounts.filter((a) => !(a.role === "student" && a.ref === row.Student_id));
                Object.keys(DB.attendance).forEach((k) => delete DB.attendance[k][row.Student_id]);
                Object.keys(DB.grades).forEach((k) => delete DB.grades[k][row.Student_id]);
            }
        },

        subjects: {
            arr: () => DB.subjects, id: "Subject_id",
            add(d) {
                const id = posInt(d.Subject_id, "كود المادة");
                if (DB.subjects.some((s) => s.Subject_id === id)) throw new Error("كود المادة مستخدم بالفعل.");
                const row = this.build(d);
                row.Subject_id = id;
                DB.subjects.push(row);
                if (row.term === "First") {
                    DB.grades[id] = {};
                    DB.students.forEach((st) => (DB.grades[id][st.Student_id] = { midterm: null, coursework: null, final: null }));
                }
            },
            build(d, existing) {
                const name = req(d.Subject_Name, "اسم المادة");
                if (DB.subjects.some((s) => s.Subject_Name === name && s !== existing)) throw new Error("اسم المادة مستخدم بالفعل.");
                const prof = req(d.prof, "الأستاذ"), ta = req(d.ta, "المعيد");
                if (!DB.professors.some((p) => p.name === prof && p.degree === "دكتور")) throw new Error("اختر دكتورًا من القائمة.");
                if (!DB.professors.some((p) => p.name === ta && p.degree === "معيد")) throw new Error("اختر معيدًا من القائمة.");
                return { Subject_Name: name, Credits: posInt(d.Credits, "الساعات"), term: d.term === "Second" ? "Second" : "First", prof, ta };
            },
            update(row, d) {
                const nr = this.build(d, row);
                if (nr.Subject_Name !== row.Subject_Name) {
                    DB.fullWeeklySchedule.forEach((r) => { if (r.subject === row.Subject_Name) r.subject = nr.Subject_Name; });
                }
                Object.assign(row, nr);
            },
            remove(row) {
                DB.subjects = DB.subjects.filter((s) => s !== row);
                DB.sessions.filter((s) => s.Subject_id === row.Subject_id).forEach((s) => delete DB.attendance[s.id]);
                DB.sessions = DB.sessions.filter((s) => s.Subject_id !== row.Subject_id);
                delete DB.grades[row.Subject_id];
                DB.fullWeeklySchedule = DB.fullWeeklySchedule.filter((r) => r.subject !== row.Subject_Name);
            }
        },

        professors: {
            arr: () => DB.professors, id: "Prof_id",
            add(d) {
                const row = this.build(d);
                row.Prof_id = nextId(DB.professors, "Prof_id", 1);
                if (row.degree === "دكتور") {
                    const un = req(d.username, "اسم مستخدم الدكتور").toLowerCase();
                    if (DB.accounts.some((a) => a.username.toLowerCase() === un)) throw new Error("اسم المستخدم مستخدم بالفعل.");
                    const pass = req(d.password, "كلمة المرور");
                    if (pass.length < 4) throw new Error("كلمة المرور يجب ألا تقل عن 4 أحرف.");
                    DB.accounts.push({ username: un, password: pass, role: "doctor", ref: row.Prof_id, name: row.name });
                }
                DB.professors.push(row);
            },
            build(d, existing) {
                const name = req(d.name, "الاسم");
                if (DB.professors.some((p) => p.name === name && p !== existing)) throw new Error("الاسم مستخدم بالفعل.");
                return { name, degree: d.degree === "معيد" ? "معيد" : "دكتور" };
            },
            update(row, d) {
                const nr = this.build(d, row);
                if (nr.degree !== row.degree && Store.subjectsOfProfessor(row).length) throw new Error("لا يمكن تغيير الدرجة العلمية لأستاذ مرتبط بمواد.");
                if (nr.name !== row.name) {
                    DB.subjects.forEach((s) => { if (s.prof === row.name) s.prof = nr.name; if (s.ta === row.name) s.ta = nr.name; });
                    DB.fullWeeklySchedule.forEach((r) => {
                        if (r.lecture.who === row.name) r.lecture.who = nr.name;
                        if (r.section.who === row.name) r.section.who = nr.name;
                    });
                }
                DB.accounts.filter((a) => a.role === "doctor" && a.ref === row.Prof_id).forEach((a) => {
                    a.name = nr.name;
                    if (txt(d.password)) {
                        if (txt(d.password).length < 4) throw new Error("كلمة المرور يجب ألا تقل عن 4 أحرف.");
                        a.password = txt(d.password);
                    }
                });
                Object.assign(row, nr);
            },
            remove(row) {
                if (Store.subjectsOfProfessor(row).length) throw new Error("لا يمكن حذف أستاذ مرتبط بمواد. غيّر مسؤول المواد أولاً.");
                DB.professors = DB.professors.filter((p) => p !== row);
                DB.accounts = DB.accounts.filter((a) => !(a.role === "doctor" && a.ref === row.Prof_id));
            }
        },

        courses: {
            arr: () => DB.courses, id: "course_id",
            add(d) { const row = this.build(d); row.course_id = nextId(DB.courses, "course_id", 1); DB.courses.push(row); },
            build(d) {
                const cost = Number(d.Cost);
                if (isNaN(cost) || cost < 0) throw new Error("السعر يجب أن يكون رقمًا صحيحًا غير سالب.");
                return {
                    courses_title: req(d.courses_title, "اسم الكورس"), Certification: req(d.Certification, "نوع الشهادة"),
                    description: req(d.description, "الوصف"), Cost: cost, instructor: req(d.instructor, "المحاضر"), externalNote: txt(d.externalNote)
                };
            },
            update(row, d) { Object.assign(row, this.build(d)); },
            remove(row) { DB.courses = DB.courses.filter((c) => c !== row); }
        },

        schedule: {
            arr: () => DB.fullWeeklySchedule, id: "id",
            add(d) { const row = this.build(d); row.id = nextId(DB.fullWeeklySchedule, "id", 1); DB.fullWeeklySchedule.push(row); },
            build(d) {
                const subj = req(d.subject, "المادة");
                if (!DB.subjects.some((s) => s.Subject_Name === subj)) throw new Error("اختر مادة من القائمة.");
                const days = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس"];
                if (!days.includes(d.day)) throw new Error("اختر اليوم.");
                return {
                    day: d.day, subject: subj,
                    lecture: { who: req(d.lec_who, "المحاضر"), time: req(d.lec_time, "توقيت المحاضرة"), hall: req(d.lec_hall, "القاعة") },
                    section: { who: req(d.sec_who, "المعيد"), time: req(d.sec_time, "توقيت السكشن"), hall: req(d.sec_hall, "المعمل") }
                };
            },
            update(row, d) { Object.assign(row, this.build(d)); },
            remove(row) { DB.fullWeeklySchedule = DB.fullWeeklySchedule.filter((r) => r !== row); }
        }
    };

    const crud = {
        list(entity) { sync(); need("admin"); return ENTITIES[entity].arr(); },
        add(entity, data) { sync(); need("admin"); ENTITIES[entity].add(data); save(); },
        update(entity, id, data) {
            sync(); need("admin");
            const e = ENTITIES[entity];
            const row = e.arr().find((r) => String(r[e.id]) === String(id));
            if (!row) throw new Error("السجل غير موجود.");
            e.update(row, data);
            save();
        },
        remove(entity, id) {
            sync(); need("admin");
            const e = ENTITIES[entity];
            const row = e.arr().find((r) => String(r[e.id]) === String(id));
            if (!row) throw new Error("السجل غير موجود.");
            e.remove(row);
            save();
        }
    };

    /* ---------- تهيئة ---------- */
    initSeed();
    load();
    expireSessions();

    return {
        ROLE_LABEL, MAX, SESSION_MINUTES,
        sync, reset, login, current, logout,
        subjectById, isEnrolled, enrolledStudents, mySubjects, subjectsOfProfessor, canManageSubject,
        sessionsOf, attendanceOf, attendanceStats, studentAttendanceRows,
        gradeOf, gradeTotal, gradeLetter,
        isOpen, tokenFor, msToNextSlot, openSessionOf, startSession, closeSession, markAttendance, scanAttendance, setGrade,
        crud, todayStr
    };
})();
