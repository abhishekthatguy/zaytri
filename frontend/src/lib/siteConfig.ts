/**
 * Zaytri — Global Site Configuration
 * ─────────────────────────────────────
 * All branding, social media URLs, contact info, pricing,
 * and company details are controlled from this single file.
 */

export const siteConfig = {
    // ── Brand ─────────────────────────────────────────────────────
    name: "Zaytri",
    tagline: "AI-Powered Social Media Automation",
    description:
        "Multi-agent AI system that automates content creation, scheduling, publishing, and engagement across all social media platforms.",
    logo: "Z",
    version: "1.0.0",
    year: new Date().getFullYear(),

    // ── Creator / Company ─────────────────────────────────────────
    company: {
        name: "Zaytri Technologies",
        legalName: "Zaytri Technologies Pvt. Ltd.",
        founder: "Abhishek Singh (Avii)",
        founderTitle: "Founder & AI Architect",
        founded: "2024",
        location: "India",
        mission:
            "Empowering businesses and creators with intelligent AI automation to simplify social media management and amplify their digital presence.",
        about:
            "Zaytri was born from a vision to democratize AI-powered social media management. Built by Abhishek Singh (Avii), an AI enthusiast and automation architect, Zaytri brings enterprise-level AI orchestration to everyone — from solo creators to growing businesses. Our multi-agent system handles everything from content creation and hashtag research to smart publishing and audience engagement, all powered by your choice of AI models.",
    },

    // ── Contact ───────────────────────────────────────────────────
    contact: {
        email: "hello@zaytri.com",
        supportEmail: "support@zaytri.com",
        phone: "+91-98765-43210",
        address: "India",
    },

    // ── Social Media ──────────────────────────────────────────────
    social: {
        twitter: "https://twitter.com/zaytri",
        github: "https://github.com/zaytri",
        linkedin: "https://linkedin.com/company/zaytri",
        instagram: "https://instagram.com/zaytri",
        youtube: "https://youtube.com/@zaytri",
        discord: "https://discord.gg/zaytri",
    },

    // ── Navigation ────────────────────────────────────────────────
    navLinks: [
        { label: "Features", href: "#features" },
        { label: "Pricing", href: "#pricing" },
        { label: "About", href: "/about" },
        { label: "Resources", href: "/resources" },
    ],

    footerLinks: {
        product: [
            { label: "Features", href: "#features" },
            { label: "Pricing", href: "#pricing" },
            { label: "Resources", href: "/resources" },
            { label: "Dashboard", href: "/dashboard" },
        ],
        company: [
            { label: "About Us", href: "/about" },
            { label: "Contact", href: "mailto:hello@zaytri.com" },
        ],
        legal: [
            { label: "Privacy Policy", href: "/privacy" },
            { label: "Terms of Service", href: "/terms" },
        ],
    },

    // ── Features ──────────────────────────────────────────────────
    features: [
        {
            icon: "🤖",
            title: "7 Specialized AI Agents",
            description:
                "Content Creator, Hashtag Generator, Review Agent, Scheduler, Publisher, Engagement Bot, and Analytics Agent — all working in harmony.",
        },
        {
            icon: "🧠",
            title: "Multi-Model AI Engine",
            description:
                "Use Ollama (free & local), OpenAI, Google Gemini, Anthropic Claude, or Groq. Switch models per agent or use them all.",
        },
        {
            icon: "🌍",
            title: "Multi-Platform Publishing",
            description:
                "Instagram, Facebook, Twitter/X, and YouTube — create once, publish everywhere with platform-optimized formatting.",
        },
        {
            icon: "💬",
            title: "Natural Language Control",
            description:
                "Chat with the Master Agent in any language. Configure AI keys, run workflows, change settings — all through conversation.",
        },
        {
            icon: "📊",
            title: "Smart Analytics",
            description:
                "Automated weekly performance reports with engagement tracking, growth metrics, and AI-powered improvement suggestions.",
        },
        {
            icon: "🔄",
            title: "Automated Pipelines",
            description:
                "Content → Hashtags → Review → Approval → Publishing → Engagement. Fully automated content pipelines with quality gates.",
        },
        {
            icon: "🔐",
            title: "Enterprise Security",
            description:
                "Encrypted API key storage, role-based access, secure authentication with JWT, and full audit logging.",
        },
        {
            icon: "📷",
            title: "Image & Voice Support",
            description:
                "Drag-and-drop image uploads, clipboard paste, voice input for hands-free operation. Analyze images with AI.",
        },
    ],

    // ── Pricing Plans ──────────────────────────────────────────────
    pricing: [
        {
            name: "Starter",
            price: "Free",
            period: "forever",
            description: "Perfect for exploring Zaytri's capabilities",
            highlight: false,
            features: [
                "1 social media platform",
                "Ollama (local AI) only",
                "Basic content creation",
                "Manual approval workflow",
                "Community support",
                "Up to 50 posts/month",
            ],
            cta: "Get Started Free",
            ctaLink: "/signup",
        },
        {
            name: "Pro",
            price: "$29",
            period: "/month",
            description: "For creators and small businesses",
            highlight: true,
            badge: "Most Popular",
            features: [
                "All 4 platforms",
                "All AI providers (OpenAI, Gemini, etc.)",
                "Full 7-agent pipeline",
                "Auto-approve & auto-publish",
                "Weekly analytics reports",
                "Unlimited posts",
                "Priority support",
                "Voice & image input",
            ],
            cta: "Start Pro Trial",
            ctaLink: "/signup?plan=pro",
        },
        {
            name: "Enterprise",
            price: "$99",
            period: "/month",
            description: "For agencies and large teams",
            highlight: false,
            features: [
                "Everything in Pro",
                "Multi-user team access",
                "Custom AI model fine-tuning",
                "Dedicated account manager",
                "Custom workflow builder",
                "API access & webhooks",
                "White-label option",
                "SLA guarantee (99.9%)",
            ],
            cta: "Contact Sales",
            ctaLink: "mailto:hello@zaytri.com?subject=Enterprise%20Plan",
        },
    ],

    // ── Agents (for marketing display) ────────────────────────────
    agents: [
        {
            name: "Content Creator",
            icon: "📝",
            description: "AI-powered content generation with hooks, CTAs, and tone matching",
        },
        {
            name: "Hashtag Generator",
            icon: "#️⃣",
            description: "Research-backed niche and trending hashtag suggestions",
        },
        {
            name: "Review Agent",
            icon: "🔍",
            description: "Grammar, compliance, brand safety, and optimization scoring",
        },
        {
            name: "Scheduler Bot",
            icon: "📅",
            description: "Intelligent scheduling with optimal posting time recommendations",
        },
        {
            name: "Publisher Bot",
            icon: "🚀",
            description: "Cross-platform publishing with format optimization",
        },
        {
            name: "Engagement Bot",
            icon: "💬",
            description: "AI-powered comment replies and audience interaction",
        },
        {
            name: "Analytics Agent",
            icon: "📊",
            description: "Automated performance reports with growth insights",
        },
    ],

    // ── Resources / Documentation ─────────────────────────────────
    resources: [
        {
            title: "API Keys Setup Guide",
            description: "How to obtain and configure API keys for all LLM providers (OpenAI, Gemini, Anthropic, Groq) and social media platforms.",
            file: "HOW_TO_GET_API_KEYS.md",
            icon: "🔑",
            category: "Setup",
        },
        {
            title: "Master Agent Documentation",
            description: "Complete guide to the Master Agent — how it processes commands, manages intents, and orchestrates other agents.",
            file: "MASTER_AGENT.md",
            icon: "🤖",
            category: "Core",
        },
        {
            title: "Authentication System",
            description: "Technical documentation of the auth system — JWT tokens, sessions, password reset, email verification.",
            file: "AUTH.md",
            icon: "🔐",
            category: "Security",
        },
        {
            title: "Auth Implementation Plan",
            description: "Architecture and planning document for the authentication system implementation.",
            file: "AUTH_PLAN.md",
            icon: "📋",
            category: "Architecture",
        },
    ],

    // ── Testimonials (marketing) ──────────────────────────────────
    testimonials: [
        {
            name: "Priya Sharma",
            role: "Content Creator",
            avatar: "PS",
            quote:
                "Zaytri transformed my workflow. What used to take me 4 hours now happens automatically while I sleep!",
        },
        {
            name: "Alex Chen",
            role: "Marketing Manager",
            avatar: "AC",
            quote:
                "The multi-model AI engine is a game-changer. We switch between Gemini and GPT-4 depending on the content type.",
        },
        {
            name: "Maria Rodriguez",
            role: "Agency Owner",
            avatar: "MR",
            quote:
                "Managing 12 client accounts used to need a team of 5. Now Zaytri handles it all with better consistency.",
        },
    ],

    // ── Stats (for marketing) ─────────────────────────────────────
    stats: [
        { value: "7", label: "AI Agents" },
        { value: "5+", label: "LLM Providers" },
        { value: "4", label: "Social Platforms" },
        { value: "24/7", label: "Automation" },
    ],
} as const;

export type SiteConfig = typeof siteConfig;
