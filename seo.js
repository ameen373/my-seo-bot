// 1. فحص ما إذا كانت البيئة محقونة بالفعل، وإلا يتم استدعاء dotenv يدوياً
if (!process.env.BOT_TOKEN) {
    require('dotenv').config();
}

const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const http = require('http'); // مدمج لإنشاء لوحة التحكم عبر الويب بدون مكتبات خارجية

// جلب البيانات من ملف .env تلقائياً
const BOT_TOKEN = process.env.BOT_TOKEN;
const BASE_SITE_URL = process.env.BASE_SITE_URL;
const ADMIN_ID = parseInt(process.env.ADMIN_ID) || 0;
const WEB_ADMIN_PASSWORD = process.env.WEB_ADMIN_PASSWORD || "admin123"; // كلمة مرور لوحة الويب

if (!BOT_TOKEN || !BASE_SITE_URL) {
    console.error("❌ خطأ: لم يتم العثور على التوكن أو رابط الموقع في ملف .env!");
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const jsonPath = path.join(__dirname, 'data.json');
const publicDir = path.join(__dirname, 'public');

const userSessions = {};
let isGitSyncing = false; 

if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);
if (!fs.existsSync(jsonPath)) fs.writeFileSync(jsonPath, '[]', 'utf8');

// 🎨 دالة الستايلات والقوالب البصرية
function getThemeStyles(theme) {
    switch (theme) {
        case 'light':
            return {
                bg: '#f8fafc', container: '#ffffff', text: '#0f172a', desc: '#475569',
                titleColor: '#0284c7', btnBg: '#0284c7', btnHover: '#0369a1', timerBox: '#d97706'
            };
        case 'telegram':
            return {
                bg: '#e7ebf0', container: '#ffffff', text: '#222222', desc: '#707579',
                titleColor: '#2481cc', btnBg: '#2481cc', btnHover: '#1c6ca8', timerBox: '#e67e22'
            };
        case 'whatsapp':
            return {
                bg: '#dcf8c6', container: '#ffffff', text: '#303030', desc: '#575757',
                titleColor: '#075e54', btnBg: '#25d366', btnHover: '#1ebd58', timerBox: '#b8860b'
            };
        case 'dark':
default:
            return {
                bg: '#0f172a', container: '#1e293b', text: '#f8fafc', desc: '#94a3b8',
                titleColor: '#38bdf8', btnBg: '#0284c7', btnHover: '#0369a1', timerBox: '#fbbf24'
            };
    }
}

// 2️⃣ توليد الـ HTML + نظام الـ Schema Markup المتقدم لتسريع أرشفة قوقل
function generateHTML(item) {
    const theme = getThemeStyles(item.theme || 'dark');
    
    // هيكل البيانات المنظمة Schema JSON-LD
    const schemaMarkup = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": item.title,
        "description": item.desc,
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "All",
        "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
        }
    };

    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${item.title}</title>
    <meta name="description" content="${item.desc}">
    <meta name="keywords" content="${item.keywords}">
    <meta name="robots" content="index, follow">
    <meta property="og:title" content="${item.title}">
    <meta property="og:description" content="${item.desc}">
    <meta property="og:url" content="${BASE_SITE_URL}/${item.slug}.html">
    <meta property="og:type" content="website">
    
    <script type="application/ld+json">
        ${JSON.stringify(schemaMarkup)}
    </script>

    <style>
        body { font-family: 'Segoe UI', sans-serif; text-align: center; background: ${theme.bg}; color: ${theme.text}; padding: 40px 20px; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .container { background: ${theme.container}; max-width: 500px; width: 100%; padding: 30px; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3); }
        h1 { color: ${theme.titleColor}; font-size: 22px; margin-bottom: 15px; }
        p { color: ${theme.desc}; line-height: 1.6; font-size: 15px; }
        .timer-box { margin: 15px 0; font-size: 14px; color: ${theme.timerBox}; font-weight: bold; }
        .btn { display: inline-block; background: ${theme.btnBg}; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 15px; width: 80%; transition: background 0.3s; }
        .btn:hover { background: ${theme.btnHover}; }
    </style>
</head>
<body>
    <div class="container">
        <h1>${item.title}</h1>
        <p>${item.desc}</p>
        
        <div class="timer-box" id="timer-container">
            سيتم تحويلك تلقائياً خلال <span id="countdown">5</span> ثوانٍ...
        </div>

        <a href="${item.target_url}" id="redirect-btn" class="btn">الانتقال إلى الرابط المطلوب فوراً</a>
    </div>

    <img src="${BASE_SITE_URL}/track?slug=${item.slug}" alt="" style="position:absolute; width:1px; height:1px; opacity:0;">

    <script>
        let seconds = 5;
        const countdownEl = document.getElementById('countdown');
        const timerContainer = document.getElementById('timer-container');
        const targetUrl = \`${item.target_url}\`;

        const interval = setInterval(() => {
            seconds--;
            countdownEl.textContent = seconds;
            if (seconds <= 0) {
                clearInterval(interval);
                timerContainer.textContent = "جاري التحويل الآن...";
                window.location.href = targetUrl;
            }
        }, 1000);
    </script>
</body>
</html>`;
}

// 1️⃣ ميزة الوصف الذكي والـ Auto-Scraper التلقائي لاستنتاج العناوين والكلمات الدلالية
function generateSmartMetadata(title, targetUrl) {
    let finalTitle = title ? title.trim() : "";
    
    // إذا لم يرسل المستخدم عنواناً، نقوم بسحب واستنتاج الكلمات من الرابط تلقائياً
    if (!finalTitle) {
        if (targetUrl.includes('t.me/')) {
            const parts = targetUrl.split('/');
            finalTitle = "رابط انضمام تليجرام - " + (parts[parts.length - 1] || "قناة رسمية");
        } else if (targetUrl.includes('chat.whatsapp.com')) {
            finalTitle = "مجموعة واتساب نشطة ومحدثة اليوم";
        } else {
            finalTitle = "رابط تحويل خارجي آمن وسريع";
        }
    }

    const cleanWords = finalTitle.replace(/[^\w\s\u0600-\u06FF]/g, '').split(/\s+/).filter(w => w.length > 2);
    let aiTags = ['رابط مباشر', 'تحويل تلقائي', 'سيو بوست', 'أرشفة قوقل عاجلة'];
    let desc = `اضغط هنا للانتقال المباشر لخدمة: ${finalTitle}. رابط آمن ومحدث مع تحويل تلقائي لجميع الزوار مجاناً.`;
    
    const text = finalTitle.toLowerCase();

    if (text.includes('قناة') || text.includes('تليجرام') || targetUrl.includes('t.me')) {
        aiTags.push('قنوات تليجرام', 'رابط تليجرام رسمي', 'انضمام تليجرام');
        desc = `الدخول المباشر إلى قناة التليجرام الرسمية [ ${finalTitle} ]. اضغط هنا للانضمام الفوري والاطلاع على المحتوى الحصري والمحدث اليوم مجاناً.`;
    } else if (text.includes('جروب') || text.includes('واتس') || targetUrl.includes('whatsapp')) {
        aiTags.push('قروبات واتساب 2026', 'روابط مجموعات واتساب', 'قروب واتس اب متفاعل');
        desc = `رابط الانضمام المباشر لجروب الواتساب النشط: [ ${finalTitle} ]. تواصل الآن مع أعضاء المجموعة وتبادل الخبرات والخدمات مجاناً وبأمان.`;
    } else if (text.includes('تطبيق') || text.includes('تحميل') || text.includes('apk')) {
        aiTags.push('تطبيقات أندرويد', 'تحميل مباشر apk', 'أحدث إصدار تطبيق');
        desc = `رابط تحميل تطبيق [ ${finalTitle} ] بأحدث إصدار ومباشر APK. صفحة فحص أمان التطبيق والتحويل الفوري والآمن بدون إعلانات مزعجة.`;
    }

    const keywords = [...new Set([...cleanWords, ...aiTags])].join(', ');
    return { title: finalTitle, keywords, desc };
}

// دالة إعادة بناء السايت ماب والملفات محلياً
function rebuildSEO(data) {
    const files = fs.readdirSync(publicDir);
    files.forEach(file => {
        if (file.endsWith('.html') || file === 'sitemap.xml' || file === 'robots.txt') {
            fs.unlinkSync(path.join(publicDir, file));
        }
    });

    data.forEach(item => {
        const htmlContent = generateHTML(item);
        fs.writeFileSync(path.join(publicDir, `${item.slug}.html`), htmlContent, 'utf8');
    });

    const sitemapUrls = data.map(item => `  <url>\n    <loc>${BASE_SITE_URL}/${item.slug}.html</loc>\n    <priority>0.9</priority>\n  </url>\n`).join('');
    const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls}</urlset>`;
    fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemapContent, 'utf8');

    const robotsContent = `User-agent: *\nAllow: /\n\nSitemap: ${BASE_SITE_URL}/sitemap.xml\n`;
    fs.writeFileSync(path.join(publicDir, 'robots.txt'), robotsContent, 'utf8');
}

// دالة الرفع الفوري والمباشر لـ GitHub
function pushToGitHub(callback) {
    if (isGitSyncing) return callback ? callback(false) : null;
    isGitSyncing = true;

    const gitCommands = 'git add . && git commit -m "Advanced Cloud Update" && git pull origin main --rebase -X ours && git push origin main';
    exec(gitCommands, (error) => {
        isGitSyncing = false;
        if (error) {
            console.error(`❌ خطأ في الرفع: ${error}`);
            if (callback) callback(false);
        } else {
            if (callback) callback(true);
        }
    });
}

// سكريبت المزامنة الدورية الصامت
function startAutoGitScheduler() {
    setInterval(() => {
        console.log('🔄 سكريبت الجدولة: مزامنة إحصائيات الـ Views الدورية مع مستودع GitHub...');
        pushToGitHub();
    }, 15 * 60 * 1000); // كل 15 دقيقة
}

// 3️⃣ لوحة إدارة متكاملة ومصغرة عبر الويب (Web Dashboard Interface) مدمجة بالكامل وبأعلى أمان
function createWebDashboard() {
    const server = http.createServer((req, res) => {
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        
        // 1. مسار تتبع الـ Views للزوار (Analytics Pixel Link)
        if (urlObj.pathname === '/track') {
            const slug = urlObj.searchParams.get('slug');
            try {
                const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                const page = data.find(p => p.slug === slug);
                if (page) {
                    page.views = (page.views || 0) + 1;
                    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
                }
            } catch (e) { console.error(e); }
            const buf = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
            res.writeHead(200, { 'Content-Type': 'image/gif', 'Content-Length': buf.length });
            return res.end(buf);
        }

        // 2. واحة لوحة التحكم البرمجية المرئية عبر المتصفح
        if (urlObj.pathname === '/admin-panel') {
            const pass = urlObj.searchParams.get('password');
            if (pass !== WEB_ADMIN_PASSWORD) {
                res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
                return res.end("<h1>🔒 عذراً، كلمة المرور للوحة الويب غير صحيحة أو منتهية!</h1>");
            }

            try {
                const currentData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                // ترتيب الصفحات حسب الأعلى زيارة
                const sortedData = [...currentData].sort((a,b) => (b.views || 0) - (a.views || 0));

                let rows = sortedData.map((item, idx) => `
                    <tr>
                        <td>${idx + 1}</td>
                        <td><b>${item.title}</b></td>
                        <td><a href="${BASE_SITE_URL}/${item.slug}.html" target="_blank">${item.slug}</a></td>
                        <td><span class="badge">${item.views || 0} زيارة</span></td>
                        <td><span class="theme-tag ${item.theme}">${item.theme || 'dark'}</span></td>
                    </tr>
                `).join('');

                let htmlDashboard = `<!DOCTYPE html>
                <html lang="ar" dir="rtl">
                <head>
                    <meta charset="UTF-8">
                    <title>لوحة تحكم SEO Engine Pro</title>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 40px; }
                        .container { max-width: 1000px; margin: auto; background: #1e293b; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.5); }
                        h1 { color: #38bdf8; border-bottom: 2px solid #334155; padding-bottom: 10px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { padding: 12px; text-align: right; border-bottom: 1px solid #334155; }
                        th { background: #334155; color: #38bdf8; }
                        a { color: #fbbf24; text-decoration: none; }
                        .badge { background: #059669; color: white; padding: 4px 8px; border-radius: 6px; font-size: 13px; }
                        .theme-tag { padding: 3px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; }
                        .telegram { background: #2481cc; color: white; }
                        .whatsapp { background: #25d366; color: black; }
                        .dark { background: #475569; color: white; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>📊 لوحة تحكم وإحصائيات النظام المرئية</h1>
                        <p>إجمالي الصفحات المفتوحة حالياً لايف: <b>${currentData.length} صفحة هبوط</b></p>
                        <table>
                            <thead>
                                Redirection Pages Top Analytics
                                <tr>
                                    <th>#</th>
                                    <th>العنوان الذكي للرابط</th>
                                    <th>الرابط الفريد (Slug)</th>
                                    <th>إحصائيات المشاهدة</th>
                                    <th>الثيم المختار</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </body>
                </html>`;

                res.writeHead(200, { 'Content-Type': 'text/html' });
                return res.end(htmlDashboard);
            } catch (err) {
                res.writeHead(500);
                return res.end("Internal Server Error");
            }
        }

        res.writeHead(404);
        res.end();
    });

    server.listen(process.env.PORT || 3000, () => {
        console.log('🌐 خادم الويب ولوحة الإحصائيات تعمل بنجاح الآن...');
    });
}

function getMainKeyboard(userId) {
    return userId === ADMIN_ID 
        ? Markup.keyboard([['🔗 إضافة رابط للأرشفة'], ['⚙️ لوحة الإدارة']]).resize()
        : Markup.keyboard([['🔗 إضافة رابط للأرشفة']]).resize();
}

bot.start((ctx) => {
    userSessions[ctx.from.id] = null;
    ctx.reply('🚀 مرحباً بك في نظام الـ SEO المتكامل وعالي الأتمتة والذكاء الشامل!', getMainKeyboard(ctx.from.id));
});

bot.hears('🔙 العودة للقائمة الرئيسية', (ctx) => {
    userSessions[ctx.from.id] = null;
    ctx.reply('🏠 تم العودة للقائمة الرئيسية:', getMainKeyboard(ctx.from.id));
});

bot.hears('🔗 إضافة رابط للأرشفة', (ctx) => {
    userSessions[ctx.from.id] = { step: 'awaiting_data' };
    ctx.reply('📥 أرسل لي الآن سطرين كاملين:\n\nالسطر الأول: الرابط المطلوب\nالسطر الثاني: عنوان الصفحة الذكي (أو أرسل الرابط بمفرده وسيتولى السكريبت استنتاج العنوان تلقائياً!)', Markup.keyboard([['🔙 العودة للقائمة الرئيسية']]).resize());
});

bot.hears('⚙️ لوحة الإدارة', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.reply('⚠️ عذراً، هذا الأمر مخصص لإدارة البوت فقط.');
    ctx.reply('⚙️ لوحة تحكم النظام الفنية والأمنية المتقدمة:', Markup.keyboard([
        ['📊 مراقبة الإحصائيات والأعلى زيارة', '🌐 رابط لوحة الويب'],
        ['💾 جلب النسخة الاحتياطية', '🗑️ حذف صفحة محددة'],
        ['🔙 العودة للقائمة الرئيسية']
    ]).resize());
});

bot.hears('🌐 رابط لوحة الويب', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply(`📊 *رابط لوحة تحكم الويب المرئية والآمنة الخاصة بك:* \n\n🔗 تصفح إحصائياتك من المتصفح مباشرة هنا:\n${BASE_SITE_URL}/admin-panel?password=${WEB_ADMIN_PASSWORD}`, { parse_mode: 'Markdown' });
});

bot.hears('📊 مراقبة الإحصائيات والأعلى زيارة', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    try {
        const currentData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        let sitemapSize = '0 KB';
        if (fs.existsSync(path.join(publicDir, 'sitemap.xml'))) {
            sitemapSize = (fs.statSync(path.join(publicDir, 'sitemap.xml')).size / 1024).toFixed(2) + ' KB';
        }

        const topPages = [...currentData].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);
        let topPagesText = "🔝 *أعلى 5 صفحات زيارة وترافيك:*\n";
        topPages.forEach((p, index) => {
            topPagesText += `${index + 1}. \`${p.slug}\` -> 👁️ ${p.views || 0} زيارة (${p.title.slice(0, 20)}...)\n`;
        });

        ctx.reply(`📊 *إحصائيات النظام الفنية الحالية:* \n\n📁 إجمالي صفحات الهبوط المفتوحة: ${currentData.length}\n🗺️ حجم خريطة الموقع: ${sitemapSize}\n🌐 رابط السايت ماب العام:\n${BASE_SITE_URL}/sitemap.xml\n\n${topPagesText}`, { parse_mode: 'Markdown' });
    } catch (e) { ctx.reply('❌ فشل قراءة الإحصائيات.'); }
});

bot.hears('💾 جلب النسخة الاحتياطية', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    try { await ctx.replyWithDocument({ source: jsonPath, filename: 'data_backup.json' }, { caption: '💾 نسخة احتياطية آمنة لقاعدة البيانات.' }); } catch (e) { ctx.reply('❌ حدث خطأ أثناء إرسال النسخة.'); }
});

bot.hears('🗑️ حذف صفحة محددة', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    userSessions[ctx.from.id] = { step: 'awaiting_delete_slug' };
    ctx.reply('❗ أرسل الـ الرمز الفريد (Slug) الخاص بالصفحة المراد حذفها.', { parse_mode: 'Markdown', ...Markup.keyboard([['🔙 العودة للقائمة الرئيسية']]).resize() });
});

bot.on('callback_query', async (ctx) => {
    const userId = ctx.from.id;
    const session = userSessions[userId];
    
    if (!session || session.step !== 'awaiting_theme') {
        return ctx.answerCbQuery('⚠️ انتهت صلاحية هذه الجلسة، ابدأ من جديد.');
    }

    const selectedTheme = ctx.callbackQuery.data;
    const { target_url, title, keywords, desc } = session.data;
    const slug = "page-" + Date.now();

    await ctx.answerCbQuery(`🎨 تم اختيار القالب بنجاح!`);
    await ctx.editMessageText('⚙️ جاري دمج الـ Schema Markup وحفظ ملف الـ HTML الفوري...');

    try {
        const currentData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        currentData.push({ title, slug, target_url, keywords, desc, theme: selectedTheme, views: 0 });
        fs.writeFileSync(jsonPath, JSON.stringify(currentData, null, 2), 'utf8');
        
        rebuildSEO(currentData);
        
        await ctx.reply('⏳ جاري تحديث خريطة السايت ماب ودفع التغيرات الفورية لايف لـ GitHub...');

        pushToGitHub((success) => {
            if (success) {
                ctx.reply(`🎉 تم إنشاء وتحديث نظام السيو الخارق بنجاح!\n\n🚀 [ميزة الـ Schema مفعلة]: تم حقن كود البيانات المنظمة لمضاعفة سرعة زحف قوقل للرابط الجديد.\n\n🔗 رابط صفحتك متاح لايف الآن:\n${BASE_SITE_URL}/${slug}.html`, getMainKeyboard(userId));
            } else {
                ctx.reply(`⚠️ تم الحفظ محلياً بنجاح. الرابط سيعمل تلقائياً خلال دقائق هنا:\n${BASE_SITE_URL}/${slug}.html`, getMainKeyboard(userId));
            }
            userSessions[userId] = null;
        });
    } catch (error) {
        ctx.reply('❌ حدث خطأ داخلي أثناء توليد الملفات.');
    }
});

bot.on('text', (ctx) => {
    const userId = ctx.from.id;
    const session = userSessions[userId];
    const text = ctx.message.text.trim();

    if (session && session.step === 'awaiting_data') {
        const lines = text.split('\n');
        const target_url = lines[0].trim();
        const title = lines.length >= 2 ? lines[1].trim() : ""; // العنوان اختياري بفضل ميزة الـ Auto-Scraper

        if (!target_url.startsWith('http://') && !target_url.startsWith('https://')) {
            return ctx.reply('❌ خطأ: الرابط غير صالح! تأكد من أنه يبدأ بـ http:// أو https://');
        }

        // 🔥 تشغيل ميزة الـ Auto-Scraper والوصف الديناميكي المتطور تلقائياً
        const metadata = generateSmartMetadata(title, target_url);

        userSessions[userId] = {
            step: 'awaiting_theme',
            data: { target_url, title: metadata.title, keywords: metadata.keywords, desc: metadata.desc }
        };

        ctx.reply(`🎯 تم استنتاج وتوليد العناوين والكلمات المفتاحية بقوة الـ سيو!\n\n📝 العنوان المستخدم: ${metadata.title}\n\n🎨 الآن اختر القالب البصري المناسب لصفحتك:`, 
            Markup.inlineKeyboard([
                [Markup.button.callback('🌌 مظهر مظلم احترافي', 'dark'), Markup.button.callback('☀️ مظهر مضيء كلاسيكي', 'light')],
                [Markup.button.callback('🔵 ثيم تليجرام الأزرق', 'telegram'), Markup.button.callback('🟢 ثيم واتساب الأخضر', 'whatsapp')]
            ])
        );
    } 
    
    else if (session && session.step === 'awaiting_delete_slug' && userId === ADMIN_ID) {
        try {
            const currentData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            const filteredData = currentData.filter(item => item.slug !== text);

            if (currentData.length === filteredData.length) {
                return ctx.reply('❌ لم يتم العثور على أي صفحة بهذا الـ Slug.');
            }

            fs.writeFileSync(jsonPath, JSON.stringify(filteredData, null, 2), 'utf8');
            rebuildSEO(filteredData);

            ctx.reply('🗑️ جاري مسح الصفحة كلياً من السيرفر والمزامنة الفورية...');
            pushToGitHub(() => {
                ctx.reply('✅ تم حذف الصفحة وتحديث ملف الـ Sitemap بنجاح تآم!', getMainKeyboard(userId));
                userSessions[userId] = null;
            });
        } catch (e) { ctx.reply('❌ حدث خطأ أثناء عملية الحذف.'); }
    } 
    
    else {
        ctx.reply('👋 الرجاء استخدام الأزرار المتاحة للتحكم في النظام.', getMainKeyboard(userId));
    }
});

// تشغيل البوت + خادم لوحة تحكم الويب والجدولة معاً بانسجام
bot.launch().then(() => {
    console.log('🚀 البوت العملاق يعمل الآن ومحمي بكافة المميزات الحصرية والحديثة...');
    startAutoGitScheduler();
    createWebDashboard();
});
