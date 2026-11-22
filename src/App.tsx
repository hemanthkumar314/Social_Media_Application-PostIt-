import './globals.css';
import {Routes,Route} from 'react-router-dom';
import {AllUsers, CreatePost, EditPost, Explore, Home, PostDetails, Profile, Saved, UpdateProfile} from './_root/pages';
import SignupForm from './_auth/forms/SignupForm';
import SigninForm from './_auth/forms/SigninForm';
import ForgotPasswordForm from './_auth/forms/ForgotPasswordForm';
import ResetPasswordForm from './_auth/forms/ResetPasswordForm';
import AuthLayout from './_auth/AuthLayout';
import RootLayout from './_root/RootLayout';
import { Toaster } from './components/ui/toaster';

const App = () => {
  return (
    <div>
      <main className='flex h-screen'>
        <Routes>
            <Route element={<AuthLayout/>}>
                <Route path="/sign-in" element={<SigninForm/>}/>
                <Route path="/sign-up" element={<SignupForm/>}/>
                <Route path="/forgot-password" element={<ForgotPasswordForm/>}/>
                <Route path="/reset-password" element={<ResetPasswordForm/>}/>
            </Route>

            <Route element={<RootLayout/>}>
                <Route index element={<Home/>}/>
                <Route path='/explore' element={<Explore/>}/>
                <Route path='/saved' element={<Saved/>}/>
                <Route path='/all-users' element={<AllUsers/>}/>
                <Route path='/create-post' element={<CreatePost/>}/>
                <Route path='/update-post/:id' element={<EditPost/>}/>
                <Route path='/posts/:id' element={<PostDetails/>}/>
                <Route path='/profile/:id/*' element={<Profile/>}/>
                <Route path='/update-profile/:id' element={<UpdateProfile/>}/>
                <Route path="*" element={<div className="common-container"><h2 className="h2-bold">Page not found</h2><a href="/" className="text-primary-500">Return home</a></div>}/>
            </Route>
        </Routes>

        <Toaster/>
      </main>
    </div>
  )
}

export default App
