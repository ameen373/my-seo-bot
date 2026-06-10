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
        .btn { display: inline-block; background: #0284c7; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 25px; width: 80%; }
    </style>
</head>
<body>
    <div class="container">
        <h1>${item.title}</h1>
        <p>${item.desc}</p>
        <a href="${item.target_url}" class="btn">الانتقال إلى الرابط المطلوب</a>
    </div>
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
    const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls}</urlset>`;
    fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemapContent, 'utf8');
}

bot.start((ctx) => ctx.reply('🚀 أرسل البيانات هكذا:\n\nالرابط\nالعنوان\nالكلمات المفتاحية\nالوصف'));

bot.on('text', (ctx) => {
    const lines = ctx.message.text.split('\n');
    if (lines.length < 4) {
        return ctx.reply('⚠️ الصيغة قاصرة! يرجى إرسال 4 أسطر كاملة.');
    }

    const target_url = lines[0].trim();
    const title = lines[1].trim();
    const keywords = lines[2].trim();
    const desc = lines[3].trim();
    const slug = "page-" + Date.now();

    try {
        const currentData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        const newItem = { title, slug, target_url, keywords, desc };
        currentData.push(newItem);
        fs.writeFileSync(jsonPath, JSON.stringify(currentData, null, 2), 'utf8');
        
        rebuildSEO(currentData);
        ctx.reply('⏳ جاري حفظ الصفحة الجديدة ودفعها إلى GitHub لتحديث Vercel...');

        // الكود يجعل البوت يسحب التحديثات أولاً ثم يرفع لتفادي أي رفض مستقبلي
const gitCommands = 'git pull origin main --rebase && git add . && git commit -m "Add new SEO page" && git push origin main';

        exec(gitCommands, (error, stdout, stderr) => {
            if (error) {
                console.error(`خطأ في الـ Git: ${error}`);
                return ctx.reply('❌ فشل رفع التحديثات إلى GitHub. تأكد من إعداد Git وحسابك داخل المجلد.');
            }
            ctx.reply(`🎉 تم دفع التحديثات إلى GitHub بنجاح!\n\n⏳ سيقوم Vercel بتحديث الموقع خلال ثوانٍ معدودة، وتصبح صفحتك لايف هنا:\n${BASE_SITE_URL}/${slug}.html`);
        });

    } catch (error) {
        console.error(error);
        ctx.reply('❌ حدث خطأ داخلي.');
    }
});

bot.launch().then(() => console.log('🚀 البوت الذكي يعمل ويقرأ البيانات من الـ .env الآمن...'));

    
