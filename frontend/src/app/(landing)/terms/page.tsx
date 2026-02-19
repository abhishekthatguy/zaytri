"use client";

import Link from "next/link";
import { siteConfig } from "@/lib/siteConfig";

export default function TermsOfService() {
    return (
        <div style={{ background: "#0a0a12", color: "white", minHeight: "100vh" }}>
            {/* Nav */}
            <nav
                className="sticky top-0 z-50"
                style={{
                    background: "rgba(10, 10, 18, 0.95)",
                    backdropFilter: "blur(20px)",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
            >
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3">
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                            style={{ background: "linear-gradient(135deg, #06b6d4, #164e63)" }}
                        >
                            {siteConfig.logo}
                        </div>
                        <span className="text-base font-bold text-white">{siteConfig.name}</span>
                    </Link>
                    <Link href="/" className="text-sm hover:text-white" style={{ color: "rgba(255,255,255,0.6)" }}>
                        ← Back to Home
                    </Link>
                </div>
            </nav>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-6 py-16">
                <h1 className="text-4xl font-black mb-2">Terms of Service</h1>
                <p className="text-sm mb-12" style={{ color: "rgba(255,255,255,0.5)" }}>
                    Last updated: February 2025
                </p>

                <div className="space-y-8 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">1. Acceptance of Terms</h2>
                        <p>
                            By accessing or using {siteConfig.name}, operated by {siteConfig.company.legalName},
                            you agree to be bound by these Terms of Service. If you do not agree, you may not use the service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">2. Description of Service</h2>
                        <p>
                            {siteConfig.name} is an AI-powered social media automation platform that provides:
                        </p>
                        <ul className="list-disc list-inside space-y-1.5 ml-4 mt-3">
                            <li>AI-generated content creation using multiple language model providers</li>
                            <li>Automated hashtag generation and optimization</li>
                            <li>Content review and quality scoring</li>
                            <li>Automated scheduling and cross-platform publishing</li>
                            <li>AI-powered engagement and comment management</li>
                            <li>Analytics and performance reporting</li>
                            <li>Natural language system control via the Master Agent</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">3. User Accounts</h2>
                        <ul className="list-disc list-inside space-y-1.5 ml-4">
                            <li>You must provide accurate information when creating an account</li>
                            <li>You are responsible for maintaining the security of your account credentials</li>
                            <li>You must be at least 16 years old to use this service</li>
                            <li>One person may not maintain more than one account</li>
                            <li>You are responsible for all activity under your account</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">4. API Keys & Third-Party Services</h2>
                        <p className="mb-3">
                            You may connect third-party API keys (OpenAI, Google, Anthropic, Groq, social media platforms)
                            to enhance {siteConfig.name}&apos;s functionality. You acknowledge that:
                        </p>
                        <ul className="list-disc list-inside space-y-1.5 ml-4">
                            <li>You are solely responsible for the costs incurred by third-party API usage</li>
                            <li>API keys are encrypted and stored securely, but you should rotate them periodically</li>
                            <li>We are not responsible for outages or changes in third-party services</li>
                            <li>You must comply with each provider&apos;s terms of service</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">5. Content & Publishing</h2>
                        <ul className="list-disc list-inside space-y-1.5 ml-4">
                            <li>You retain ownership of all content created using {siteConfig.name}</li>
                            <li>AI-generated content is created as a tool for you — you are responsible for reviewing and approving it</li>
                            <li>You are responsible for ensuring published content complies with platform guidelines</li>
                            <li>We do not guarantee that AI-generated content will be factually accurate</li>
                            <li>Auto-publish features operate under your explicit configuration and consent</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">6. Acceptable Use</h2>
                        <p className="mb-3">You agree not to use {siteConfig.name} to:</p>
                        <ul className="list-disc list-inside space-y-1.5 ml-4">
                            <li>Generate or distribute harmful, illegal, or misleading content</li>
                            <li>Spam or abuse social media platforms</li>
                            <li>Violate any applicable laws or regulations</li>
                            <li>Impersonate individuals or organizations</li>
                            <li>Attempt to bypass rate limits or security measures</li>
                            <li>Reverse engineer or decompile the service</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">7. Service Availability</h2>
                        <p>
                            We strive to maintain high availability but do not guarantee uninterrupted access.
                            The service may be temporarily unavailable for maintenance, updates, or unforeseen circumstances.
                            Local Ollama-based features depend on your own hardware and setup.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">8. Limitation of Liability</h2>
                        <p>
                            To the maximum extent permitted by law, {siteConfig.company.legalName} shall not be liable for any
                            indirect, incidental, special, consequential, or punitive damages, including lost profits, data,
                            or goodwill, arising from your use of the service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">9. Pricing & Billing</h2>
                        <ul className="list-disc list-inside space-y-1.5 ml-4">
                            <li>The free tier is available indefinitely with limited features</li>
                            <li>Paid plans are billed monthly or annually</li>
                            <li>We reserve the right to modify pricing with 30 days&apos; notice</li>
                            <li>Refunds are available within 14 days of purchase</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">10. Termination</h2>
                        <p>
                            We may suspend or terminate your account if you violate these terms. You may cancel your
                            account at any time. Upon termination, your data will be retained for 30 days before permanent deletion.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">11. Changes to Terms</h2>
                        <p>
                            We may update these terms from time to time. We will notify users of material changes via email
                            or in-app notification. Continued use after changes constitutes acceptance.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">12. Contact</h2>
                        <div className="p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <p><strong className="text-white">{siteConfig.company.legalName}</strong></p>
                            <p>📧 {siteConfig.contact.email}</p>
                            <p>📱 {siteConfig.contact.phone}</p>
                            <p>📍 {siteConfig.contact.address}</p>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
