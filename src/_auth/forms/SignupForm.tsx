import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';
import { SignupValidation } from '@/lib/validation';
import Loader from '@/components/shared/Loader';
import { useToast } from '@/components/ui/use-toast';
import { useCreateUserAccount, useSignInAccount } from '@/lib/react-query/queriesAndMutations';
import { useUserContext } from '@/context/AuthContext';
import { emailAuthEnabled } from '@/lib/appwrite/features';

const SignupForm = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { checkAuthUser } = useUserContext();
  const { mutateAsync: createUserAccount, isPending: isCreatingAccount } = useCreateUserAccount();
  const { mutateAsync: signInAccount } = useSignInAccount();
  const form = useForm<z.infer<typeof SignupValidation>>({
    resolver: zodResolver(SignupValidation),
    defaultValues: { username: '', email: '', password: '', confirmPassword: '' },
  });

  async function onSubmit(values: z.infer<typeof SignupValidation>) {
    try {
      const credentials = { username: values.username, password: values.password };
      const newUser = await createUserAccount({ ...credentials, email: values.email });
      if (!newUser || typeof newUser !== 'object' || !('$id' in newUser)) {
        return toast({ title: 'Sign up failed. Please try again' });
      }
      const session = await signInAccount(credentials);
      if (!session || !await checkAuthUser()) {
        return toast({ title: 'Unable to sign in. Please try again.' });
      }
      form.reset();
      navigate('/', { replace: true });
    } catch (error) {
      toast({ title: error instanceof Error && ['That username is already taken.', 'That username or email is already in use.'].includes(error.message)
        ? error.message : 'Sign up failed. Please try again.' });
    }
  }

  return (
    <Form {...form}>
      <div className="flex-col w-full max-w-[420px] flex-center">
        <img src="/assets/images/logo.svg" alt="PostIt" width={110} height={30} />
        <h2 className="pt-3 text-center text-[24px] font-bold leading-tight tracking-tight">Create a new account</h2>
        <p className="mt-1.5 text-center text-light-3 text-[13px] leading-5">
          To use PostIt, Account first Posts Next
        </p>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col w-full gap-2 mt-3 [&_label]:block [&_label]:text-xs [&_label]:leading-4 [&_[role=alert]]:text-xs">
          <FormField control={form.control} name="username" render={({ field }) => (
            <FormItem className="space-y-1">
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input type="text" placeholder="Enter username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} className="shad-input !h-9 text-sm" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem className="space-y-1">
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="Enter email" autoComplete="email" className="shad-input !h-9 text-sm" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="password" render={({ field }) => (
            <FormItem className="space-y-1">
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" className="shad-input !h-9 text-sm" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="confirmPassword" render={({ field }) => (
            <FormItem className="space-y-1">
              <FormLabel>Confirm password</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" visibilityLabel="confirm password" className="shad-input !h-9 text-sm" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <Button type="submit" className="shad-button_primary !h-9 text-sm" disabled={!emailAuthEnabled || form.formState.isSubmitting || isCreatingAccount}>
            {!emailAuthEnabled ? 'Email signup is not available yet' : form.formState.isSubmitting || isCreatingAccount ? <span className="gap-2 flex-center"><Loader /> Loading...</span> : 'Sign up'}
          </Button>
          <p className="text-center text-xs leading-5 text-light-2">
            Already have an account?
            <Link to="/sign-in" className="ml-1 text-primary-500 font-semibold">Log in</Link>
          </p>
        </form>
      </div>
    </Form>
  );
};

export default SignupForm;
