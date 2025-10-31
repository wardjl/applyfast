export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-3xl font-bold mb-8">Terms and Conditions</h1>
        <div className="prose prose-sm max-w-none">
          <p className="text-muted-foreground mb-6">Last updated: {new Date().toLocaleDateString()}</p>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
            <p>By accessing and using ApplyFa.st, you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you may not use the service.</p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
            <p>ApplyFa.st is a job search application that aggregates and analyzes job postings from LinkedIn. The service uses AI to score jobs based on your profile and preferences.</p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">3. User Accounts</h2>
            <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify us immediately of any unauthorized access.</p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">4. Usage Limits</h2>
            <p>AI-powered job scoring is subject to daily and monthly usage limits. We reserve the right to modify these limits at any time.</p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">5. Data Scraping</h2>
            <p>Our service scrapes publicly available job postings from LinkedIn. You agree not to use this service for any purpose that violates LinkedIn&apos;s terms of service or applicable laws.</p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">6. Intellectual Property</h2>
            <p>The service, including its original content, features, and functionality, is owned by ApplyFa.st and is protected by international copyright, trademark, and other intellectual property laws.</p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">7. Disclaimer of Warranties</h2>
            <p>The service is provided &quot;as is&quot; without warranties of any kind. We do not guarantee the accuracy, completeness, or timeliness of job postings or AI scoring results.</p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">8. Limitation of Liability</h2>
            <p>ApplyFa.st shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use or inability to use the service.</p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">9. Termination</h2>
            <p>We reserve the right to terminate or suspend your account at any time without prior notice for conduct that we believe violates these terms or is harmful to other users.</p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">10. Changes to Terms</h2>
            <p>We reserve the right to modify these terms at any time. Continued use of the service after changes constitutes acceptance of the modified terms.</p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-3">11. Contact</h2>
            <p>For questions about these Terms and Conditions, please contact us at: wardleenders [at] gmail.com</p>
          </section>
        </div>
      </div>
    </div>
  )
}
