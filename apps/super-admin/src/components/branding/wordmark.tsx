import { cn } from "@/lib/utils";

interface WordmarkProps {
  className?: string;
  showLogo?: boolean;
  size?: "sm" | "md" | "lg";
}

/**
 * Wordmark ENTERAR.ME — el punto entre AR y ME se renderiza en rojo brand.
 */
export function Wordmark({
  className,
  showLogo = true,
  size = "md",
}: WordmarkProps) {
  const logoSize = {
    sm: "h-6",
    md: "h-8",
    lg: "h-10",
  }[size];

  const textSize = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-2xl",
  }[size];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showLogo && (
        <img
          src="/logo.svg"
          alt="Logo ENTERAR.ME"
          className={cn(logoSize, "w-auto")}
        />
      )}
      <span className={cn("wordmark", textSize)}>
        ENTERAR<span className="dot">.</span>ME
      </span>
    </div>
  );
}
