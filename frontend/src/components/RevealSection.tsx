"use client";

import React, { useEffect, useRef, useState } from "react";

interface RevealSectionProps {
    children: React.ReactNode;
    className?: string;
    delay?: number;
    direction?: "up" | "down" | "left" | "right" | "none";
}

export default function RevealSection({
    children,
    className = "",
    delay = 0,
    direction = "up"
}: RevealSectionProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [offset, setOffset] = useState(0);
    const sectionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                }
            },
            { threshold: 0.1 }
        );

        if (sectionRef.current) {
            observer.observe(sectionRef.current);
        }

        // Parallax scroll logic
        const handleScroll = () => {
            if (!sectionRef.current) return;
            const rect = sectionRef.current.getBoundingClientRect();
            const scrollPos = window.innerHeight - rect.top;
            if (scrollPos > 0 && rect.top < window.innerHeight) {
                // Subtle parallax factor
                setOffset(rect.top * 0.1);
            }
        };

        window.addEventListener("scroll", handleScroll);
        return () => {
            observer.disconnect();
            window.removeEventListener("scroll", handleScroll);
        };
    }, []);

    const getDirectionStyle = () => {
        switch (direction) {
            case "up": return isVisible ? "translate-y-0" : "translate-y-20";
            case "down": return isVisible ? "translate-y-0" : "-translate-y-20";
            case "left": return isVisible ? "translate-x-0" : "translate-x-20";
            case "right": return isVisible ? "translate-x-0" : "-translate-x-20";
            default: return "";
        }
    };

    return (
        <div
            ref={sectionRef}
            className={`transition-all duration-1000 ease-out ${className} ${isVisible ? "opacity-100" : "opacity-0"} ${getDirectionStyle()}`}
            style={{
                transitionDelay: `${delay}ms`,
                transform: isVisible
                    ? `translateY(${direction === 'none' ? 0 : offset * 0.2}px)` // Parallax after reveal
                    : undefined
            }}
        >
            {children}
        </div>
    );
}
