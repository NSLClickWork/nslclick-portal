# 🌟 NSL Click - Student Result & Management Porta

[![Language](https://img.shields.io/badge/Language-Node.js-green.svg)](https://nodejs.org)
[![Framework](https://img.shields.io/badge/Framework-Express-lightgrey.svg)](https://expressjs.com)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![Deploy ment](https://img.shields.io/badge/Deployment-Vercel-black.svg)](https://vercel.com)

A premium, enterprise-grade management system designed for **NSL (Study & Work in Germany)**. This portal provides two core experiences: a sleek, Bauhaus-inspired student result viewer and a powerful administrative dashboard for full student lifecycle management.

---

## 🚀 Key Features

### 🎓 Student Experience
- **🔐 Secure Access**: Instant login via phone number with persistent session management.
- **📊 Interactive Profiles**: Dynamic student profiles featuring German proficiency levels, test scores, and interview performance.
- **📄 Document Integration**: Embedded Google Drive CV previews, high-resolution student photos, and video introductions.
- **🎨 Bauhaus Design**: A modern, responsive UI featuring professional typography (Montserrat/Inter) and a clean, high-contrast aesthetic.

### 🛠 Administrative Dashboard
- **📈 Live Management**: A central hub to monitor, search, and manage student entries in real-time.
- **✏️ Inline Data Editing**: Rapid, spreadsheet-like editing for all student fields directly within the dashboard.
- **📂 Industrial File Handling**: Integrated upload system for Photos, CVs (PDF), and Video assets.
- **♻️ Recycle Bin System**: Robust soft-delete workflow with a dedicated "Trash" to restore or permanently remove records.
- **⚡ Toast Notifications**: Real-time feedback for all CRUD operations using a custom built-in notification system.
- **📥 CSV Bulk Import**: Seamlessly import large student datasets from legacy Excel/CSV files.

---

## 🛠 Tech Stack

- **Backend**: Node.js, Express.js (v5+)
- **Storage/Integration**: Microsoft Graph API (SharePoint) & Mock Data Mode
- **Templating**: EJS (Embedded JavaScript)
- **Styling**: Vanilla CSS (Custom Design System, Responsive Bauhaus UI)
- **Security**: express-session, cookie-session, Role-based Access Control
- **Deployment**: Vercel-optimized (Serverless ready)

---

## 💻 Getting Started

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/tommm1207/NSLClick-Huber.git
   cd NSLClick-Huber
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   Create a `.env` file based on `.env.example`:
   ```env
   USE_MOCK_DATA=true # Set to false for SharePoint
   ADMIN_PASSWORD=your_secure_password
   SESSION_SECRET=your_random_secret
   # SharePoint/Graph API credentials
   TENANT_ID=...
   CLIENT_ID=...
   CLIENT_SECRET=...
   ```

4. **Launch**
   ```bash
   npm run dev
   ```

---

## ☁️ Deployment

This project is optimized for **Vercel**. 
- **Multer Compatibility**: Automatically detects Vercel environments and uses `/tmp` for temporary storage.
- **Zero Config**: Uses `vercel.json` for immediate deployment without setup.

---

## 📝 License

This project is licensed under the **ISC License**.

---

*Built with ❤️ for NSL (Germany) by [Khoi Nguyen (Tom-VN)](https://github.com/tommm1207)*
