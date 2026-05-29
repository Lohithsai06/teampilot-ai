import * as React from "react";
import { cn } from "@/lib/utils";

<<<<<<< HEAD
export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;
=======
export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}
>>>>>>> 34e35ede3dbaf79d7f530c46a21eb58646c938b3

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
