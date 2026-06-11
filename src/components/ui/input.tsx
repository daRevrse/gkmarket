import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 font-body text-ink placeholder:text-ink-muted",
        "transition-[border-color,box-shadow] focus:border-emerald focus:outline-none focus:shadow-[0_0_0_3px_rgb(0_200_150_/_0.15)]",
        className,
      )}
      {...props}
    />
  );
}
