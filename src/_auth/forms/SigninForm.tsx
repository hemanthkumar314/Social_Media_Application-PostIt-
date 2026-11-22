import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Link,useLocation,useNavigate } from "react-router-dom"
import { Form,FormControl,FormField,FormItem,FormLabel,FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Button } from "@/components/ui/button"
import { SigninValidation } from '@/lib/validation'
import Loader  from '@/components/shared/Loader'
import { useToast } from "@/components/ui/use-toast"
import { useSignInAccount } from "@/lib/react-query/queriesAndMutations"
import { useUserContext } from "@/context/AuthContext"
import { emailAuthEnabled } from '@/lib/appwrite/features'
import { signInErrorMessage } from '@/lib/appwrite/auth-errors'


const SigninForm = () => {

  const { toast }=useToast();

  const navigate=useNavigate();
  const location=useLocation();

  const { checkAuthUser , isLoading:isUserLoading } = useUserContext();

  const { mutateAsync:signInAccount, isPending:isSigningIn} = useSignInAccount();

  const form = useForm<z.infer<typeof SigninValidation>>({
    resolver: zodResolver(SigninValidation),
    defaultValues: {
      username:"",
      password:""
    },
  })
 
  async function onSubmit(values: z.infer<typeof SigninValidation>) {
    try {
    const session = await signInAccount({
      username:values.username,
      password:values.password,
    })

    if(!session){
      return toast({title:'Sign in failed.Please try again'})
    }
    
    const isLoggedIn = await checkAuthUser();

    if(isLoggedIn){
      form.reset();
      const from = location.state?.from;
      const destination = typeof from?.pathname === 'string' && from.pathname.startsWith('/') && !from.pathname.startsWith('//')
        ? `${from.pathname}${from.search ?? ''}${from.hash ?? ''}` : '/';
      navigate(destination, { replace: true })
    }
    else{
      toast({title:'You signed in, but your profile could not load. Please try again.'})
    }
    } catch (error) {
      toast({title:signInErrorMessage(error)});
    }
  }
  
  return (
    <Form {...form}>
      <div className="flex-col w-full max-w-[420px] flex-center">

        <img src="/assets/images/logo.svg" alt="PostIt" width={132} height={36}/>

        <h2 className="pt-5 h3-bold md:h2-bold sm:pt-12">Login to your account</h2>

        <p className="mt-2 text-light-3 small-medium md:base-regular">
          Welcome back,Please enter your account details
        </p>

      
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col w-full gap-5 mt-4">
          
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="Enter username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} className="shad-input" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Password</FormLabel>
                  {emailAuthEnabled && <Link to="/forgot-password" className="text-xs text-primary-500 hover:underline">Forgot password?</Link>}
                </div>
                <FormControl>
                  <PasswordInput autoComplete="current-password" className="shad-input" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="shad-button_primary" disabled={form.formState.isSubmitting || isSigningIn || isUserLoading}>
            {form.formState.isSubmitting || isSigningIn || isUserLoading ?(
              <div className="gap-2 flex-center">
                <Loader/> Loading..
              </div>
            ):"Log in"}
          </Button>

          <p className="mt-2 text-center text-small-reglar text-light-2">
            Don't have an account?
            <Link to="/sign-up" className="ml-1 text-primary-500 text-small-semibold">Sign Up</Link>
          </p>
        </form>
      </div>
    </Form>
  )
}

export default SigninForm
