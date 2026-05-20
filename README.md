# Welcome to project NEXUS AI ACADEMY

# 🚀 NEXUS AI ACADEMY

**NEXUS AI ACADEMY** is a modern, scalable online learning platform designed to deliver high-quality courses in AI, Web Development, Design, Data Analysis, and more.

It provides a premium learning experience with structured lessons, assignments, progress tracking, and secure payment integration.

---

## 🌐 Live Demo

https://nexus-ai-skills-academy.lovable.app/

---

## 📌 Features

### 🎓 Learning System

* Courses → Modules → Lessons structure
* Video lessons with written explanations
* Attachments (PDFs, resources)
* Lesson progression tracking

---

### 📝 Assignment System

* Assignments for every lesson
* File uploads & text submissions
* Auto approval (Basic / Smart AI-based)
* Feedback system (AI + Admin)

---

### 🔒 Progress Lock System

* Lessons unlock **only after assignment approval**
* Sequential learning enforced
* Locked lessons display 🔒 indicator

---

### 💰 Monetization System

* Free trial courses (7 days access)
* Premium courses (paid access)
* Per-course pricing model
* Subscription support

---

### 💳 Payment Integration

* Paystack checkout system
* Secure transaction verification
* Automatic course unlocking after payment

---

### 👨‍🎓 Student Dashboard

* Enrolled courses
* Progress tracking
* Assignment status
* Certificates
* Purchased courses

---

### 🛠 Admin Dashboard

* Manage courses, modules, lessons
* Review assignments
* Manage students
* View analytics

---

### 🎓 Certification System

* Auto-generated certificates upon completion
* Downloadable PDF certificates
* Unique certificate IDs

---

### 📂 File Management

* Secure file uploads
* Storage buckets:

  * lesson_videos
  * assignment_files
  * certificates
  * project_files

---

### 🤖 AI Automation

* AI-based assignment evaluation
* Automated feedback system
* Smart validation rules

---

## 🏗 Tech Stack

* **Frontend:** Lovable (React-based UI)
* **Backend:** Lovable Cloud (Database, Auth, Storage, Edge Functions)
* **Database:** PostgreSQL (via Lovable Cloud)
* **Authentication:** Built-in Auth system
* **Storage:** Cloud Storage Buckets
* **Payments:** Paystack API
* **AI Integration:** OpenAI / AI evaluation system

---

## 📁 Project Structure

```
/src
  /components
  /pages
  /dashboard
  /admin
  /auth
  /courses
  /lesson-viewer

/backend
  /functions
  /payments
  /ai-evaluation

/database
  schema.sql
```

---

## ⚙️ Installation & Setup

### 1️⃣ Clone Repository

```
git clone https://github.com/your-username/nexus-ai-academy.git
cd nexus-ai-academy
```

---

### 2️⃣ Install Dependencies

```
npm install
```

---

### 3️⃣ Configure Environment Variables

Create a `.env` file:

```
PAYSTACK_SECRET_KEY=your_secret_key
PUBLIC_URL=your_app_url
```

---

### 4️⃣ Run Development Server

```
npm run dev
```

---

## 💳 Paystack Setup

1. Create account at https://paystack.com
2. Get your **Secret Key**
3. Add it to environment variables
4. Ensure backend verifies transactions before unlocking courses

---

## 📦 Storage Buckets Required

Make sure these buckets exist:

* `lesson_videos`
* `assignment_files`
* `lesson_attachments`
* `certificates`
* `project_files`

---

## 🔐 Access Control Logic

### Free Trial

* 7-day access
* Limited lessons

### Premium Courses

* Unlock after payment

### Lesson Unlock Rules

* Assignment must be submitted
* Assignment must be approved

---

## 🚀 Deployment

Deploy using:

* Lovable Cloud (recommended)
* Vercel / Netlify (frontend)
* Ensure backend functions are deployed

---

## 📈 Future Improvements

* Mobile App (React Native)
* Gamification (XP, badges, leaderboard)
* Live classes integration
* Community chat system
* Advanced analytics dashboard

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create a new branch
3. Commit your changes
4. Submit a pull request

---

## 📄 License

This project is licensed under the MIT License.

---

## 👤 Author

**Antony Mwangi**
Founder — NEXUS AI ACADEMY

---

## 💡 Vision

To build a platform where anyone can learn **high-income digital skills** and transform their future using AI and technology.

---

## ⭐ Support

If you like this project:

👉 Star the repo
👉 Share it
👉 Contribute

---

**NEXUS AI ACADEMY — Learn. Build. Earn. 🚀**
