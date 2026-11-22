// import React from 'react'

import Bottombar from "@/components/shared/Bottombar"
import LeftSidebar from "@/components/shared/LeftSidebar"
import Topbar from "@/components/shared/Topbar"
import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useUserContext } from "@/context/AuthContext"
import Loader from "@/components/shared/Loader"

const RootLayout = () => {
  const { isAuthenticated, isLoading } = useUserContext();
  const location = useLocation();

  if (isLoading) return <div className="flex-center w-full"><Loader /></div>;
  if (!isAuthenticated) return <Navigate to="/sign-in" replace state={{ from: location }} />;

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden">
     <LeftSidebar/>
     <div className="flex min-h-0 min-w-0 flex-1 flex-col">
       <Topbar/>
       <section aria-label="Page content" className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
         <Outlet/>
       </section>
       <Bottombar/>
     </div>
    </div>
  )
}

export default RootLayout
