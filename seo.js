// 1. فحص ما إذا كانت البيئة محقونة بالفعل، وإلا يتم استدعاء dotenv يدوياً
if (!process.env.BOT_TOKEN) {
    require('dotenv').config();
}

const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// جلب البيانات من ملف .env تلقائياً
const BOT_TOKEN = process.env.BOT_TOKEN;
const BASE_SITE_URL = process.env.BASE_SITE_URL;
const ADMIN_ID = parseInt(process.env.ADMIN_ID) || 0;

if (!BOT_TOKEN || !BASE_SITE_URL) {
    console.error("❌ خطأ: لم يتم العثور على التوكن أو رابط الموقع في ملف .env!");
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const jsonPath = path.join(__dirname, 'data.json');
const publicDir = path.join(__dirname, 'public');

// كائن لحفظ الجلسات وبيانات الصفحة المؤقتة أثناء الاختيار
const userSessions = {};

if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);
if (!fs.existsSync(jsonPath)) fs.writeFileSync(jsonPath, '[]', 'utf8');

// 🎨 ميزة القوالب المتعددة: دالة توليد الـ CSS بناءً على القالب المختار
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

// دالة توليد الـ HTML المطورة بالقوالب والعداد التنازلي
function generateHTML(item) {
    const theme = getThemeStyles(item.theme || 'dark');
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

// 🧠 ميزة محسن الكلمات المفتاحية الذكي
function generateAdvancedKeywords(title) {
    const cleanWords = title.replace(/[^\w\s\u0600-\u06FF]/g, '').split(/\s+/).filter(w => w.length > 2);
    let aiTags = ['رابط مباشر', 'تحويل تلقائي', 'سيو بوست', 'أرشفة قوقل عاجلة'];
    const text = title.toLowerCase();

    if (text.includes('قناة') || text.includes('جروب') || text.includes('تليجرام') || text.includes('تيليجرام') || text.includes('تطبيق')) {
        aiTags.push('قنوات تليجرام', 'رابط تليجرام رسمي', 'تطبيقات أندرويد تليجرام', 'تحميل مباشر apk');
    }
    if (text.includes('واتس') || text.includes('جروب واتس')) {
        aiTags.push('قروبات واتساب 2026', 'روابط مجموعات واتساب', 'قروب واتس اب متفاعل');
    }
    if (text.includes('بلوجر') || text.includes('موقع') || text.includes('ربح')) {
        aiTags.push('مدونة بلوجر', 'تصدّر نتائج البحث', 'الربح من الإنترنت');
    }

    return [...new Set([...cleanWords, ...aiTags])].join(', ');
}

// 🔍 ميزة الفحص الذكي السريع للروابط (بدون الاتصال بالسيرفر لتجنب حجب تليجرام)
function validateURL(urlStr) {
    try {
        const parsedUrl = new URL(urlStr);
        return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch (e) {
        return false;
    }
}

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

function getMainKeyboard(userId) {
    return userId === ADMIN_ID 
        ? Markup.keyboard([['🔗 إضافة رابط للأرشفة'], ['⚙️ لوحة الإدارة']]).resize()
        : Markup.keyboard([['🔗 إضافة رابط للأرشفة']]).resize();
}

bot.start((ctx) => {
    userSessions[ctx.from.id] = null;
    ctx.reply('🚀 مرحباً بك في نظام الـ SEO الخارق المتكامل عالي الأتمتة!\n\nاختر الإجراء المطلوب من الأسفل:', getMainKeyboard(ctx.from.id));
});

bot.hears('🔙 العودة للقائمة الرئيسية', (ctx) => {
    userSessions[ctx.from.id] = null;
    ctx.reply('🏠 تم العودة للقائمة الرئيسية:', getMainKeyboard(ctx.from.id));
});

bot.hears('🔗 إضافة رابط للأرشفة', (ctx) => {
    userSessions[ctx.from.id] = { step: 'awaiting_data' };
    ctx.reply('📥 أرسل لي الآن سطرين كاملين:\n\nالسطر الأول: الرابط المطلوب\nالسطر الثاني: عنوان الصفحة الذكي\n\n💡 مثال:\nhttps://t.me/my_channel\nقناة السيو الرسمية لتطوير البوتات', Markup.keyboard([['🔙 العودة للقائمة الرئيسية']]).resize());
});

bot.hears('⚙️ لوحة الإدارة', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.reply('⚠️ عذراً، هذا الأمر مخصص لإدارة البوت فقط.');
    ctx.reply('⚙️ لوحة تحكم النظام الفنية والأمنية:', Markup.keyboard([
        ['📊 مراقبة الإحصائيات', '💾 جلب النسخة الاحتياطية'],
        ['🗑️ حذف صفحة محددة'],
        ['🔙 العودة للقائمة الرئيسية']
    ]).resize());
});

bot.hears('📊 مراقبة الإحصائيات', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    try {
        const currentData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        let sitemapSize = '0 KB';
        if (fs.existsSync(path.join(publicDir, 'sitemap.xml'))) {
            sitemapSize = (fs.statSync(path.join(publicDir, 'sitemap.xml')).size / 1024).toFixed(2) + ' KB';
        }
        ctx.reply(`📊 *إحصائيات النظام الحالية:* \n\n📁 إجمالي صفحات الهبوط المفتوحة: ${currentData.length}\n🗺️ حجم خريطة الموقع: ${sitemapSize}\n🌐 رابط السايت ماب العام:\n${BASE_SITE_URL}/sitemap.xml`, { parse_mode: 'Markdown' });
    } catch (e) { ctx.reply('❌ فشل قراءة الإحصائيات.'); }
});

bot.hears('💾 جلب النسخة الاحتياطية', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    try { await ctx.replyWithDocument({ source: jsonPath, filename: 'data_backup.json' }, { caption: '💾 نسخة احتياطية آمنة ومحدثة لقاعدة البيانات.' }); } catch (e) { ctx.reply('❌ حدث خطأ أثناء إرسال النسخة.'); }
});

bot.hears('🗑️ حذف صفحة محددة', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    userSessions[ctx.from.id] = { step: 'awaiting_delete_slug' };
    ctx.reply('❗ أرسل الـ الرمز الفريد (Slug) الخاص بالصفحة المراد حذفها.\nمثال: `page-1781105568008`', { parse_mode: 'Markdown', ...Markup.keyboard([['🔙 العودة للقائمة الرئيسية']]).resize() });
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
    await ctx.editMessageText('⚙️ جاري معالجة الكود وحقن الستايلات المخصصة في صفحة الـ HTML...');

    try {
        const currentData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        currentData.push({ title, slug, target_url, keywords, desc, theme: selectedTheme });
        fs.writeFileSync(jsonPath, JSON.stringify(currentData, null, 2), 'utf8');
        
        rebuildSEO(currentData);
        
        await ctx.reply('⏳ جاري حفظ وتوليد السيو ودفع التحديثات تلقائياً إلى GitHub...');

        const gitCommands = 'git add . && git commit -m "Add new SEO page" && git pull origin main --rebase -X ours && git push origin main';
        exec(gitCommands, (error) => {
            if (error) {
                console.error(`خطأ في الـ Git: ${error}`);
                return ctx.reply('❌ فشل رفع التحديثات إلى GitHub. تأكد من إعداد المستودع.');
            }
            ctx.reply(`🎉 تم إنشاء وتحديث نظام السيو بنجاح!\n\n⏱️ ميزة التحويل (5 ثوانٍ) مفعلة تلقائياً.\n\n🔗 رابط صفحتك بالشكل الجديد لايف هنا:\n${BASE_SITE_URL}/${slug}.html`, getMainKeyboard(userId));
            userSessions[userId] = null;
        });
    } catch (error) {
        console.error(error);
        ctx.reply('❌ حدث خطأ داخلي أثناء حفظ وتوليد الملفات.');
    }
});

bot.on('text', (ctx) => {
    const userId = ctx.from.id;
    const session = userSessions[userId];
    const text = ctx.message.text.trim();

    if (session && session.step === 'awaiting_data') {
        const lines = text.split('\n');
        if (lines.length < 2) {
            return ctx.reply('⚠️ الصيغة قاصرة! يرجى إرسال سطرين كاملين:\nالسطر الأول: الرابط\nالسطر الثاني: العنوان الرئيسي');
        }

        const target_url = lines[0].trim();
        const title = lines[1].trim();

        // 🔍 الفحص السريع والآمن للبنية الأساسية للرابط
        if (!validateURL(target_url)) {
            return ctx.reply('❌ خطأ: الرابط غير صالح! تأكد من أنه يبدأ بـ http:// أو https:// وأنه مكتوب بشكل صحيح.');
        }

        // 🧠 توليد السيو الذكي والكلمات الدلالية المتقدمة
        const desc = `اضغط هنا للانتقال المباشر لخدمة: ${title}. رابط آمن ومحدث مع تحويل تلقائي لجميع المشتركين والزوار مجاناً عبر نظام الأرشفة الذكي.`;
        const keywords = generateAdvancedKeywords(title);

        userSessions[userId] = {
            step: 'awaiting_theme',
            data: { target_url, title, keywords, desc }
        };

        ctx.reply('🎨 الرابط تم التحقق من بنيته بنجاح! الآن اختر المظهر والتنسيق البصري المناسب لهذه الصفحة قبل النشر:', 
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
                return ctx.reply('❌ لم يتم العثور على أي صفحة بهذا الـ Slug، تأكد من الرمز المكتوب.');
            }

            fs.writeFileSync(jsonPath, JSON.stringify(filteredData, null, 2), 'utf8');
            rebuildSEO(filteredData);

            ctx.reply('⏳ جاري إزالة الصفحة من السيرفر وتحديث الـ Sitemap على GitHub...');

            const gitCommands = 'git add . && git commit -m "Delete SEO page" && git pull origin main --rebase -X ours && git push origin main';
            exec(gitCommands, (error) => {
                if (error) return ctx.reply('❌ تم الحذف محلياً ولكن فشل تحديث مستودع GitHub.');
                ctx.reply('🗑️ تم حذف الصفحة وإزالتها من الـ Sitemap بنجاح، وتحديث سيرفر Vercel!', getMainKeyboard(userId));
                userSessions[userId] = null;
            });
        } catch (e) { ctx.reply('❌ حدث خطأ أثناء عملية الحذف.'); }
    } 
    
    else {
        ctx.reply('👋 الرجاء استخدام الأزرار المتاحة للتحكم في النظام بشكل صحيح ومحمي.', getMainKeyboard(userId));
    }
});

bot.launch().then(() => console.log('🚀 البوت الخارق يعمل الآن بثبات تام وبدون قيود فحص خارجية...'));
