// 1. فحص ما إذا كانت البيئة محقونة بالفعل، وإلا يتم استدعاء dotenv يدوياً
if (!process.env.BOT_TOKEN) {
    require('dotenv').config();
}

const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const https = require('https');

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

const userSessions = {};
let isGitSyncing = false; 

if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);
if (!fs.existsSync(jsonPath)) fs.writeFileSync(jsonPath, '[]', 'utf8');

// 🎨 دالة الستايلات والأيقونات المخصصة لكل ثيم
function getThemeStyles(theme) {
    switch (theme) {
        case 'light':
            return {
                bg: '#f8fafc', container: '#ffffff', text: '#0f172a', desc: '#475569',
                titleColor: '#0284c7', btnBg: '#0284c7', btnHover: '#0369a1', timerBox: '#d97706',
                icon: '🔗', cardBg: '#f1f5f9', reviewText: '#334155'
            };
        case 'telegram':
            return {
                bg: '#e7ebf0', container: '#ffffff', text: '#222222', desc: '#707579',
                titleColor: '#2481cc', btnBg: '#2481cc', btnHover: '#1c6ca8', timerBox: '#e67e22',
                icon: '🔹', cardBg: '#f4f6f9', reviewText: '#4a4a4a'
            };
        case 'whatsapp':
            return {
                bg: '#dcf8c6', container: '#ffffff', text: '#303030', desc: '#575757',
                titleColor: '#075e54', btnBg: '#25d366', btnHover: '#1ebd58', timerBox: '#b8860b',
                icon: '🟢', cardBg: '#f0fdf4', reviewText: '#3f3f46'
            };
        case 'dark':
        default:
            return {
                bg: '#0f172a', container: '#1e293b', text: '#f8fafc', desc: '#94a3b8',
                titleColor: '#38bdf8', btnBg: '#0284c7', btnHover: '#0369a1', timerBox: '#fbbf24',
                icon: '🌌', cardBg: '#334155', reviewText: '#cbd5e1'
            };
    }
}

// دالة توليد تعليقات ديناميكية بناءً على نوع محتوى الصفحة (Social Proof System)
function getDynamicReviews(title) {
    const text = title.toLowerCase();
    if (text.includes('قناة') || text.includes('تليجرام')) {
        return [
            { user: "أحمد المالي", comment: "محتوى القناة أسطوري وأنصح بالانضمام فوراً!", stars: "⭐⭐⭐⭐⭐" },
            { user: "خالد العالمي", comment: "التحويل سريع والقناة متفاعلة جداً شكراً لكم.", stars: "⭐⭐⭐⭐⭐" }
        ];
    } else if (text.includes('جروب') || text.includes('واتس')) {
        return [
            { user: "أبو فهد", comment: "مجموعة ممتازة والأعضاء متفاعلين على مدار الساعة.", stars: "⭐⭐⭐⭐⭐" },
            { user: "سارة أحمد", comment: "رابط الانضمام شغال ومباشر، بالتوفيق.", stars: "⭐⭐⭐⭐⭐" }
        ];
    } else {
        return [
            { user: "محمد البرمي", comment: "رابط آمن وسريع جداً، تم التحويل بنجاح.", stars: "⭐⭐⭐⭐⭐" },
            { user: "سامي الفني", comment: "خدمة ممتازة وموثوقة كالعادة.", stars: "⭐⭐⭐⭐⭐" }
        ];
    }
}

// 🌐 دالة فحص استقرار الروابط (يدعم الروابط المتعددة المدمجة لـ A/B Testing)
function validateUrls(urlsString) {
    return new Promise(async (resolve) => {
        const urls = urlsString.split(',').map(u => u.trim());
        for (let url of urls) {
            if (!url.startsWith('http://') && !url.startsWith('https://')) return resolve(false);
            const status = await new Promise((res) => {
                try {
                    https.get(url, { timeout: 4000 }, (r) => res(r.statusCode >= 200 && r.statusCode < 400)).on('error', () => res(false));
                } catch (e) { res(false); }
            });
            if (!status) return resolve(false);
        }
        resolve(true);
    });
}

// 2️⃣ توليد الـ HTML المتقدم والشامل مع فلاتر الـ A/B Testing وقسم التقييمات المرئي
function generateHTML(item) {
    const theme = getThemeStyles(item.theme || 'dark');
    const reviews = getDynamicReviews(item.title);
    
    const schemaMarkup = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": item.title,
        "description": item.desc,
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "All",
        "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
    };

    // تحويل مصفوفة التعليقات إلى كود HTML منسق بصرياً
    const reviewsHTML = reviews.map(r => `
        <div class="review-card">
            <div class="review-user">👤 ${r.user} <span style="font-size:12px; float:left;">${r.stars}</span></div>
            <div class="review-comment">${r.comment}</div>
        </div>
    `).join('');

    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${theme.icon} ${item.title}</title>
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
        body { font-family: 'Segoe UI', sans-serif; background: ${theme.bg}; color: ${theme.text}; padding: 20px 10px; margin:0; display: flex; flex-direction: column; align-items: center; min-height: 100vh; justify-content: center; }
        .container { background: ${theme.container}; max-width: 480px; width: 100%; padding: 25px; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3); box-sizing: border-box; }
        h1 { color: ${theme.titleColor}; font-size: 20px; margin-bottom: 12px; }
        p { color: ${theme.desc}; line-height: 1.6; font-size: 14px; margin-bottom: 15px; }
        .timer-box { margin: 15px 0; font-size: 14px; color: ${theme.timerBox}; font-weight: bold; }
        .btn { display: inline-block; background: ${theme.btnBg}; color: white; padding: 12px 20px; text-decoration: none; border-radius: 8px; font-weight: bold; width: 90%; transition: background 0.3s; box-sizing: border-box; }
        .btn:hover { background: ${theme.btnHover}; }
        
        /* 🌟 ستايلات واجهة التعليقات والمراجعات المدمجة */
        .reviews-section { margin-top: 25px; border-top: 1px solid ${theme.desc}44; padding-top: 15px; text-align: right; }
        .reviews-title { font-size: 14px; font-weight: bold; color: ${theme.titleColor}; margin-bottom: 10px; display: flex; align-items: center; gap: 5px; }
        .review-card { background: ${theme.cardBg}; padding: 10px 12px; border-radius: 8px; margin-bottom: 10px; }
        .review-user { font-size: 13px; font-weight: bold; color: ${theme.titleColor}; margin-bottom: 4px; }
        .review-comment { font-size: 12px; color: ${theme.reviewText}; line-height: 1.4; }
    </style>
</head>
<body>
    <div class="container">
        <h1>${item.title}</h1>
        <p>${item.desc}</p>
        
        <div class="timer-box" id="timer-container">
            سيتم تحويلك تلقائياً خلال <span id="countdown">5</span> ثوانٍ...
        </div>

        <a href="#" id="redirect-btn" class="btn">الانتقال إلى الرابط المطلوب فوراً</a>
        
        <div class="reviews-section">
            <div class="reviews-title">💬 آراء وتقييمات الأعضاء والزوار (المصداقية العامة)</div>
            ${reviewsHTML}
        </div>
    </div>

    <script>
        let seconds = 5;
        const countdownEl = document.getElementById('countdown');
        const timerContainer = document.getElementById('timer-container');
        const redirectBtn = document.getElementById('redirect-btn');

        // 🔥 1️⃣ لوحة الفرز والتحويل الذكي لـ A/B Split Testing بالتناوب العشوائي المتوازن
        const targetUrlsString = \`${item.target_url}\`;
        const urlsArray = targetUrlsString.split(',').map(u => u.trim());
        const selectedUrl = urlsArray[Math.floor(Math.random() * urlsArray.length)];
        
        redirectBtn.href = selectedUrl;

        const interval = setInterval(() => {
            seconds--;
            countdownEl.textContent = seconds;
            if (seconds <= 0) {
                clearInterval(interval);
                timerContainer.textContent = "جاري التحويل الآمن الآن...";
                window.location.href = selectedUrl;
            }
        }, 1000);
    </script>
</body>
</html>`;
}

// 1️⃣ ميزة الوصف الذكي والـ Auto-Scraper التلقائي لاستنتاج الكلمات المفتاحية
function generateSmartMetadata(title, targetUrl) {
    let finalTitle = title ? title.trim() : "";
    const primaryUrl = targetUrl.split(',')[0].trim();
    
    if (!finalTitle) {
        if (primaryUrl.includes('t.me/')) {
            const parts = primaryUrl.split('/');
            finalTitle = "رابط انضمام تليجرام - " + (parts[parts.length - 1] || "قناة رسمية");
        } else if (primaryUrl.includes('chat.whatsapp.com')) {
            finalTitle = "مجموعة واتساب نشطة ومحدثة اليوم";
        } else {
            finalTitle = "رابط تحويل خارجي آمن وسريع";
        }
    }

    const cleanWords = finalTitle.replace(/[^\w\s\u0600-\u06FF]/g, '').split(/\s+/).filter(w => w.length > 2);
    let aiTags = ['رابط مباشر', 'تحويل تلقائي', 'سيو بوست', 'أرشفة قوقل عاجلة'];
    let desc = `اضغط هنا للانتقال المباشر لخدمة: ${finalTitle}. رابط آمن ومحدث مع تحويل تلقائي لجميع الزوار مجاناً.`;
    
    const text = finalTitle.toLowerCase();

    if (text.includes('قناة') || text.includes('تليجرام') || primaryUrl.includes('t.me')) {
        aiTags.push('قنوات تليجرام', 'رابط تليجرام رسمي', 'انضمام تليجرام');
        desc = `الدخول المباشر إلى قناة التليجرام الرسمية [ ${finalTitle} ]. اضغط هنا للانضمام الفوري والاطلاع على المحتوى الحصري والمحدث اليوم مجاناً.`;
    } else if (text.includes('جروب') || text.includes('واتس') || primaryUrl.includes('whatsapp')) {
        aiTags.push('قروبات واتساب 2026', 'روابط مجموعات واتساب', 'قروب واتس اب متفاعل');
        desc = `رابط الانضمام المباشر لجروب الواتساب النشط: [ ${finalTitle} ]. تواصل الآن مع أعضاء المجموعة وتبادل الخبرات والخدمات مجاناً وبأمان.`;
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

// دالة الرفع لـ GitHub
function pushToGitHub(callback) {
    if (isGitSyncing) return callback ? callback(false) : null;
    isGitSyncing = true;

    const gitCommands = 'git add . && git commit -m "Vercel Ultimate System Update" && git push origin main';
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

function getMainKeyboard(userId) {
    return userId === ADMIN_ID 
        ? Markup.keyboard([['🔗 إضافة رابط للأرشفة'], ['⚙️ لوحة الإدارة']]).resize()
        : Markup.keyboard([['🔗 إضافة رابط للأرشفة']]).resize();
}

bot.start((ctx) => {
    userSessions[ctx.from.id] = null;
    ctx.reply('🚀 مرحباً بك في أقوى نظام سيو ذكي، متكامل ومحسّن كلياً لـ Vercel والتصدر الفيروسي!', getMainKeyboard(ctx.from.id));
});

bot.hears('🔙 العودة للقائمة الرئيسية', (ctx) => {
    userSessions[ctx.from.id] = null;
    ctx.reply('🏠 تم العودة للقائمة الرئيسية:', getMainKeyboard(ctx.from.id));
});

bot.hears('🔗 إضافة رابط للأرشفة', (ctx) => {
    userSessions[ctx.from.id] = { step: 'awaiting_data' };
    ctx.reply('📥 أرسل بيانات الرابط الآن بالتنسيق التالي:\n\nالسطر الأول: الرابط (يمكنك وضع روابط متعددة لـ A/B Testing مفصولة بفاصلة ,)\nالسطر الثاني: عنوان الصفحة الذكي (أو اترك السطر فارغاً للاستنتاج التلقائي)');
});

bot.hears('⚙️ لوحة الإدارة', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.reply('⚠️ عذراً، هذا الأمر مخصص لإدارة البوت فقط.');
    ctx.reply('⚙️ لوحة تحكم النظام الفنية والأمنية المتقدمة:', Markup.keyboard([
        ['📊 مراقبة الإحصائيات والأعلى زيارة'],
        ['💾 جلب النسخة الاحتياطية', '🗑️ حذف صفحة محددة'],
        ['🔙 العودة للقائمة الرئيسية']
    ]).resize());
});

bot.hears('📊 مراقبة الإحصائيات والأعلى زيارة', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    try {
        const currentData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        let sitemapSize = '0 KB';
        if (fs.existsSync(path.join(publicDir, 'sitemap.xml'))) {
            sitemapSize = (fs.statSync(path.join(publicDir, 'sitemap.xml')).size / 1024).toFixed(2) + ' KB';
        }

        const topPages = [...currentData].slice(0, 5);
        let topPagesText = "🔝 *أحدث الصفحات النشطة على الموقع:*\n";
        topPages.forEach((p, index) => {
            topPagesText += `${index + 1}. \`${p.slug}\` -> [رابط المعاينة](${BASE_SITE_URL}/${p.slug}.html)\n`;
        });

        ctx.reply(`📊 *إحصائيات النظام الفنية الحالية:* \n\n📁 إجمالي صفحات الهبوط المفتوحة: ${currentData.length}\n🗺️ حجم خريطة الموقع: ${sitemapSize}\n🌐 رابط السايت ماب العام:\n${BASE_SITE_URL}/sitemap.xml\n\n${topPagesText}`, { parse_mode: 'Markdown', disable_web_page_preview: true });
    } catch (e) { ctx.reply('❌ فشل قراءة الإحصائيات.'); }
});

bot.hears('💾 جلب النسخة الاحتياطية', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    try { await ctx.replyWithDocument({ source: jsonPath, filename: 'data_backup.json' }, { caption: '💾 نسخة احتياطية آمنة.' }); } catch (e) { ctx.reply('❌ حدث خطأ أثناء إرسال النسخة.'); }
});

bot.hears('🗑️ حذف صفحة محددة', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    userSessions[ctx.from.id] = { step: 'awaiting_delete_slug' };
    ctx.reply('❗ أرسل الـ الرمز الفريد (Slug) الخاص بالصفحة المراد حذفها.');
});

bot.on('callback_query', async (ctx) => {
    const userId = ctx.from.id;
    const session = userSessions[userId];
    
    if (!session) return ctx.answerCbQuery('⚠️ انتهت صلاحية هذه الجلسة، ابدأ من جديد.');

    // 1. التعامل مع اختيار الثيم البصري
    if (session.step === 'awaiting_theme') {
        const selectedTheme = ctx.callbackQuery.data;
        session.theme = selectedTheme;
        
        await ctx.answerCbQuery('🎨 تم حفظ الثيم البصري!');
        session.step = 'awaiting_slug_choice';
        
        return ctx.editMessageText('⚙️ الآن اختر طريقة إنشاء الرمز الفريد للرابط (Slug) لتنظيم السيو:',
            Markup.inlineKeyboard([
                [Markup.button.callback('🕒 توليد رمز تلقائي بالوقت', 'slug_auto')],
                [Markup.button.callback('✍️ كتابة رمز مخصص صديق للسيو', 'slug_custom')]
            ])
        );
    }

    // 2. معالجة اختيار نوع الرمز الـ Slug
    if (session.step === 'awaiting_slug_choice') {
        const choice = ctx.callbackQuery.data;
        if (choice === 'slug_auto') {
            const slug = "page-" + Date.now();
            await ctx.answerCbQuery();
            return finalizePageCreation(ctx, userId, slug);
        } else {
            session.step = 'awaiting_custom_slug_text';
            await ctx.answerCbQuery();
            return ctx.editMessageText('✍️ أرسل لي الآن الرمز المخصص الذي تريده للرابط باللغة الإنجليزية بدون مسافات (مثال: `best-telegram-channels`):', { parse_mode: 'Markdown' });
        }
    }
});

// دالة الإنهاء والحفظ النهائي الفوري على Vercel
async function finalizePageCreation(ctx, userId, slug) {
    const session = userSessions[userId];
    const { target_url, title, keywords, desc, theme } = session.data || session;
    const finalTheme = theme || session.theme;

    const progressMessage = await ctx.reply('⚙️ جاري معالجة الأكواد والـ Dynamic Reviews وحقن البيانات المنظمة...');

    try {
        const currentData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        
        // التحقق من عدم تكرار الـ Slug المخصص
        if (currentData.some(item => item.slug === slug)) {
            return ctx.reply('❌ هذا الرمز مستخدم بالفعل في صفحة أخرى! يرجى البدء من جديد واختيار رمز مختلف.', getMainKeyboard(userId));
        }

        currentData.push({ title, slug, target_url, keywords, desc, theme: finalTheme });
        fs.writeFileSync(jsonPath, JSON.stringify(currentData, null, 2), 'utf8');
        
        rebuildSEO(currentData);

        pushToGitHub(async (success) => {
            if (success) {
                let timeLeft = 25; 
                const interval = setInterval(async () => {
                    timeLeft -= 5;
                    if (timeLeft <= 0) {
                        clearInterval(interval);
                        await bot.telegram.deleteMessage(ctx.chat.id, progressMessage.message_id).catch(() => {});
                        
                        ctx.reply(`🎉 تم إطلاق ونشر صفحتك الاحترافية بنجاح لايف!\n\n🚀 [الخصائص المفعلة]:\n• نظام التدوير والفرز الذكي A/B Testing.\n• لوحة تقييمات ومراجعات فيروسية حية.\n• الرمز والـ Slug المخصص الصديق لمحركات البحث.\n\n🔗 رابط صفحتك الآن جاهز كلياً:\n${BASE_SITE_URL}/${slug}.html`, getMainKeyboard(userId));
                        
                        if (userId !== ADMIN_ID && ADMIN_ID !== 0) {
                            bot.telegram.sendMessage(ADMIN_ID, `🔔 **إشعار الإدارة الفوري:**\nتم توليد صفحة هبوط سيو جديدة ومزامنتها لايف!\n\n📝 العنوان: ${title}\n🔗 الرابط: ${BASE_SITE_URL}/${slug}.html`, { parse_mode: 'Markdown' }).catch(()=>{});
                        }
                    } else {
                        await bot.telegram.editMessageText(ctx.chat.id, progressMessage.message_id, null, `⏳ جاري إنهاء بناء السيرفر السحابي (Deployment) على Vercel... يتبقى المزامنة النهائية خلال ${timeLeft} ثانية للاستقرار الفوري.`).catch(() => {});
                    }
                }, 5000);
            } else {
                ctx.reply(`⚠️ تم الحفظ محلياً ولكن مستودع Git مشغول، سيعمل الرابط تلقائياً هنا:\n${BASE_SITE_URL}/${slug}.html`, getMainKeyboard(userId));
            }
            userSessions[userId] = null;
        });
    } catch (error) {
        ctx.reply('❌ حدث خطأ داخلي أثناء معالجة وحفظ البيانات.');
    }
}

bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const session = userSessions[userId];
    const text = ctx.message.text.trim();

    if (session && session.step === 'awaiting_data') {
        const lines = text.split('\n');
        const target_url = lines[0].trim();
        const title = lines.length >= 2 ? lines[1].trim() : "";

        const checkingMsg = await ctx.reply('🔍 جاري فحص استقرار وجودة الروابط المرفقة لـ A/B Testing...');
        const isValid = await validateUrls(target_url);
        
        await bot.telegram.deleteMessage(ctx.chat.id, checkingMsg.message_id).catch(() => {});

        if (!isValid) {
            return ctx.reply('❌ خطأ: أحد الروابط المرفقة غير صالح أو معطل. يرجى التأكد وإعادة المحاولة لحماية قوة سيو موقعك.');
        }

        const metadata = generateSmartMetadata(title, target_url);

        userSessions[userId] = {
            step: 'awaiting_theme',
            data: { target_url, title: metadata.title, keywords: metadata.keywords, desc: metadata.desc }
        };

        ctx.reply(`🎯 الروابط سليمة وممتازة! تم توليد الأوصاف والكلمات الدلالية تلقائياً.\n\n📝 العنوان المعتمد: ${metadata.title}\n\n🎨 الآن اختر القالب البصري المناسب لصفحتك:`, 
            Markup.inlineKeyboard([
                [Markup.button.callback('🌌 مظهر مظلم احترافي', 'dark'), Markup.button.callback('☀️ مظهر مضيء كلاسيكي', 'light')],
                [Markup.button.callback('🔵 ثيم تليجرام الأزرق', 'telegram'), Markup.button.callback('🟢 ثيم واتساب الأخضر', 'whatsapp')]
            ])
        );
    } 
    
    else if (session && session.step === 'awaiting_custom_slug_text') {
        // تنظيف الـ Slug المدخل ليكون متوافقاً مع الروابط (بدون مسافات أو رموز غريبة)
        const cleanSlug = text.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-');
        if (!cleanSlug) return ctx.reply('⚠️ الرمز غير صالح، أرسل رمزاً يحتوي على أحرف وأرقام إنجليزية فقط.');
        
        session.step = null; 
        return finalizePageCreation(ctx, userId, cleanSlug);
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

            ctx.reply('🗑️ جاري حذف الصفحة كلياً ومزامنة خريطة الموقع الفورية...');
            pushToGitHub(() => {
                ctx.reply('✅ تم حذف الملف وتحديث خريطة الـ Sitemap بنجاح تآم على السيرفر الرئيسي!', getMainKeyboard(userId));
                userSessions[userId] = null;
            });
        } catch (e) { ctx.reply('❌ حدث خطأ أثناء عملية الحذف.'); }
    } 
    
    else {
        ctx.reply('👋 الرجاء استخدام الأزرار المتاحة للتحكم في النظام.', getMainKeyboard(userId));
    }
});

// إطلاق البوت
bot.launch().then(() => {
    console.log('🚀 تم تشغيل النظام المطور بأعلى الميزات الخارقة بنجاح...');
});
