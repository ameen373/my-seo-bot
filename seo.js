// 1. فحص ما إذا كانت البيئة محقونة بالفعل، وإلا يتم استدعاء dotenv يدوياً
if (!process.env.BOT_TOKEN) {
    require('dotenv').config();
}

const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// جلب البيانات من ملف .env تلقائياً
const BOT_TOKEN = process.env.BOT_TOKEN;
const BASE_SITE_URL = process.env.BASE_SITE_URL;

// التحقق من أن المتغيرات تم قراءتها بنجاح
if (!BOT_TOKEN || !BASE_SITE_URL) {
    console.error("❌ خطأ: لم يتم العثور على التوكن أو رابط الموقع في ملف .env!");
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const jsonPath = path.join(__dirname, 'data.json');
const publicDir = path.join(__dirname, 'public');

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
    data.forEach(item => {
        const htmlContent = generateHTML(item);
        fs.writeFileSync(path.join(publicDir, `${item.slug}.html`), htmlContent, 'utf8');
        sitemapUrls += `  <url>\n    <loc>${BASE_SITE_URL}/${item.slug}.html</loc>\n    <priority>0.9</priority>\n  </url>\n`;
    });

    // 1. بناء ملف سيت ماب نظيف ومطابق للمعايير
    const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls}</urlset>`;
    fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemapContent, 'utf8');
    console.log("✅ تم تحديث ملف sitemap.xml");

    // 2. بناء ملف robots.txt منظم بأسطر فارغة لمنع أخطاء جوجل
    const robotsContent = `User-agent: *\nAllow: /\n\nSitemap: ${BASE_SITE_URL}/sitemap.xml\n`;
    fs.writeFileSync(path.join(publicDir, 'robots.txt'), robotsContent, 'utf8');
    console.log("✅ تم تحديث ملف robots.txt وتصحيح الصيغة");
}

// تعديل رسالة الترحيب لتتناسب مع التسهيل الجديد
bot.start((ctx) => ctx.reply('🚀 أهلاً بك في نظام الـ SEO الذكي والمطور!\n\nكل ما عليك إرساله الآن هو سطرين فقط:\n1. الرابط المطلوب\n2. عنوان الصفحة\n\nوسيتكفل البوت بإنشاء الكلمات الدلالية والوصف والتحويل تلقائياً!'));

bot.on('text', (ctx) => {
    const lines = ctx.message.text.split('\n');
    if (lines.length < 2) {
        return ctx.reply('⚠️ الصيغة قاصرة! يرجى إرسال سطرين كاملين:\nالسطر الأول: الرابط\nالسطر الثاني: العنوان الرئيسي');
    }

    const target_url = lines[0].trim();
    const title = lines[1].trim();
    
    // 🧠 ميزة التوليد التلقائي للـ Meta البيانات بطريقة ذكية متوافقة مع السيو
    const desc = `اضغط هنا للانتقال المباشر لخدمة: ${title}. رابط آمن ومحدث مع تحويل تلقائي لجميع المشتركين والزوار مجاناً.`;
    
    // استخراج وتوليد الكلمات المفتاحية تلقائياً من العنوان
    const cleanWords = title.replace(/[^\w\s\u0600-\u06FF]/g, '').split(/\s+/).filter(w => w.length > 2);
    const defaultKeywords = ['تليجرام', 'رابط مباشر', 'تحويل تلقائي', 'سيو بوست', 'جروب تليجرام'];
    const keywords = [...new Set([...cleanWords, ...defaultKeywords])].join(', ');

    const slug = "page-" + Date.now();

    try {
        const currentData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        const newItem = { title, slug, target_url, keywords, desc };
        currentData.push(newItem);
        fs.writeFileSync(jsonPath, JSON.stringify(currentData, null, 2), 'utf8');
        
        // إعادة بناء الصفحات، والـ Sitemap، والـ Robots محلياً
        rebuildSEO(currentData);
        
        ctx.reply('⏳ جاري حفظ وتوليد السيو ودفع التحديثات تلقائياً إلى GitHub...');

        // 🚀 الترتيب الذكي: الحفظ أولاً، ثم السحب والدمج الآمن، ثم الرفع النهائي
        const gitCommands = 'git add . && git commit -m "Add new SEO page with auto redirect" && git pull origin main --rebase -X ours && git push origin main';

        exec(gitCommands, (error, stdout, stderr) => {
            if (error) {
                console.error(`خطأ في الـ Git: ${error}`);
                return ctx.reply('❌ فشل رفع التحديثات إلى GitHub. تأكد من إعداد Git وحسابك داخل المجلد.');
            }
            ctx.reply(`🎉 تم إنشاء وتحديث نظام السيو بنجاح!\n\n⏱️ ميزة التحويل التلقائي (5 ثوانٍ) مفعلة الآن.\n\n🔗 رابط صفحتك الجديدة جاهز ومؤرشف هنا:\n${BASE_SITE_URL}/${slug}.html`);
        });

    } catch (error) {
        console.error(error);
        ctx.reply('❌ حدث خطأ داخلي أثناء معالجة البيانات.');
    }
});

bot.launch().then(() => console.log('🚀 البوت الذكي والمطور يعمل الآن بكفاءة عالية...'));
