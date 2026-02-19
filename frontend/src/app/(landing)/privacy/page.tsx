"use client";

import Link from "next/link";
import { siteConfig } from "@/lib/siteConfig";

export default function PrivacyPolicy() {
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
                <h1 className="text-4xl font-black mb-2">Privacy Policy</h1>
                <p className="text-sm mb-12" style={{ color: "rgba(255,255,255,0.5)" }}>
                    Last updated: February 2025
                </p>

                <div className="space-y-8 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">1. Introduction</h2>
                        <p>
                            {siteConfig.company.legalName} (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) operates the {siteConfig.name} platform.
                            This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">2. Information We Collect</h2>
                        <p className="mb-3">We collect information you provide directly to us:</p>
                        <ul className="list-disc list-inside space-y-1.5 ml-4">
                            <li>Account information: name, email address, password (hashed)</li>
                            <li>Social media API keys and tokens (encrypted at rest using AES-256)</li>
                            <li>Content you create, approve, or publish through the platform</li>
                            <li>Chat messages with the Master Agent</li>
                            <li>Usage data and analytics preferences</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">3. How We Use Your Information</h2>
                        <ul className="list-disc list-inside space-y-1.5 ml-4">
                            <li>To provide and maintain our service</li>
                            <li>To process AI-generated content through our multi-agent pipeline</li>
                            <li>To publish content to your connected social media accounts</li>
                            <li>To generate analytics and performance reports</li>
                            <li>To personalize your experience and remember preferences</li>
                            <li>To communicate with you about service updates</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">4. AI Processing & Third-Party LLM Providers</h2>
                        <p className="mb-3">
                            {siteConfig.name} uses AI language models to generate and process content. Depending on your configuration, your prompts and content may be processed by:
                        </p>
                        <ul className="list-disc list-inside space-y-1.5 ml-4">
                            <li><strong>Ollama (Local)</strong>: Processes data entirely on your local machine. No data leaves your device.</li>
                            <li><strong>OpenAI</strong>: Subject to <a href="https://openai.com/policies/privacy-policy" className="text-red-400 underline" target="_blank">OpenAI&apos;s Privacy Policy</a></li>
                            <li><strong>Google Gemini</strong>: Subject to <a href="https://ai.google.dev/terms" className="text-red-400 underline" target="_blank">Google AI Terms</a></li>
                            <li><strong>Anthropic Claude</strong>: Subject to <a href="https://www.anthropic.com/privacy" className="text-red-400 underline" target="_blank">Anthropic&apos;s Privacy Policy</a></li>
                            <li><strong>Groq</strong>: Subject to <a href="https://groq.com/privacy-policy/" className="text-red-400 underline" target="_blank">Groq&apos;s Privacy Policy</a></li>
                        </ul>
                        <p className="mt-3">
                            You choose which providers to use. We recommend using Ollama for maximum privacy, as all processing stays local.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">5. Data Security</h2>
                        <p>
                            We implement industry-standard security measures including:
                        </p>
                        <ul className="list-disc list-inside space-y-1.5 ml-4 mt-3">
                            <li>AES-256 encryption for all API keys at rest</li>
                            <li>JWT-based authentication with secure session management</li>
                            <li>HTTPS encryption for all data in transit</li>
                            <li>bcrypt password hashing with salt</li>
                            <li>Rate limiting to prevent abuse</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">6. Data Retention</h2>
                        <p>
                            We retain your data for as long as your account is active. You may request deletion of your account and associated data at any time by contacting us at{" "}
                            <a href={`mailto:${siteConfig.contact.supportEmail}`} className="text-red-400 underline">
                                {siteConfig.contact.supportEmail}
                            </a>.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">7. Your Rights</h2>
                        <p>You have the right to:</p>
                        <ul className="list-disc list-inside space-y-1.5 ml-4 mt-3">
                            <li>Access and download your personal data</li>
                            <li>Correct inaccurate information</li>
                            <li>Delete your account and data</li>
                            <li>Object to data processing</li>
                            <li>Withdraw consent at any time</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">8. Cookies</h2>
                        <p>
                            We use essential cookies for authentication and session management. We do not use third-party
                            tracking cookies or advertising cookies.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">9. Contact Us</h2>
                        <p>
                            If you have questions about this Privacy Policy, contact us at:
                        </p>
                        <div className="mt-3 p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
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
