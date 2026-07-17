/* ============================================================
   MURDER MITTEN MEDIA -- Privacy Policy Page
   ============================================================ */

import { SiteNav } from "@/components/SiteNav";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">

      {/* -- NAV ----------------------------------------------- */}
      <SiteNav />

      {/* -- HERO ---------------------------------------------- */}
      <section className="pt-32 pb-16 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-600/5 to-transparent" />
        <div className="container relative z-10">
          <div className="flex flex-col items-center gap-4 mb-6">
            <img src="/manus-storage/mmm_logo_8689da6b.png" alt="Murder Mitten Media Logo" className="w-24 h-24 rounded-full object-cover border-2 border-red-600/50 shadow-[0_0_30px_rgba(209,0,0,0.3)]" />
          </div>
          <h1 className="font-['Anton'] text-6xl md:text-8xl uppercase mb-4">
            PRIVACY <span className="text-red-600">POLICY</span>
          </h1>
          <p className="text-white/50 text-lg max-w-2xl mx-auto">
            Your privacy matters to us. Learn how Murder Mitten Media collects, uses, and protects your information.
          </p>
        </div>
      </section>

      {/* -- CONTENT -------------------------------------------- */}
      <section className="py-16">
        <div className="container max-w-3xl">
          <div className="space-y-12">

            {/* Introduction */}
            <div>
              <h2 className="font-['Anton'] text-3xl text-red-600 mb-4 uppercase">Introduction</h2>
              <p className="text-white/70 leading-relaxed">
                Murder Mitten Media ("we," "us," "our," or "Company") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our services.
              </p>
            </div>

            {/* Information We Collect */}
            <div>
              <h2 className="font-['Anton'] text-3xl text-red-600 mb-4 uppercase">Information We Collect</h2>
              <div className="space-y-4 text-white/70">
                <div>
                  <h3 className="text-white font-semibold mb-2">Personal Information</h3>
                  <p className="leading-relaxed">
                    We may collect personal information that you voluntarily provide, including but not limited to:
                  </p>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-white/60">
                    <li>Name and contact information (email, phone number)</li>
                    <li>Artist name and social media handles</li>
                    <li>Payment information (processed securely through third-party payment providers)</li>
                    <li>Content submissions and metadata</li>
                    <li>Account information and profile details</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-white font-semibold mb-2">Automatically Collected Information</h3>
                  <p className="leading-relaxed">
                    When you visit our website, we may automatically collect:
                  </p>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-white/60">
                    <li>IP address and device information</li>
                    <li>Browser type and operating system</li>
                    <li>Pages visited and time spent on site</li>
                    <li>Referral source and navigation patterns</li>
                    <li>Cookies and similar tracking technologies</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* How We Use Your Information */}
            <div>
              <h2 className="font-['Anton'] text-3xl text-red-600 mb-4 uppercase">How We Use Your Information</h2>
              <p className="text-white/70 leading-relaxed mb-4">
                We use the information we collect for the following purposes:
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/70">
                <li>Processing transactions and sending related information</li>
                <li>Providing, maintaining, and improving our services</li>
                <li>Responding to your inquiries and providing customer support</li>
                <li>Sending promotional materials and updates (with your consent)</li>
                <li>Analyzing usage patterns to improve user experience</li>
                <li>Detecting and preventing fraudulent activity</li>
                <li>Complying with legal obligations</li>
              </ul>
            </div>

            {/* Disclosure of Information */}
            <div>
              <h2 className="font-['Anton'] text-3xl text-red-600 mb-4 uppercase">Disclosure of Information</h2>
              <p className="text-white/70 leading-relaxed mb-4">
                We may disclose your information in the following circumstances:
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/70">
                <li><span className="text-white font-semibold">Service Providers:</span> We share information with third-party service providers who assist us in operating our website and conducting our business (payment processors, hosting providers, analytics services).</li>
                <li><span className="text-white font-semibold">Legal Requirements:</span> We may disclose information when required by law or in response to legal process.</li>
                <li><span className="text-white font-semibold">Business Transfers:</span> If Murder Mitten Media is involved in a merger, acquisition, or asset sale, your information may be transferred as part of that transaction.</li>
                <li><span className="text-white font-semibold">Your Consent:</span> We may disclose information with your explicit consent for specific purposes.</li>
              </ul>
            </div>

            {/* Security Practices */}
            <div>
              <h2 className="font-['Anton'] text-3xl text-red-600 mb-4 uppercase">Security Practices</h2>
              <p className="text-white/70 leading-relaxed">
                We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. These measures include:
              </p>
              <ul className="list-disc list-inside mt-4 space-y-2 text-white/70">
                <li>Secure socket layer (SSL) encryption for data transmission</li>
                <li>Restricted access to personal information</li>
                <li>Regular security assessments and updates</li>
                <li>Secure payment processing through trusted third-party providers</li>
              </ul>
              <p className="text-white/70 leading-relaxed mt-4">
                However, no method of transmission over the internet is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.
              </p>
            </div>

            {/* Cookies and Tracking */}
            <div>
              <h2 className="font-['Anton'] text-3xl text-red-600 mb-4 uppercase">Cookies and Tracking Technologies</h2>
              <p className="text-white/70 leading-relaxed">
                We use cookies and similar tracking technologies to enhance your experience on our website. You can control cookie settings through your browser preferences. Disabling cookies may affect the functionality of certain features on our site.
              </p>
            </div>

            {/* Your Rights */}
            <div>
              <h2 className="font-['Anton'] text-3xl text-red-600 mb-4 uppercase">Your Rights</h2>
              <p className="text-white/70 leading-relaxed mb-4">
                Depending on your location, you may have certain rights regarding your personal information:
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/70">
                <li><span className="text-white font-semibold">Access:</span> You may request access to the personal information we hold about you.</li>
                <li><span className="text-white font-semibold">Correction:</span> You may request that we correct inaccurate information.</li>
                <li><span className="text-white font-semibold">Deletion:</span> You may request deletion of your personal information, subject to legal obligations.</li>
                <li><span className="text-white font-semibold">Opt-Out:</span> You may opt out of receiving promotional communications.</li>
              </ul>
              <p className="text-white/70 leading-relaxed mt-4">
                To exercise these rights, please contact us at the information provided below.
              </p>
            </div>

            {/* Third-Party Links */}
            <div>
              <h2 className="font-['Anton'] text-3xl text-red-600 mb-4 uppercase">Third-Party Links</h2>
              <p className="text-white/70 leading-relaxed">
                Our website may contain links to third-party websites. We are not responsible for the privacy practices of these external sites. We encourage you to review the privacy policies of any third-party services before providing your information.
              </p>
            </div>

            {/* Children's Privacy */}
            <div>
              <h2 className="font-['Anton'] text-3xl text-red-600 mb-4 uppercase">Children's Privacy</h2>
              <p className="text-white/70 leading-relaxed">
                Our website is not intended for children under 13 years of age. We do not knowingly collect personal information from children. If we become aware that a child has provided us with personal information, we will take steps to delete such information and terminate the child's account.
              </p>
            </div>

            {/* Changes to This Policy */}
            <div>
              <h2 className="font-['Anton'] text-3xl text-red-600 mb-4 uppercase">Changes to This Policy</h2>
              <p className="text-white/70 leading-relaxed">
                We may update this Privacy Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. We will notify you of any material changes by posting the updated policy on our website and updating the "Last Updated" date below.
              </p>
            </div>

            {/* Contact Us */}
            <div className="border-t border-white/10 pt-8">
              <h2 className="font-['Anton'] text-3xl text-red-600 mb-4 uppercase">Contact Us</h2>
              <p className="text-white/70 leading-relaxed mb-4">
                If you have questions about this Privacy Policy or our privacy practices, please contact us:
              </p>
              <div className="bg-white/5 border border-white/10 p-6 rounded-none space-y-3">
                <p className="text-white">
                  <span className="font-semibold">Murder Mitten Media</span><br />
                  Detroit, Michigan
                </p>
                <p className="text-white">
                  <span className="font-semibold">Email:</span> <a href="mailto:contact@murdermittenmedia.com" className="text-red-500 hover:text-red-400">contact@murdermittenmedia.com</a>
                </p>
                <p className="text-white">
                  <span className="font-semibold">Instagram:</span> <a href="https://www.instagram.com/murdermittenmedia/" target="_blank" rel="noopener noreferrer" className="text-red-500 hover:text-red-400">@murdermittenmedia</a>
                </p>
              </div>
            </div>

            {/* Last Updated */}
            <div className="text-center pt-8 border-t border-white/10">
              <p className="text-white/40 text-sm">
                Last Updated: July 2026
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* -- FOOTER -------------------------------------------- */}
      <footer className="border-t border-white/10 py-10 mt-16">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3">
            <img src="/manus-storage/mmm_logo_8689da6b.png" alt="Murder Mitten Media" className="w-8 h-8 rounded-full object-cover" />
            <span className="font-['Anton'] text-lg tracking-wider">
              MURDER MITTEN <span className="text-red-600">MEDIA</span>
            </span>
          </a>
          <div className="text-white/30 text-xs text-center">
            © 2022-{new Date().getFullYear()} Murder Mitten Media ™ · The Mitten
          </div>
          <div className="flex items-center gap-4 text-xs text-white/30 uppercase tracking-widest">
            <a href="https://www.instagram.com/murdermittenmedia/" target="_blank" rel="noopener noreferrer" className="hover:text-red-500 transition-colors">Instagram</a>
            <a href="/" className="hover:text-red-500 transition-colors">Home</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
