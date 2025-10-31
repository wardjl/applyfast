"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const addToWaitlist = useMutation(api.waitlist.addToWaitlist);
  const waitlistCount = useQuery(api.waitlist.getWaitlistCount);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    try {
      const result = await addToWaitlist({ email, source: "landing_page" });

      if (result.alreadyExists) {
        toast({
          title: "You're already on the list! 🎉",
          description: "We've got you covered. You'll hear from us when we launch!",
        });
      } else {
        toast({
          title: "Success!",
          description: "You've been added to the waitlist. We'll be in touch soon!",
        });
      }
      setEmail("");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-center">
            <div className="flex items-center space-x-2">
              <Image
                src="/logo.png"
                alt="ApplyFa.st"
                width={32}
                height={32}
                className="rounded"
              />
              <span className="text-xl font-bold">ApplyFa.st</span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 px-4">
        {/* Title & Subtitle Above */}
        <div className="container mx-auto text-center max-w-2xl">
          <h1 className="mt-4 text-4xl md:text-6xl font-bold mb-6">
            ApplyFa.st
          </h1>
          <p className="text-lg text-muted-foreground">
            Personalised job matches powered by <span className="font-bold">Gemini Nano</span>
          </p>
        </div>

        {/* Video Frame Below Title & Subtitle */}
        <div className="container mx-auto max-w-4xl">
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
            <Image
              src="/cover.png"
              alt="Demo Video Cover"
              fill
              className="object-cover"
            />
          </div>
        </div>

        <div className="container mx-auto text-center max-w-2xl">
          {/* Signup Title */}
          <h2 className="text-xl font-semibold mb-2">Be notified when we launch</h2>
          {/* Email Signup */}
          <form
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto mb-6"
          >
            <Input
              className="flex-1 h-11"
              placeholder="Enter your email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              required
            />
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-11 px-6"
            >
              {isSubmitting ? "Joining..." : "Join"}
            </Button>
          </form>

          {waitlistCount !== undefined && waitlistCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {waitlistCount.toLocaleString()} people have joined
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
