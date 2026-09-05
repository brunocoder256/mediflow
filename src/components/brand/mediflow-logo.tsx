import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface MediFlowLogoProps {
  href?: string;
  size?: number;
  className?: string;
  showWordmark?: boolean;
  wordmarkClassName?: string;
  priority?: boolean;
}

export function MediFlowMark({
  size = 32,
  className,
  priority,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/mediflow-logo.png"
      alt="MediFlow logo"
      width={size}
      height={size}
      className={cn("rounded-lg object-contain", className)}
      priority={priority}
    />
  );
}

export function MediFlowLogo({
  href = "/",
  size = 36,
  className,
  showWordmark = true,
  wordmarkClassName,
  priority,
}: MediFlowLogoProps) {
  const content = (
    <>
      <MediFlowMark size={size} priority={priority} />
      {showWordmark && (
        <span
          className={cn(
            "text-lg font-bold tracking-tight text-teal-700 dark:text-teal-400",
            wordmarkClassName,
          )}
        >
          MediFlow
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cn("inline-flex items-center gap-2", className)}>
        {content}
      </Link>
    );
  }
  return <div className={cn("inline-flex items-center gap-2", className)}>{content}</div>;
}
