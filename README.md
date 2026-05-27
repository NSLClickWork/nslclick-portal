# 🌟 NSL Click - Student Result & Management Portal

[![Language](https://img.shields.io/badge/Language-Node.js-green.svg)](https://nodejs.org)
[![Framework](https://img.shields.io/badge/Framework-Express-lightgrey.svg)](https://expressjs.com)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![Deployment](https://img.shields.io/badge/Deployment-Vercel-black.svg)](https://vercel.com)

A premium, enterprise-grade management system designed for **NSL (Study & Work in Germany)**. This portal provides an elegant, modern student/partner viewer and a powerful administrative dashboard for full student lifecycle management.

---

## 🚀 Key Features

### 🎓 For Students
- **🔐 Secure Access**: Instant login via Student ID protected by Cloudflare Turnstile CAPTCHA.
- **📊 Interactive Profiles**: Dynamic student profiles featuring German proficiency levels, test scores, NSL-Scores, and strengths.
- **📄 Document Integration**: Embedded Google Drive Photo proxies and YouTube video introductions.
- **🎨 Premium Design**: A modern, responsive UI featuring professional typography (Inter/Montserrat), high-contrast dark-mode-inspired aesthetics, and smooth glassmorphism.

### 🏢 For Partners
- **🔐 Secure Access**: Login via secure Access Code.
- **📊 Filtered Dashboard**: View only candidates matching specific professions and centers based on granular access control.
- **🌍 Multi-language**: Interface supports German (DE), English (EN), and Vietnamese (VI).

### 🛠 Administrative Dashboard
- **📈 Live Management**: A central hub to monitor, search, and manage student and partner entries in real-time.
- **✏️ CRUD Operations**: Fully functional student and partner management (Add, Edit, Archive, Restore, Revoke).
- **🤖 Automated Media Generation (Batch Jobs)**: 
  - Generates PDF Setcards via Puppeteer and uploads them to Google Drive.
  - Generates Video Introductions with Canva overlays via FFmpeg and uploads them to YouTube (with Google Drive fallback).

---

## 🛠 Tech Stack

- **Backend**: Node.js, Express.js (v5+)
- **Database**: Google Sheets API (Acts as the primary database)
- **Storage**: Google Drive API (For images, raw videos, generated PDFs) & YouTube Data API v3 (For video uploads)
- **Templating**: EJS (Embedded JavaScript)
- **Styling**: Vanilla CSS (Custom Design System, Premium UI)
- **Security**: Cloudflare Turnstile, bcrypt, express-rate-limit, cookie-session, Custom CSRF protection
- **Media Processing**: Puppeteer (PDF generation), FFmpeg / fluent-ffmpeg (Video processing), OpenCV (Face cropping)

---

## 💻 Getting Started

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/NSLClickWork/nslclick-huber.git
   cd nslclick-huber
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   Create a `.env` file based on `.env.example`. 
   ```env
   USE_MOCK_DATA=false
   GOOGLE_SPREADSHEET_ID=1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4
   # You must also place credentials.json and token.json in the root directory.
   ```

4. **Launch**
   ```bash
   npm run dev
   ```

---

## 🤝 Collaboration Workflow (Tom & Duy)
This repository uses a Feature Branch workflow augmented by AI code reviews:

1. **Branches**: 
   - `main`: Production branch (connected to Vercel/Server).
   - `tom-dev`: Tom's working branch.
   - `duy-dev`: Duy's working branch.
2. **Rules**: 
   - **DO NOT** push directly to `main`. 
   - Push your changes to your respective branch (`tom-dev` or `duy-dev`).
   - When ready to merge, use the AI (Antigravity) to review changes, resolve conflicts, and sync code between the two dev branches before doing a final Pull Request to `main`.
3. **Secrets**:
   - The `.env`, `credentials.json`, and `token.json` files contain sensitive credentials and must **never** be committed to GitHub. Share them securely via internal channels.

---

## ☁️ Deployment

This project is optimized for **Vercel** and generic VPS deployments.
- **Filesystem Compatibility**: Automatically uses `/tmp` for temporary storage on serverless environments.
- **OAuth Setup**: Ensure OAuth redirect URIs match your production domain.

---

## 📚 For AI Assistants & Contributors
Please refer to `docs/CONTEXT.md` and `docs/QUY_UOC_DU_AN.md` before making any structural changes to the codebase.

---

*Built with ❤️ for NSL (Germany) by [Khoi Nguyen (Tom-VN)](https://github.com/tommm1207)*
