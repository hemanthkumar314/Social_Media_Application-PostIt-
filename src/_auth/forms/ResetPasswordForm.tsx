import { useEffect, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';
import { ResetPasswordValidation } from '@/lib/validation';
import { resetPassword } from '@/lib/appwrite/api';

export default function ResetPasswordForm() {
  const location = useLocation();
  const navigate = useNavigate();
  const [credentials] = useState(() => {
    const query = new URLSearchParams(location.search);
    return {userId: query.get('userId') ?? '', secret: query.get('secret') ?? ''};
  });
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const form = useForm<z.infer<typeof ResetPasswordValidation>>({
    resolver: zodResolver(ResetPasswordValidation), defaultValues: {password: '', confirmPassword: ''},
  });
  useEffect(() => {
    // Keep recovery credentials in memory, out of browser history and referrers.
    if (location.search) navigate('/reset-password', {replace: true});
  }, [location.search, navigate]);
  async function submit(values: z.infer<typeof ResetPasswordValidation>) {
    setError('');
    try { await resetPassword(credentials.userId, credentials.secret, values.password); form.reset(); setDone(true); }
    catch { setError('This reset link is invalid or expired. Please request a new link.'); }
  }
  return <div className="flex w-full max-w-[420px] flex-col items-center">
    <img src="/assets/images/logo.svg" alt="PostIt" width={132} height={36} />
    <h2 className="mt-8 text-center h3-bold">Reset your password</h2>
    {done ? <><p role="status" className="mt-6 text-center text-sm">Your password has been reset. Log in with your username and new password.</p>
      <Link to="/sign-in" className="mt-6 text-sm text-primary-500">Back to log in</Link></> :
      !credentials.userId || !credentials.secret ? <p role="alert" className="mt-6 text-center text-sm">This reset link is incomplete. Please request a new link.</p> :
      <Form {...form}>
        <form onSubmit={form.handleSubmit(submit)} className="mt-6 flex w-full flex-col gap-5">
          <FormField control={form.control} name="password" render={({field}) => <FormItem>
            <FormLabel>New password</FormLabel>
            <FormControl><PasswordInput autoComplete="new-password" className="shad-input" {...field} /></FormControl>
            <FormMessage />
          </FormItem>} />
          <FormField control={form.control} name="confirmPassword" render={({field}) => <FormItem>
            <FormLabel>Confirm password</FormLabel>
            <FormControl><PasswordInput autoComplete="new-password" visibilityLabel="confirm password" className="shad-input" {...field} /></FormControl>
            <FormMessage />
          </FormItem>} />
          {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="shad-button_primary" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Resetting…' : 'Reset password'}
          </Button>
        </form>
      </Form>}
    {!done && <Link to="/forgot-password" className="mt-6 text-sm text-primary-500">Request a new reset link</Link>}
  </div>;
}
