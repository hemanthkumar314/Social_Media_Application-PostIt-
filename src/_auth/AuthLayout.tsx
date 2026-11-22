// import React from 'react'
import { Outlet,Navigate,useLocation } from "react-router-dom"
import { useUserContext } from "@/context/AuthContext"
import Loader from "@/components/shared/Loader"
const AuthLayout = () => {

  const { isAuthenticated, isLoading } = useUserContext();
  const { pathname } = useLocation();
  const isRecovery = ['/forgot-password', '/reset-password'].includes(pathname);

  if (isLoading) return <div className="flex-center w-full"><Loader /></div>;


  return (
    <>
    {
      isAuthenticated && !isRecovery ?
      (<Navigate to="/"/>)
      :
      <>
        <section className={`flex min-w-0 flex-1 flex-col items-center overflow-y-auto px-5 ${pathname === '/sign-up' ? 'py-3' : 'py-10'}`}>
          <div className="my-auto flex w-full shrink-0 justify-center">
            <Outlet/>
          </div>
        </section>

        <img 
          src="/assets/images/postit-auth-collage.png"
          alt="A collage of friends, travel, coffee, and creative moments"
          loading="lazy"
          decoding="async"
          className="hidden object-contain w-1/2 h-screen bg-dark-1 xl:block"
        />
      </>
    }
    </>
  )
}

export default AuthLayout
