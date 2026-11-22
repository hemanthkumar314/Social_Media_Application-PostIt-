import { useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RecoveryValidation } from '@/lib/validation';
import { requestPasswordRecovery } from '@/lib/appwrite/api';
import { emailAuthEnabled } from '@/lib/appwrite/features';

export default function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const form = useForm<z.infer<typeof RecoveryValidation>>({
    resolver: zodResolver(RecoveryValidation), defaultValues: {email: ''},
  });
  async function submit(values: z.infer<typeof RecoveryValidation>) {
    setError('');
    try { await requestPasswordRecovery(values.email); setSent(true); }
    catch { setError('Unable to send the reset link. Please try again in a few minutes.'); }
  }
  return <div className="flex w-full max-w-[420px] flex-col items-center">
    <img src="/assets/images/logo.svg" alt="PostIt" width={132} height={36} />
    <h2 className="mt-8 text-center h3-bold">Forgot password?</h2>
    <p className="mt-2 text-center text-sm text-light-3">Enter the email you used to create your account.</p>
    {!emailAuthEnabled ? <p role="status" className="mt-6 text-center text-sm">Email password recovery is not available yet.</p> : sent ? <p role="status" className="mt-6 text-center text-sm">If an account uses that email, you’ll receive a password reset link. Check your inbox and spam folder.</p> :
      <Form {...form}>
        <form onSubmit={form.handleSubmit(submit)} className="mt-6 flex w-full flex-col gap-5">
          <FormField control={form.control} name="email" render={({field}) => <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl><Input type="email" autoComplete="email" placeholder="Enter email" className="shad-input" {...field} /></FormControl>
            <FormMessage />
          </FormItem>} />
          {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="shad-button_primary" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      </Form>}
    <Link to="/sign-in" className="mt-6 text-sm text-primary-500">Back to log in</Link>
  </div>;
}
