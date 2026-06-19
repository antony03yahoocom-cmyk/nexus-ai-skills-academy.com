import { Link } from "react-router-dom";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

const PrivacyPolicyPage = () => {
  const lastUpdated = "June 2025";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-16 max-w-3xl">
        <div className="mb-10">
          <p className="text-sm text-primary font-medium mb-2">Legal</p>
          <h1 className="text-3xl font-bold mb-3">Privacy Policy</h1>
          <p className="text-muted-foreground text-sm">Last updated: {lastUpdated}</p>
        </div>

        <div className="prose prose-sm max-w-none space-y-8 text-foreground/90 leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold mb-2">1. Who We Are</h2>
            <p className="text-muted-foreground">
              NEXUS AI Skills Academy ("we", "us", or "our") is an online learning platform based in Nairobi,
              Kenya. We provide AI, digital skills, and tech courses to learners across Africa. You can contact
              us at <a href="mailto:hello@nexusaiacademy.com" className="text-primary hover:underline">hello@nexusaiacademy.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. Information We Collect</h2>
            <p className="text-muted-foreground">We collect the following information when you use our platform:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-muted-foreground">
              <li>Name and email address when you create an account</li>
              <li>Profile information you choose to provide (photo, bio, skills)</li>
              <li>Course progress, assignment submissions, and certificates earned</li>
              <li>Payment information processed securely through Paystack (we do not store card details)</li>
              <li>Device and usage data such as browser type and pages visited</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. How We Use Your Information</h2>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-muted-foreground">
              <li>To create and manage your account</li>
              <li>To deliver course content and track your learning progress</li>
              <li>To process payments and issue certificates</li>
              <li>To send you important updates about your account or courses</li>
              <li>To improve our platform and user experience</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. Sharing Your Information</h2>
            <p className="text-muted-foreground">
              We do not sell your personal data. We may share information with trusted service providers
              (such as Supabase for database hosting and Paystack for payments) only as necessary to
              operate our platform. These providers are bound by confidentiality obligations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Cookies</h2>
            <p className="text-muted-foreground">
              We use essential cookies to keep you logged in and remember your preferences. We do not
              use advertising or tracking cookies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. Your Rights</h2>
            <p className="text-muted-foreground">
              You have the right to access, correct, or delete your personal data at any time. You can
              update your profile from your account settings or contact us to request account deletion.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Data Security</h2>
            <p className="text-muted-foreground">
              We take reasonable technical and organisational measures to protect your data. All data
              is stored on secure, encrypted infrastructure provided by Supabase.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. Children</h2>
            <p className="text-muted-foreground">
              Our platform is intended for users aged 16 and above. We do not knowingly collect data
              from children under 16.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">9. Changes to This Policy</h2>
            <p className="text-muted-foreground">
              We may update this Privacy Policy from time to time. We will notify registered users of
              any significant changes via email or an in-app notice.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">10. Contact Us</h2>
            <p className="text-muted-foreground">
              If you have any questions about this Privacy Policy, please contact us at{" "}
              <a href="mailto:hello@nexusaiacademy.com" className="text-primary hover:underline">
                hello@nexusaiacademy.com
              </a>.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-border flex flex-wrap gap-4 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors">← Back to Home</Link>
          <span>·</span>
          <Link to="/terms-of-service" className="hover:text-foreground transition-colors">Terms of Service</Link>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPolicyPage;
