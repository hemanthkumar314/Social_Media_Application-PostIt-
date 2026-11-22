import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input, InputProps } from './input';
import { cn } from '@/lib/utils';

type PasswordInputProps = Omit<InputProps, 'type'> & { visibilityLabel?: string };

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, visibilityLabel = 'password', ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);

    return (
      <div className="relative">
        <Input {...props} ref={ref} type={visible ? 'text' : 'password'} className={cn(className, 'pr-12')} />
        <button
          type="button"
          className="absolute inset-y-1 right-1 flex w-10 items-center justify-center rounded-md text-light-3 transition-colors hover:text-light-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50"
          aria-label={`${visible ? 'Hide' : 'Show'} ${visibilityLabel}`}
          aria-pressed={visible}
          aria-controls={props.id}
          disabled={props.disabled}
          onMouseDown={event => event.preventDefault()}
          onClick={() => setVisible(value => !value)}>
          {visible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };
