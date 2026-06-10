const express = require("express");
const app = express();

// 🔗 Home Page (SEO + Google Verification)
app.get("/", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />

  <!-- Google Search Console Verification -->
  <meta name="google-site-verification" content="GjG_4udm4mVuV5oD5aL1AIlcS-R74AAqO2Lwe7FClPE" />

  <title>My SEO Bot</title>
</head>
<body>
  <h1>SEO Bot Running on Vercel 🚀</h1>
  <p>Hybrid SEO & Archive System is live.</p>
</body>
</html>`);
});

// لاحقًا سنضيف:
// /a/:slug
// /r/:slug

module.exports = app;
