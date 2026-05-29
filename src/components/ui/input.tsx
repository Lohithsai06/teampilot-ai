import * as React from "react";
import { cn } from "@/lib/utils";

<<<<<<< HEAD
export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;
=======
export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}
>>>>>>> 34e35ede3dbaf79d7f530c46a21eb58646c938b3

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
