import { cn } from "@/lib/utils";

type ContentRevealProps = {
  children: React.ReactNode;
  className?: string;
};

/** Soft fade-in when replacing a skeleton or loader with real content. */
export function ContentReveal({ children, className }: ContentRevealProps) {
  return <div className={cn("content-reveal", className)}>{children}</div>;
}
