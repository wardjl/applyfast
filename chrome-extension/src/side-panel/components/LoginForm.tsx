import { useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const { signIn } = useAuthActions();

  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const heading = "ApplyFa.st";
  const subtitle =
    "Job Search Copilot";
  const submitLabel = flow === "signIn" ? "Sign in" : "Sign up";
  const togglePrompt =
    flow === "signIn" ? "Don't have an account?" : "Already have an account?";
  const toggleLabel = flow === "signIn" ? "Sign up" : "Sign in";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("email", email);
      formData.set("password", password);
      formData.set("flow", flow);

      await signIn("password", formData);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-6">
      <div className="w-full max-w-sm">
        <div className={cn("flex flex-col gap-6", className)} {...props}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <img
                src="/logo.png"
                alt="ApplyFa.st"
                className="h-8 w-auto rounded-sm"
                width="128"
                height="80"
              />
              <h1 className="text-xl font-bold leading-tight">{heading}</h1>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="email@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={flow === "signIn" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <div className="text-sm text-center mt-2">
                  {togglePrompt}{" "}
                  <button
                    type="button"
                    className="underline underline-offset-4"
                    onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
                  >
                    {toggleLabel}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                className="w-full bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground shadow-none"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Please wait..." : submitLabel}
              </Button>
            </div>

            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </form>

          <div className="text-balance text-center text-xs text-muted-foreground">
            By continuing, you agree to our{" "}
            <a
              href="https://applyfa.st/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="https://applyfa.st/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              Privacy Policy
            </a>
            .
          </div>
        </div>
      </div>
    </div>
  );
}
