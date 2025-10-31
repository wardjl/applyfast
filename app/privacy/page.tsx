export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
        <div className="prose prose-sm max-w-none">
          <p className="text-muted-foreground mb-6">Last updated: {new Date().toLocaleDateString()}</p>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">1. Information We Collect</h2>
            <h3 className="text-lg font-medium mb-2">Account Information</h3>
            <p>We collect your email address and password when you create an account.</p>

            <h3 className="text-lg font-medium mb-2 mt-4">Profile Information</h3>
            <p>We collect job preferences, skills, experience, and other profile data you provide to improve job matching.</p>

            <h3 className="text-lg font-medium mb-2 mt-4">Usage Data</h3>
            <p>We track your AI usage, job scraping activity, and interactions with the service to enforce limits and improve functionality.</p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">2. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>To provide and maintain the service</li>
              <li>To authenticate your account and prevent unauthorized access</li>
              <li>To scrape and analyze job postings relevant to your preferences</li>
              <li>To score jobs using AI based on your profile</li>
              <li>To send email notifications about new job matches (if enabled)</li>
              <li>To enforce usage limits and prevent abuse</li>
              <li>To improve and optimize the service</li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">3. Data Storage and Security</h2>
            <p>Your data is stored securely using Convex, a modern backend-as-a-service platform. We implement industry-standard security measures to protect your information, but no method of transmission over the internet is 100% secure.</p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">4. Third-Party Services</h2>
            <p>We use the following third-party services that may collect information:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Apify:</strong> For scraping job postings from LinkedIn</li>
              <li><strong>AI Services:</strong> For analyzing and scoring job postings</li>
              <li><strong>Resend:</strong> For sending email notifications</li>
              <li><strong>Vercel:</strong> For hosting the application</li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">5. Data Sharing</h2>
            <p>We do not sell, trade, or rent your personal information to third parties. We may share data with service providers necessary to operate the application, subject to confidentiality obligations.</p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">6. Job Posting Data</h2>
            <p>Job postings are scraped from publicly available sources. We store and process this data to provide job matching services. This data may include company names, job titles, descriptions, and URLs.</p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">7. Email Communications</h2>
            <p>With your consent, we may send you email notifications about job matches. You can disable these notifications at any time through your account settings.</p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">8. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Access your personal data</li>
              <li>Update or correct your information</li>
              <li>Delete your account and associated data</li>
              <li>Opt out of email communications</li>
              <li>Export your data</li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">9. Data Retention</h2>
            <p>We retain your data for as long as your account is active or as needed to provide services. If you delete your account, we will delete your personal data within a reasonable timeframe.</p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">10. Cookies and Tracking</h2>
            <p>We use cookies and similar technologies for authentication, session management, and to improve your experience.</p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">11. Children&apos;s Privacy</h2>
            <p>Our service is not intended for users under 18 years of age. We do not knowingly collect information from children.</p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">12. Changes to Privacy Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of significant changes by posting the new policy on this page with an updated date.</p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">13. Contact Us</h2>
            <p>For questions about this Privacy Policy or to exercise your rights, please contact us at: wardleenders [at] gmail.com</p>
          </section>
        </div>
      </div>
    </div>
  )
}
