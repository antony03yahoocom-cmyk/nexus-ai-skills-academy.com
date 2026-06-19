import { Link } from "react-router-dom";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

const TermsOfServicePage = () => {
  const lastUpdated = "June 2025";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-16 max-w-3xl">
        <div className="mb-10">
          <p className="text-sm text-primary font-medium mb-2">Legal</p>
          <h1 className="text-3xl font-bold mb-3">Terms of Service</h1>
          <p className="text-muted-foreground text-sm">Last updated: {lastUpdated}</p>
        </div>

        <div className="prose prose-sm max-w-none space-y-8 text-foreground/90 leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold mb-2">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              By creating an account or using NEXUS AI Skills Academy ("the Platform"), you agree to
              these Terms of Service. If you do not agree, please do not use the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. The Platform</h2>
            <p className="text-muted-foreground">
              NEXUS AI Skills Academy provides online courses, learning resources, certificates, and a
              marketplace connecting students with employers. We reserve the right to update, modify,
              or discontinue any part of the Platform at any time.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. Your Account</h2>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-muted-foreground">
              <li>You must be at least 16 years old to create an account</li>
              <li>You are responsible for keeping your login credentials secure</li>
              <li>You may not share your account with others</li>
              <li>You must provide accurate information when registering</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. Courses & Access</h2>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-muted-foreground">
              <li>Free trial access is limited to 7 days and up to 5 lessons per course</li>
              <li>Premium access grants entry to all published courses for the duration of your subscription</li>
              <li>Course content is for personal, non-commercial learning only</li>
              <li>You may not copy, distribute, or resell any course materials</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Payments & Refunds</h2>
            <p className="text-muted-foreground">
              Payments are processed securely via Paystack. Subscription fees are charged in advance.
              Refund requests must be made within 7 days of purchase and will be reviewed on a
              case-by-case basis. Contact us at{" "}
              <a href="mailto:hello@nexusaiacademy.com" className="text-primary hover:underline">
                hello@nexusaiacademy.com
              </a>{" "}
              for refund enquiries.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. Certificates</h2>
            <p className="text-muted-foreground">
              Certificates are awarded upon successful completion of course requirements as determined
              by our instructors. NEXUS AI Skills Academy certificates are issued by the Platform and
              are not government-accredited qualifications unless otherwise stated.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Community & Conduct</h2>
            <p className="text-muted-foreground">
              Users of the community, messaging, and discussion features must behave respectfully.
              We prohibit spam, harassment, hate speech, and sharing of inappropriate content.
              Violations may result in suspension or permanent account removal.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. Employer Marketplace</h2>
            <p className="text-muted-foreground">
              Employers using the talent marketplace are responsible for the accuracy of their job
              postings. NEXUS AI Skills Academy acts as a platform only and is not a party to any
              employment, freelance, or internship agreement between employers and students.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">9. Intellectual Property</h2>
            <p className="text-muted-foreground">
              All course content, branding, and materials on the Platform are owned by NEXUS AI
              Skills Academy or its content partners. You may not reproduce or redistribute any
              content without prior written permission.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">10. Limitation of Liability</h2>
            <p className="text-muted-foreground">
              The Platform is provided "as is". We make no guarantees regarding employment outcomes,
              earnings, or course results. To the fullest extent permitted by law, NEXUS AI Skills
              Academy shall not be liable for any indirect or consequential loss arising from your
              use of the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">11. Governing Law</h2>
            <p className="text-muted-foreground">
              These Terms are governed by the laws of Kenya. Any disputes shall be subject to the
              jurisdiction of the courts of Nairobi, Kenya.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">12. Contact</h2>
            <p className="text-muted-foreground">
              For questions about these Terms, contact us at{" "}
              <a href="mailto:hello@nexusaiacademy.com" className="text-primary hover:underline">
                hello@nexusaiacademy.com
              </a>.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-border flex flex-wrap gap-4 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors">← Back to Home</Link>
          <span>·</span>
          <Link to="/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TermsOfServicePage;
