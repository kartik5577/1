# Vectonix Classes - User Guide & Documentation

> [!IMPORTANT]
> For a highly detailed, step-by-step guide for both Admins and Students, please see the [**Comprehensive User Manual**](/USER_MANUAL.md).

Welcome to your professional e-learning portal. This guide will help you and your students navigate the platform effectively.

---

## 🔐 1. Getting Started
- **URL**: [Insert your production URL here]
- **Admin Login**: 
  - **Phone/ID**: `9286670192`
  - **Password**: `123456`
  - *(Note: Primary secure access is via **Google Login** linked to `vectonixclasses@gmail.com`)*
- **Student Access**: Students sign in via Google to maintain a permanent record of their courses and notes.

---

## 💳 2. Payment Testing (Razorpay)
When testing the purchase flow, use the following **Test Mode** credentials:
- **Card Number**: `4100 2800 0000 1007`
- **Expiry Date**: Any future date (e.g., `12/2030`)
- **CVV**: Any 3-digit number (e.g., `123`)
- **OTP**: `123456`
- **Workflow**: 
  1. Browse the **Catalog**.
  2. Add items to your **Cart**.
  3. Enter the test card above during checkout.
  4. Select "Success" on the simulated bank page to unlock the content.

---

## 🛠 3. Admin Tools Detailed Guide

Your Admin Panel is organized into 7 specialized tabs. Here is how to use each one:

### 📊 Tab 1: Dashboard
- **Total Revenue**: Sum of all successful transactions.
- **Active Students**: Total number of accounts created on your portal.
- **Sales Trend**: A visual graph showing your weekly/monthly growth. Use this to identify which days have the most traffic.

### 📚 Tab 2: Courses
This is where you bundle your knowledge.
- **Create New**: Give it a title, price (set to `0` for free), and cover image.
- **Curriculum**: Once a course is created, you can link specific **Notes** and **Lectures** to it. Students will only see these assets if they have purchased the course.

### 📝 Tab 3: Notes (PDFs)
- **Upload**: Select your PDF file.
- **Security**: Our system automatically wraps your PDFs in a restricted viewer. Students cannot right-click or use "Save As" on these files, ensuring your notes stay on your platform.

### 🎥 Tab 4: Lectures (Videos)
- **Video Linking**: We support direct YouTube links (Normal, Shorts, and Live).
- **Categories**: Organize your videos by subject so students can find them easily in the Catalog.

### 📡 Tab 5: Live Classes 
This is the most powerful tool in the portal.
- **Create**: Schedule a class for a future date.
- **Start**: When you click "Start Class," a notification is sent to all student dashboards automatically.
- **Moderator Controls**: As the Admin, you enter the room with **Full Control**. 
  - Students enter **Muted** to prevent noise.
  - You can hear students only if you allow them to unmute.
  - Use the **Native Chat** on the right to interact without blocking the video.

### 💰 Tab 6: Sales
- **Transaction History**: Every time a student pays, it appears here instantly.
- **Details**: Shows the student email, the item purchased, and the exact timestamp.

### ⚙️ Tab 7: Settings
- **Branding**: Change your Academy Name and Description.
- **Production Reset (CRITICAL)**: Use this button ONLY when you are ready to remove all test data and launch to real customers. It will wipe everything except your Admin account.

---

## 🎓 4. Student Guide
- **Personal Library**: "My Courses" acts as their digital locker.
- **Note-Taking**: Students can view lectures and keep their notes open in a separate tab for a dual-monitor learning experience.
- **Live Interaction**: The native chat is saved per session, allowing students to see FAQs discussed during the live.

### B. Managing Live Classes (The "Real-Time" Classroom)
Live classes are the heart of the portal. You have two options when creating a class:
1.  **Internal Room (Vectonix Live)**: 
    - No external link needed.
    - Uses a secure, integrated video bridge.
    - **How to Start**: Go to Admin Panel > Live Classes > Click **"Start Live"**.
2.  **External Link (YouTube/Zoom)**:
    - Paste your YouTube Live or Zoom link.
    - The portal automatically embeds YouTube videos for a seamless student experience.
    - **Youtube Support**: Paste standard URL, Shorts, or "Live" URLs.

### C. Resource Management
- **Notes**: Upload PDF files directly. Students can view them in a secure viewer (printing/downloading disabled for security).
- **Lectures**: Recorded video content (YouTube supported).
- **Courses**: Group your materials into paid or free bundles.

### D. Preparing for Production ("Danger Zone")
Before handing the site to real students, go to **Admin Panel > Settings**:
- Find the **Danger Zone** at the bottom.
- Click **"Clear All Training/Test Data"**.
- This will wipe all dummy courses, sales, and notes, giving you a fresh start for real business.

---

## 🎓 4. Student Guide

### A. The Dashboard
Students see a personalized view:
- **Live Now Badge**: A pulse animation appears whenever an Admin starts a live session.
- **My Courses**: Easy access to purchased content.
- **Recent Resources**: Quick links to the latest notes and lectures.

### B. Joining a Class
1.  Click **"Join Class"** from the dashboard or sidebar.
2.  **Chat Integration**: Once inside the classroom, students can use the right-side chat panel to ask questions in real-time.
3.  **Audio/Video**: Students enter the internal room muted by default to allow the teacher to lead. They can unmute to ask questions if permitted.

### C. Purchasing Content
- Students add items to their **Cart**.
- They complete the purchase (Sandbox mode during testing, real payments after Stripe/Razorpay config).
- Content is instantly unlocked in their profile.

---

## 📺 5. Pro-Tips for Video
To ensure videos load perfectly:
- **YouTube**: Always ensure the video is set to **"Public"** or **"Unlisted"**. "Private" videos will not load for students.
- **Embeds**: The portal automatically forces a "clean" YouTube view (no ads, minimal branding) for a professional look.

---

## 📁 6. Technical Structure (For Developers)
- **Database**: Firebase Firestore.
- **Storage**: Firebase Storage (for PDFs).
- **Real-time**: Custom `onSnapshot` listeners ensure sync between Admin and Student without page refreshes.
