# 📚 Academy Platform - Comprehensive User Manual

Welcome to the Academy Platform. This manual provides a detailed guide on how to use every feature of the website, tailored for both **Administrators** and **Students**.

---

## 📑 Table of Contents
1. [General Overview](#general-overview)
2. [Administrator Guide](#administrator-guide)
   - [Dashboard & Summary](#admin-dashboard)
   - [Managing Courses & Subjects](#managing-courses)
   - [Lecture & Material Management](#managing-materials)
   - [Broadcast Notices (Ticker Board)](#managing-notices)
   - [Live Classroom Setup](#live-classroom)
3. [Student Guide](#student-guide)
   - [Home Page Navigation](#home-navigation)
   - [Student Dashboard](#student-dashboard)
   - [Accessing Learning Content](#learning-content)
   - [Live Sessions](#live-sessions)
4. [Security Features](#security-features)

---

<a name="general-overview"></a>
## 🌍 1. General Overview
The Academy Platform is a professional education portal designed for JEE, NEET, and other competitive exams. It features a robust administration system and an intuitive student learning environment.

**Core Technology:**
- **Secure Video/PDF:** Built-in protection against unauthorized downloads.
- **Dynamic Notices:** Real-time information broadcasting.
- **Role-Based Access:** Distinct experiences for Guests, Registered Students, and Admins.

---

<a name="administrator-guide"></a>
## 🛠️ 2. Administrator Guide

Access the **Admin Panel** via the navigation bar. 

### 📊 Admin Dashboard
- **Quick Stats:** View total courses, registered students, and active live sessions at a glance.
- **Recent Notices:** A sidebar widget shows the latest broadcasts and their visibility status.

### 📚 Managing Courses & Subjects
1.  **Create Course:** Click "Add New Course". Provide a title, professional description, price, and category.
2.  **Add Subjects:** Every course needs subjects (e.g., Physics, Chemistry). Select the parent course and define the subject.
3.  **Visuals:** Upload high-quality thumbnail images to make courses attractive on the home page.

### 📝 Lecture & Material Management
1.  **Lectures:** Use the "Lectures" tab. Link lectures to a Subject and Course.
2.  **Secure Content:** When adding a lecture, you can provide a Video URL. Our player uses a secure layer to prevent direct URL sniffing.
3.  **PDF Notes:** Upload PDF files for study material. These open in our **Secure PDF Viewer** which disables the "Right Click" and "Print" functions by default to protect your IP.

### 📢 Broadcast Notices (Ticker Board)
This is the most critical tool for communication.
1.  **Create Notice:** Enter a title and content.
2.  **Visibility Option (CRITICAL):**
    - **Public:** Displays only on the Home Page (Guest accessible).
    - **Registered:** Displays only on the Student Dashboard (Login required).
    - **Both:** Displays everywhere.
3.  **Interactive Display:** Notices on the Home Page and Dashboard now scroll automatically from bottom to top to catch attention. Clicking a title opens the full details.

### 🎥 Live Classroom Setup
- Admins can trigger a "Live Now" state.
- Provide a meeting link (Zoom/Google Meet) and a description.
- Students will see a glowing "LIVE" indicator on their dash.

---

<a name="student-guide"></a>
## 👨‍🎓 3. Student Guide

### 🏠 Home Page Navigation
- **Sliding Notice Board:** Located on the right sidebar. It scrolls latest updates vertically. Click any notice to see full details.
- **Course Library:** Browse available tracks. Use the **Search Bar** or **Filters** (Course/Subject/Price) to find your target study material.

### 📈 Student Dashboard
Once logged in, your dashboard is your command center:
- **Personalized Greeting:** Tracks your progress and enrolled materials.
- **Student Board:** Shows notices specifically for registered students (e.g., Schedule changes, private links).
- **Study Ticker:** The sidebar in the dashboard keeps you updated while you browse.

### 📖 Accessing Learning Content
1.  **My Courses:** View all purchased content.
2.  **Unit Navigation:** Content is organized by Subject -> Unit -> Lecture.
3.  **View Mode:** Click a lecture to open the video player or PDF viewer. 

---

<a name="security-features"></a>
## 🛡️ 4. Security Features
- **Site Lock:** If the administrator enables "Maintenance Mode" or "Secure Lock", the site will be inaccessible to students until unlocked.
- **No-Sniff Metadata:** We hide technical file paths from students to prevent scraper bots.
- **Authentication:** Only verified Google Accounts can access student-only notices and materials.

---

## 💡 Pro Tips for Testing
- **Test Notice Visibility:** Create a "Registered Only" notice. Log out and confirm it is **NOT** on the home page. Log in as a student and confirm it **IS** visible on the dashboard.
- **Test Ticker:** Add 5-6 short notices to see the smooth vertical scrolling effect in action.
- **Theme Support:** Switch between Light and Dark mode using the toggle in the navbar to see the professional UI adjustments.
