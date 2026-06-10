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
const ADMIN_ID = parseInt(process.env.ADMIN_ID) || 0; // معرف الأدمن لحماية اللوحة

// التحقق من أن المتغيرات تم قراءتها بنجاح
if (!BOT_TOKEN || !BASE_SITE_URL) {
    console.error("❌ خطأ: لم يتم العثور على التوكن أو رابط الموقع في ملف .env!");
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const jsonPath = path.join(__dirname, 'data.json');
const publicDir = path.join(__dirname, 'public');

// كائن لحفظ الحالة المؤقتة للمستخدمين لمنع تداخل الأوامر
const userSessions = {};

if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);
if (!fs.existsSync(jsonPath)) fs.writeFileSync(jsonPath, '[]', 'utf8');

// دالة لتوليد كود الـ HTML مع نظام العداد التنازلي والتحويل التلقائي الذكي
function generateHTML(item) {
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
        body { font-family: 'Segoe UI', sans-serif; text-align: center; background: #0f172a; color: #f8fafc; padding: 40px 20px; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .container { background: #1e293b; max-width: 500px; width: 100%; padding: 30px; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3); }
        h1 { color: #38bdf8; font-size: 22px; margin-bottom: 15px; }
        p { color: #94a3b8; line-height: 1.6; font-size: 15px; }
        .timer-box { margin: 15px 0; font-size: 14px; color: #fbbf24; font-weight: bold; }
        .btn { display: inline-block; background: #0284c7; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 15px; width: 80%; transition: background 0.3s; }
        .btn:hover { background: #0369a1; }
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
        const targetUrl = "${item.target_url}";

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

function rebuildSEO(data) {
    let sitemapUrls = '';
    
    // تنظيف المجلد قبل إعادة البناء لضمان عدم بقاء ملفات محذوفة
    const files = fs.readdirSync(publicDir);
    files.forEach(file => {
        if (file.endsWith('.html') || file === 'sitemap.xml' || file === 'robots.txt') {
            fs.unlinkSync(path.join(publicDir, file));
        }
    });

    data.forEach(item => {
        const htmlContent = generateHTML(item);
        fs.writeFileSync(path.join(publicDir, `${item.slug}.html`), htmlContent, 'utf8');
        sitemapUrls += `  <url>\n    <loc>${BASE_SITE_URL}/${item.slug}.html</loc>\n    <priority>0.9</priority>\n  </url>\n`;
    });

    const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls}</urlset>`;
    fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemapContent, 'utf8');

    const robotsContent = `User-agent: *\nAllow: /\n\nSitemap: ${BASE_SITE_URL}/sitemap.xml\n`;
    fs.writeFileSync(path.join(publicDir, 'robots.txt'), robotsContent, 'utf8');
}

// دالة لتوليد القائمة الرئيسية بناءً على هوية المستخدم
function getMainKeyboard(userId) {
    if (userId === ADMIN_ID) {
        return Markup.keyboard([
            ['🔗 إضافة رابط للأرشفة'],
            ['⚙️ لوحة الإدارة']
        ]).resize();
    } else {
        return Markup.keyboard([
            ['🔗 إضافة رابط للأرشفة']
        ]).resize();
    }
}

// أمر تشغيل البوت والترحيب
bot.start((ctx) => {
    userSessions[ctx.from.id] = null;
    ctx.reply('🚀 أهلاً بك في نظام الـ SEO الذكي والمطور!\n\nاختر من الأزرار بالأسفل الإجراء المطلوب:', getMainKeyboard(ctx.from.id));
});

// الاستماع لزر الرجوع
bot.hears('🔙 العودة للقائمة الرئيسية', (ctx) => {
    userSessions[ctx.from.id] = null;
    ctx.reply('🏠 تم العودة للقائمة الرئيسية:', getMainKeyboard(ctx.from.id));
});

// الاستماع لزر بدء الأرشفة
bot.hears('🔗 إضافة رابط للأرشفة', (ctx) => {
    userSessions[ctx.from.id] = 'awaiting_seo_data';
    ctx.reply('📥 ممتاز! أرسل لي الآن سطرين كاملين:\n\nالسطر الأول: الرابط المطلوب\nالسطر الثاني: عنوان الصفحة\n\n💡 مثال:\nhttps://t.me/my_channel\nقناة السيو الرسمية لتطوير البوتات', Markup.keyboard([['🔙 العودة للقائمة الرئيسية']]).resize());
});

// الاستماع لزر لوحة التحكم الخاصة بالأدمن فقط
bot.hears('⚙️ لوحة الإدارة', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.reply('⚠️ عذراً، هذا الأمر مخصص لإدارة البوت فقط.');
    
    ctx.reply('⚙️ مرحباً بك في لوحة تحكم النظام الفنية. اختر أحد الخيارات الإدارية:', Markup.keyboard([
        ['📊 مراقبة الإحصائيات', '💾 جلب النسخة الاحتياطية'],
        ['🗑️ حذف صفحة محددة'],
        ['🔙 العودة للقائمة الرئيسية']
    ]).resize());
});

// تنفيذ خيارات لوحة التحكم
bot.hears('📊 مراقبة الإحصائيات', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    try {
        const currentData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        const totalPages = currentData.length;
        
        let sitemapSize = '0 KB';
        if (fs.existsSync(path.join(publicDir, 'sitemap.xml'))) {
            sitemapSize = (fs.statSync(path.join(publicDir, 'sitemap.xml')).size / 1024).toFixed(2) + ' KB';
        }

        ctx.reply(`📊 *إحصائيات النظام الحالية:* \n\n📁 إجمالي صفحات الهبوط: ${totalPages}\n🗺️ حجم خريطة الموقع (Sitemap): ${sitemapSize}\n🌐 رابط السايت ماب: ${BASE_SITE_URL}/sitemap.xml`, { parse_mode: 'Markdown' });
    } catch (e) {
        ctx.reply('❌ فشل قراءة الإحصائيات.');
    }
});

bot.hears('💾 جلب النسخة الاحتياطية', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    try {
        await ctx.replyWithDocument({ source: jsonPath, filename: 'data_backup.json' }, { caption: '💾 نسخة احتياطية آمنة لملف البيانات داتا دوت جيغون.' });
    } catch (e) {
        ctx.reply('❌ حدث خطأ أثناء إرسال النسخة الاحتياطية.');
    }
});

bot.hears('🗑️ حذف صفحة محددة', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    userSessions[ctx.from.id] = 'awaiting_delete_slug';
    ctx.reply('❗ من فضلك أرسل الـ الرمز الفريد (Slug) الخاص بالصفحة المراد حذفها.\nمثال: `page-1781105568008`', { parse_mode: 'Markdown', ...Markup.keyboard([['🔙 العودة للقائمة الرئيسية']]).resize() });
});

// معالجة النصوص الواردة بناءً على الجلسة (Session)
bot.on('text', (ctx) => {
    const userId = ctx.from.id;
    const session = userSessions[userId];
    const text = ctx.message.text.trim();

    // 1. معالجة إضافة رابط الأرشفة
    if (session === 'awaiting_seo_data') {
        const lines = text.split('\n');
        if (lines.length < 2) {
            return ctx.reply('⚠️ الصيغة قاصرة! يرجى إرسال سطرين كاملين:\nالسطر الأول: الرابط\nالسطر الثاني: العنوان الرئيسي');
        }

        const target_url = lines[0].trim();
        const title = lines[1].trim();
        const desc = `اضغط هنا للانتقال المباشر لخدمة: ${title}. رابط آمن ومحدث مع تحويل تلقائي لجميع المشتركين والزوار مجاناً.`;
        
        const cleanWords = title.replace(/[^\w\s\u0600-\u06FF]/g, '').split(/\s+/).filter(w => w.length > 2);
        const defaultKeywords = ['تليجرام', 'رابط مباشر', 'تحويل تلقائي', 'سيو بوست', 'جروب تليجرام'];
        const keywords = [...new Set([...cleanWords, ...defaultKeywords])].join(', ');
        const slug = "page-" + Date.now();

        try {
            const currentData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            currentData.push({ title, slug, target_url, keywords, desc });
            fs.writeFileSync(jsonPath, JSON.stringify(currentData, null, 2), 'utf8');
            
            rebuildSEO(currentData);
            ctx.reply('⏳ جاري حفظ وتوليد السيو ودفع التحديثات تلقائياً إلى GitHub...');

            const gitCommands = 'git add . && git commit -m "Add new SEO page" && git pull origin main --rebase -X ours && git push origin main';
            exec(gitCommands, (error) => {
                if (error) {
                    console.error(`خطأ في الـ Git: ${error}`);
                    return ctx.reply('❌ فشل رفع التحديثات إلى GitHub. تأكد من إعداد المستودع.');
                }
                ctx.reply(`🎉 تم إنشاء وتحديث نظام السيو بنجاح!\n\n🔗 رابط صفحتك الجديدة:\n${BASE_SITE_URL}/${slug}.html`, getMainKeyboard(userId));
                userSessions[userId] = null;
            });
        } catch (error) {
            console.error(error);
            ctx.reply('❌ حدث خطأ داخلي أثناء معالجة البيانات.');
        }
    } 
    
    // 2. معالجة حذف صفحة هبوط
    else if (session === 'awaiting_delete_slug' && userId === ADMIN_ID) {
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
                if (error) {
                    return ctx.reply('❌ تم الحذف محلياً ولكن فشل تحديث مستودع GitHub.');
                }
                ctx.reply('🗑️ تم حذف الصفحة وإزالتها من الـ Sitemap بنجاح، وتحديث سيرفر Vercel!', getMainKeyboard(userId));
                userSessions[userId] = null;
            });
        } catch (e) {
            ctx.reply('❌ حدث خطأ أثناء عملية الحذف.');
        }
    } 
    
    // حالة عدم اختيار أي أمر مسبقاً
    else {
        ctx.reply('👋 الرجاء استخدام الأزرار المتاحة للتحكم في النظام بشكل صحيح.', getMainKeyboard(userId));
    }
});

bot.launch().then(() => console.log('🚀 البوت الاحترافي يعمل الآن بنظام القوائم المحمية...'));
