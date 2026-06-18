import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

const LOGO_SRC = "/LOGO_PGS.png";
const LOGO_WIDTH = 1254;
const LOGO_HEIGHT = 1254;

const sizeClasses = {
  xs: "h-8 w-8",
  sm: "h-10 w-10",
  md: "h-14 w-14",
  lg: "h-20 w-20",
  xl: "h-28 w-28",
  "2xl": "h-36 w-36",
} as const;

type PegasusLogoProps = {
  size?: keyof typeof sizeClasses;
  className?: string;
  priority?: boolean;
  href?: string;
};

export function PegasusLogo({
  size = "md",
  className,
  priority = false,
  href,
}: PegasusLogoProps) {
  const image = (
    <Image
      src={LOGO_SRC}
      alt="Pegasus"
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      priority={priority}
      className={cn("object-contain", sizeClasses[size], className)}
    />
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex shrink-0">
        {image}
      </Link>
    );
  }

  return image;
}
